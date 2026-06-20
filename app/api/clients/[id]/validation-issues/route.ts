import { serviceResponse } from "@/lib/api-response";
import { listValidationIssues } from "@/lib/processing";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await listValidationIssues(id));
}
