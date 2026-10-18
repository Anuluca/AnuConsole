import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { notFound, redirect } from "next/navigation";
export default async function InfrastructurePage({ params }: { params: Promise<{ project: string }> }) {
  await requireUser();
  const project = getProject((await params).project);
  if (!project) notFound();
  redirect(`/${project.id}/infrastructure/dns`);
}
