import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { configurationStatus, isLocalSetup } from "@/lib/server/config";
import { DEFAULT_PREFERENCES } from "@/lib/shared/types";
import { connectionsFor, preferencesFor } from "@/lib/server/data";
import { requireOwner } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setupRequired = isLocalSetup(),
    config = configurationStatus();
  let ownerId = "local-setup",
    name = "";
  if (!setupRequired) {
    if (!config.ready) redirect("/sign-in");
    try {
      const session = await requireOwner(await headers());
      ownerId = session.user.id;
      name = session.user.name.split(" ")[0];
    } catch {
      redirect("/sign-in");
    }
  }
  const [connections, preferences] = setupRequired
    ? [[], DEFAULT_PREFERENCES]
    : await Promise.all([connectionsFor(ownerId), preferencesFor(ownerId)]);
  return (
    <Workspace
      boot={{
        ownerId,
        setupRequired,
        name,
        connections,
        preferences,
        missing: config.missing,
      }}
    >
      {children}
    </Workspace>
  );
}
