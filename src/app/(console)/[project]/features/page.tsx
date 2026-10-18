import { HomeFeaturesPanel } from "@/components/home-features";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
export const metadata = { title: "功能调整" };
export default async function FeaturesPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  if ((await params).project !== "anutrium") notFound();
  return <HomeFeaturesPanel />;
}
