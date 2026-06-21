import { serviceResponse } from "@/lib/api-response";
import { retryProcessingJob } from "@/lib/processing";
import { requireProcessingJobAccess } from "@/lib/workspace-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireProcessingJobAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await retryProcessingJob(id));
}
