import { serviceResponse } from "@/lib/api-response";
import { listProcessingJobs } from "@/lib/processing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return serviceResponse(await listProcessingJobs(url.searchParams.get("clientId") ?? undefined));
}
