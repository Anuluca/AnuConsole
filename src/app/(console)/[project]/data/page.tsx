import { EmptyPage } from "@/components/empty-page";
import { notFound } from "next/navigation";
export const metadata = { title: "数据维护" };
export default async function DataPage({ params }: { params: Promise<{ project: string }> }) {
  if ((await params).project !== "anutrium") notFound();
  return <EmptyPage label="数据维护" />;
}
