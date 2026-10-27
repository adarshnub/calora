import { configurationStatus, isLocalSetup } from "@/lib/server/config";
import { SignIn } from "./sign-in";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <SignIn ready={configurationStatus().ready} localSetup={isLocalSetup()} />
  );
}
