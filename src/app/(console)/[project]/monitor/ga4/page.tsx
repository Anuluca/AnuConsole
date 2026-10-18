import { requireAdmin } from "@/lib/auth";
import { MonitorDashboard } from "@/components/monitor-dashboard";
import { notFound } from "next/navigation";

export const metadata = { title: "GA4浏览量" };

export default async function Ga4Page({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  if ((await params).project !== "anutrium") notFound();
  return <MonitorDashboard />;
}
