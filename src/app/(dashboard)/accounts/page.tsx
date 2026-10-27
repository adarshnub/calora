import type { Metadata } from "next";
import { Accounts } from "@/features/accounts/accounts";
export const metadata: Metadata = { title: "Accounts" };
export default function Page() {
  return <Accounts />;
}
