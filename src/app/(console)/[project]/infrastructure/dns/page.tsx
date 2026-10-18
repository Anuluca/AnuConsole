import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { DnsManager } from "@/components/infrastructure/dns-manager";
import { notFound } from "next/navigation";
export const metadata = { title: "域名解析" };
export default async function DnsPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await requireUser();
  if (!getProject((await params).project)) notFound();
  return <DnsManager writable={user.role === "admin"} />;
}
