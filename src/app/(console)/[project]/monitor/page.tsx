import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function MonitorPage({ params }: { params: Promise<{ project: string }> }) {
  await requireUser();
  if ((await params).project !== "anutrium") notFound();
  redirect("/anutrium/monitor/ga4");
}
