import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function MonitorPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  if ((await params).project !== "anutrium") notFound();
  redirect("/anutrium/monitor/ga4");
}
