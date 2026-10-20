import { EmptyPage } from "@/components/empty-page";
import { HomeContent } from "@/components/home-content";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "首页" };
export default async function HomePage({ params }: { params: Promise<{ project: string }> }) {
  const user = await requireUser();
  if ((await params).project !== "anutrium") return <EmptyPage label="首页" />;
  return <HomeContent canEdit={user.role === "admin"} />;
}
