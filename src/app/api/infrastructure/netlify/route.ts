import { infrastructureJson, infrastructureRoute, pageNumber } from "@/lib/infrastructure-api";
import { validateNetlifyCreate } from "@/lib/infrastructure-contract";
import { createNetlify, listNetlify } from "@/lib/infrastructure-providers";
export async function GET(request: Request) {
  return infrastructureRoute(request, false, async () => listNetlify(pageNumber(request)));
}
export async function POST(request: Request) {
  return infrastructureRoute(request, true, async () => createNetlify(validateNetlifyCreate(await infrastructureJson(request))));
}
