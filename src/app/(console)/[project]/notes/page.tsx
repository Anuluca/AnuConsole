import { NotesManager } from "@/components/notes-manager";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
export const metadata = { title: "笔记管理" };
export default async function NotesPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await requireUser();
  if ((await params).project !== "anutrium") notFound();
  return <NotesManager canEdit={user.role === "admin"} />;
}
