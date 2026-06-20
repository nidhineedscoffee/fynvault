import { serviceResponse } from "@/lib/api-response";
import { retryProcessingJob } from "@/lib/processing";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await retryProcessingJob(id));
}
