import { infrastructureRoute, pageNumber } from "@/lib/infrastructure-api";
import { listGitHubRepositories } from "@/lib/infrastructure-providers";
export async function GET(request: Request) {
  return infrastructureRoute(request, false, async () => listGitHubRepositories(pageNumber(request)));
}
