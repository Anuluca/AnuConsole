import { requireUser } from "@/lib/auth";
import { ConsoleShell } from "@/components/console-shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <ConsoleShell user={user}>{children}</ConsoleShell>;
}
