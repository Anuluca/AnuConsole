import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";

export default async function ProjectLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  // 无效项目不进入业务页面，避免把未知路径误当作默认项目。
  if (!getProject((await params).project)) notFound();
  return children;
}
