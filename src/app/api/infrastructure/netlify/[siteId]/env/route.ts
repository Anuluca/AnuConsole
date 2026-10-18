import { infrastructureJson, infrastructureRoute } from "@/lib/infrastructure-api";
import { validateEnv } from "@/lib/infrastructure-contract";
import { createEnv, listEnv } from "@/lib/infrastructure-providers";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: Request, { params }: Context) {
  return infrastructureRoute(request, false, async () => listEnv((await params).siteId));
}
export async function POST(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => createEnv((await params).siteId, validateEnv(await infrastructureJson(request))));
}
