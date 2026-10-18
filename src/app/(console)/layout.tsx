import { requireAdmin } from "@/lib/auth";
import { ConsoleShell } from "@/components/console-shell";
import { developmentAuthBypass } from "@/lib/auth-policy";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <ConsoleShell developmentMode={developmentAuthBypass()}>{children}</ConsoleShell>;
}
