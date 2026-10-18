import { EmptyPage } from "@/components/empty-page";
import { notFound } from "next/navigation";
export const metadata = { title: "功能调整" };
export default async function FeaturesPage({ params }: { params: Promise<{ project: string }> }) {
  if ((await params).project !== "anutrium") notFound();
  return <EmptyPage label="功能调整" />;
}
