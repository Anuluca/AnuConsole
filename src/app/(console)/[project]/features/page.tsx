import { HomeFeaturesPanel } from "@/components/home-features";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
export const metadata = { title: "功能调整" };
export default async function FeaturesPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await requireUser();
  if ((await params).project !== "anutrium") notFound();
  return <HomeFeaturesPanel canEdit={user.role === "admin"} />;
}
