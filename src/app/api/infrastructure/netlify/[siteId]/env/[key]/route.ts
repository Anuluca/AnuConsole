import { infrastructureJson, infrastructureRoute } from "@/lib/infrastructure-api";
import { envKey, validateEnv, validateEnvValue } from "@/lib/infrastructure-contract";
import { removeEnv, updateEnv } from "@/lib/infrastructure-providers";
type Context = { params: Promise<{ siteId: string; key: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => {
    const { siteId, key } = await params;
    return updateEnv(siteId, envKey(key), validateEnvValue(await infrastructureJson(request)), false);
  });
}
export async function PUT(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => {
    const { siteId, key } = await params;
    return updateEnv(siteId, envKey(key), validateEnv(await infrastructureJson(request)), true);
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => {
    const { siteId, key } = await params;
    return removeEnv(siteId, envKey(key), new URL(request.url).searchParams.get("valueId") ?? undefined);
  });
}
