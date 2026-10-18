import { infrastructureJson, infrastructureRoute } from "@/lib/infrastructure-api";
import { validateDns } from "@/lib/infrastructure-contract";
import { deleteDns, writeDns } from "@/lib/infrastructure-providers";
type Context = { params: Promise<{ recordId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => writeDns(validateDns(await infrastructureJson(request)), (await params).recordId));
}
export async function DELETE(request: Request, { params }: Context) {
  return infrastructureRoute(request, true, async () => deleteDns((await params).recordId));
}
