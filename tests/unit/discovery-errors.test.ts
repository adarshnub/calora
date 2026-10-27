import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncConnection } from "../../src/lib/server/sync";
import { googleGet } from "../../src/lib/server/google";
import { AppError } from "../../src/lib/server/http";

const database = vi.hoisted(() => ({
  googleConnection: { findFirst: vi.fn(), updateMany: vi.fn() },
  calendarSource: { updateMany: vi.fn() },
  calendarSnapshot: { deleteMany: vi.fn() },
}));
vi.mock("@/lib/server/db", () => ({ db: () => database }));
vi.mock("@/lib/server/google", async (original) => ({
  ...(await original<typeof import("../../src/lib/server/google")>()),
  googleGet: vi.fn(),
}));

const job = {
  ownerId: "owner",
  connectionId: "connection",
  start: "2026-10-26",
  end: "2026-11-02",
  timeZone: "Asia/Kolkata",
  discover: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  database.googleConnection.findFirst.mockResolvedValue({
    id: job.connectionId,
    ownerId: job.ownerId,
    credentialVersion: 1,
    status: "connected",
  });
  database.googleConnection.updateMany.mockResolvedValue({ count: 1 });
  database.calendarSource.updateMany.mockResolvedValue({ count: 0 });
  database.calendarSnapshot.deleteMany.mockResolvedValue({ count: 0 });
});

describe("calendar discovery errors", () => {
  it("records disabled API setup without revoking account access or repeatedly retrying", async () => {
    vi.mocked(googleGet).mockRejectedValue(
      new AppError("CALENDAR_API_DISABLED", 403),
    );
    await expect(syncConnection(job)).resolves.toBeUndefined();
    expect(database.googleConnection.updateMany).toHaveBeenCalledWith({
      where: { id: job.connectionId },
      data: { lastError: "CALENDAR_API_DISABLED" },
    });
    expect(database.calendarSource.updateMany).not.toHaveBeenCalled();
    expect(database.calendarSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("records permission failures even when no calendars have been discovered", async () => {
    vi.mocked(googleGet).mockRejectedValue(
      new AppError("ACCESS_RESTRICTED", 403),
    );
    await syncConnection(job);
    expect(database.googleConnection.updateMany).toHaveBeenCalledWith({
      where: { id: job.connectionId, credentialVersion: 1 },
      data: { lastError: "ACCESS_RESTRICTED" },
    });
    expect(database.calendarSource.updateMany).toHaveBeenCalled();
  });

  it("keeps rate-limit failures retryable while recording their state", async () => {
    vi.mocked(googleGet).mockRejectedValue(
      new AppError("RATE_LIMITED", 429, 30),
    );
    await expect(syncConnection(job)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(database.googleConnection.updateMany).toHaveBeenCalledWith({
      where: { id: job.connectionId },
      data: { lastError: "RATE_LIMITED" },
    });
  });
});
