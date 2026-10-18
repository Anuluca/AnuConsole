import { infrastructureJson, infrastructureRoute, pageNumber } from "@/lib/infrastructure-api";
import { invalid, object } from "@/lib/infrastructure-contract";
import { listDeploys, restoreDeploy, triggerBuild } from "@/lib/infrastructure-providers";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: Request, { params }: Context) {
  return infrastructureRoute(request, false, async () => listDeploys((await params).siteId, pageNumber(request)));
}
export async function POST(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => {
    const input = await infrastructureJson(request);
    if (!object(input)) invalid();
    const { siteId } = await params;
    if (input.action === "build" && Object.keys(input).every(key => ["action", "branch", "clear_cache"].includes(key)) &&
      typeof input.branch === "string" && input.branch.length <= 255 && typeof input.clear_cache === "boolean")
      return triggerBuild(siteId, input.branch, input.clear_cache);
    if (input.action === "restore" && Object.keys(input).length === 2 && typeof input.deployId === "string") return restoreDeploy(siteId, input.deployId);
    invalid();
  });
}
