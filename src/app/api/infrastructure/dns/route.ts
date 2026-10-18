import { infrastructureJson, infrastructureRoute, pageNumber } from "@/lib/infrastructure-api";
import { validateDns } from "@/lib/infrastructure-contract";
import { listDns, writeDns } from "@/lib/infrastructure-providers";

export async function GET(request: Request) {
  return infrastructureRoute(request, false, async () => {
    const query = new URL(request.url).searchParams;
    return listDns(pageNumber(request), query.get("search") ?? "", query.get("type") ?? "");
  });
}
export async function POST(request: Request) {
  return infrastructureRoute(request, true, async () => writeDns(validateDns(await infrastructureJson(request))));
}
