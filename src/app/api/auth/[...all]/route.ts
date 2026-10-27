import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth";
import { configurationStatus } from "@/lib/server/config";
import { json } from "@/lib/server/http";
async function handler(request: Request) {
  if (!configurationStatus().ready)
    return json({ error: { code: "CONFIGURATION_REQUIRED" } }, 503);
  const handlers = toNextJsHandler(auth());
  return request.method === "GET"
    ? handlers.GET(request)
    : handlers.POST(request);
}
export { handler as GET, handler as POST };
