import { serviceResponse } from "@/lib/api-response";
import { getClientProcessing } from "@/lib/processing";
import { requireClientAccess } from "@/lib/workspace-auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await getClientProcessing(id));
}
