import { serviceResponse } from "@/lib/api-response";
import { getProcessingOverview } from "@/lib/processing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return serviceResponse(await getProcessingOverview(url.searchParams.get("clientId") ?? undefined));
}
