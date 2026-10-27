import "server-only";
import { z } from "zod";
import { db } from "./db";
import { auth, requireOwner } from "./auth";
import { configurationStatus, isLocalSetup } from "./config";
import { connectionsFor, preferencesFor, scheduleFor } from "./data";
import { AppError, errorResponse, json, protectMutation } from "./http";
import { preferencesSchema, rangeSchema } from "../shared/schemas";
import { enqueueSync } from "./jobs";
import { addDays, today } from "../shared/dates";
import { decrypt } from "./crypto";
import { googleClient } from "./google";
import type { Credentials } from "google-auth-library";
export async function handleApi(request: Request, path: string[]) {
  try {
    const url = new URL(request.url),
      route = path.join("/"),
      method = request.method;
    if (route === "configuration" && method === "GET")
      return json({
        ...configurationStatus(),
        setupRequired: !configurationStatus().ready,
      });
    if (!configurationStatus().ready && !isLocalSetup())
      throw new AppError("CONFIGURATION_REQUIRED", 503);
    const session = isLocalSetup() ? null : await requireOwner(request.headers);
    const ownerId = session?.user.id ?? "local-setup";
    if (method !== "GET")
      protectMutation(
        request,
        ownerId + ":" + route,
        route === "sync" ? 6 : 30,
      );
    if (route === "connections" && method === "GET")
      return json(await connectionsFor(ownerId));
    if (route === "calendars" && method === "GET")
      return json((await connectionsFor(ownerId)).flatMap((c) => c.sources));
    if (route === "events" && method === "GET") {
      const range = rangeSchema.parse({
        start: url.searchParams.get("start"),
        end: url.searchParams.get("end"),
        timeZone: url.searchParams.get("timeZone") ?? "Asia/Kolkata",
        sources: url.searchParams.has("sources")
          ? url.searchParams.get("sources")!.split(",").filter(Boolean)
          : undefined,
      });
      return json(await scheduleFor(ownerId, range));
    }
    if (route === "preferences" && method === "GET")
      return json(await preferencesFor(ownerId));
    if (route === "saved-views" && method === "GET" && isLocalSetup())
      return json([]);
    if (isLocalSetup())
      return json(
        {
          error: {
            code: "CONFIGURATION_REQUIRED",
            message:
              "Configure your private workspace before connecting calendar data.",
          },
        },
        503,
      );
    if (route === "preferences" && method === "PATCH") {
      const input = z
        .object({
          preferences: preferencesSchema.optional(),
          selected: z.array(z.string().max(100)).max(100).optional(),
        })
        .strict()
        .parse(await request.json());
      if (input.preferences) {
        const data = {
          ...(await preferencesFor(ownerId)),
          ...input.preferences,
        };
        await db().userPreference.upsert({
          where: { ownerId },
          create: { ownerId, data },
          update: { data },
        });
      }
      if (input.selected)
        await db().$transaction(async (tx) => {
          const permitted = await tx.calendarSource.count({
            where: { id: { in: input.selected }, connection: { ownerId } },
          });
          if (permitted !== input.selected!.length)
            throw new AppError("ACCESS_RESTRICTED", 403);
          await tx.calendarSource.updateMany({
            where: { connection: { ownerId } },
            data: { selected: false },
          });
          await tx.calendarSource.updateMany({
            where: { id: { in: input.selected }, connection: { ownerId } },
            data: { selected: true },
          });
        });
      return json({ ok: true });
    }
    if (path[0] === "connections" && path.length === 2) {
      const connection = await db().googleConnection.findFirst({
        where: { id: path[1], ownerId },
      });
      if (!connection) throw new AppError("NOT_FOUND", 404);
      if (method === "PATCH") {
        const data = z
          .object({
            label: z.string().trim().min(1).max(40).optional(),
            color: z.enum(["green", "orange", "purple", "blue"]).optional(),
          })
          .strict()
          .parse(await request.json());
        await db().googleConnection.update({
          where: { id: connection.id },
          data,
        });
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await db().googleConnection.update({
          where: { id: connection.id },
          data: { status: "disconnected", credentialVersion: { increment: 1 } },
        });
        let revoked = true;
        try {
          const tokens = decrypt<Credentials>(
            connection.encryptedTokens,
            ownerId + ":" + connection.googleSub,
          );
          const token = tokens.refresh_token ?? tokens.access_token;
          if (token) await googleClient().revokeToken(token);
        } catch {
          revoked = false;
        }
        await db().googleConnection.delete({ where: { id: connection.id } });
        return json({ ok: true, revoked });
      }
    }
    if (path[0] === "events" && path.length === 2 && method === "GET") {
      const row = await db().snapshotEvent.findFirst({
        where: {
          eventReferenceId: path[1],
          snapshot: {
            status: "active",
            source: {
              accessStatus: "available",
              connection: { ownerId, status: "connected" },
            },
          },
        },
        orderBy: { snapshot: { fetchedAt: "desc" } },
        select: { data: true },
      });
      if (!row) throw new AppError("EVENT_UNAVAILABLE", 404);
      return json(row.data);
    }
    if (route === "sync" && method === "POST") {
      const body = rangeSchema.parse(await request.json());
      const connections = await db().googleConnection.findMany({
        where: { ownerId, status: "connected" },
        select: { id: true },
      });
      await Promise.all(
        connections.map((c) =>
          enqueueSync({ ...body, ownerId, connectionId: c.id, discover: true }),
        ),
      );
      return json({ queued: true }, 202);
    }
    if (route === "sync/status" && method === "GET")
      return json(
        (await connectionsFor(ownerId)).map((c) => ({
          id: c.id,
          status: c.status,
          lastError: c.lastError,
        })),
      );
    if (route === "saved-views") {
      if (method === "GET")
        return json(await db().savedView.findMany({ where: { ownerId } }));
      if (method === "POST") {
        const data = z
          .object({
            name: z.string().trim().min(1).max(50),
            sourceIds: z.array(z.string()).max(100),
            mode: z.enum(["merged", "account", "compare"]),
          })
          .parse(await request.json());
        const count = await db().calendarSource.count({
          where: { id: { in: data.sourceIds }, connection: { ownerId } },
        });
        if (count !== data.sourceIds.length)
          throw new AppError("ACCESS_RESTRICTED", 403);
        return json(
          await db().savedView.create({ data: { ...data, ownerId } }),
        );
      }
    }
    if (path[0] === "saved-views" && path.length === 2 && method === "DELETE") {
      await db().savedView.deleteMany({ where: { id: path[1], ownerId } });
      return json({ ok: true });
    }
    throw new AppError("NOT_FOUND", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
