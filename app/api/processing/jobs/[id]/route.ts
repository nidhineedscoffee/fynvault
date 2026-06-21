import { serviceResponse } from "@/lib/api-response";
import { getProcessingJob } from "@/lib/processing";
import { requireProcessingJobAccess } from "@/lib/workspace-auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireProcessingJobAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await getProcessingJob(id));
}
