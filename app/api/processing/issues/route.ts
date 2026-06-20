import { serviceResponse } from "@/lib/api-response";
import { listValidationIssues } from "@/lib/processing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return serviceResponse(await listValidationIssues(url.searchParams.get("clientId") ?? undefined));
}
