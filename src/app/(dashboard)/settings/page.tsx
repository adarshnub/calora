import type { Metadata } from "next";
import { PreferencesPage } from "@/features/settings/preferences";
export const metadata: Metadata = { title: "Settings" };
export default function Page() {
  return <PreferencesPage />;
}
