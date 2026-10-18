import { infrastructureJson, infrastructureRoute } from "@/lib/infrastructure-api";
import { validateSiteSettings } from "@/lib/infrastructure-contract";
import { getNetlify, updateNetlify } from "@/lib/infrastructure-providers";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: Request, { params }: Context) {
  return infrastructureRoute(request, false, async () => getNetlify((await params).siteId));
}
export async function PATCH(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => updateNetlify((await params).siteId, validateSiteSettings(await infrastructureJson(request))));
}
