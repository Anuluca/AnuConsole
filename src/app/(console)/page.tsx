import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function HomePage() {
  await requireAdmin();
  redirect("/anutrium");
}
