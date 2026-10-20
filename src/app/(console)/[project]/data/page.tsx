import { DataContent } from "@/components/data-content";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";

export const metadata = { title: "数据维护" };

export default async function DataPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const user = await requireUser();
  if ((await params).project !== "anutrium") notFound();

  return <DataContent canEdit={user.role === "admin"} />;
}
