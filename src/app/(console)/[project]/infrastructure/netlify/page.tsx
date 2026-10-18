import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { NetlifyManager } from "@/components/infrastructure/netlify-manager";
import { identifier } from "@/lib/infrastructure-contract";
import { notFound } from "next/navigation";
export const metadata = { title: "部署管理" };
export default async function NetlifyPage({ params, searchParams }: { params: Promise<{ project: string }>; searchParams: Promise<{ site?: string }> }) {
  const user = await requireUser();
  const project = getProject((await params).project);
  if (!project) notFound();
  const site = (await searchParams).site;
  if (site !== undefined) {
    try { identifier(site); } catch { notFound(); }
  }
  return <NetlifyManager writable={user.role === "admin"} siteId={site} projectId={project.id} />;
}
