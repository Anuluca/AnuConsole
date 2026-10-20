import { infrastructureRoute } from "@/lib/infrastructure-api";
import { getInfrastructureConnections } from "@/lib/infrastructure-providers";

export async function GET(request: Request) {
  return infrastructureRoute(request, false, getInfrastructureConnections);
}
