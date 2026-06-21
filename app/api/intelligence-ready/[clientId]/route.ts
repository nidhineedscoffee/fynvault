import { serviceResponse } from "@/lib/api-response";
import { getIntelligenceReadiness } from "@/lib/processing";
import { requireClientAccess } from "@/lib/workspace-auth";

export async function GET(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await context.params;
  const access = await requireClientAccess(request, clientId);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await getIntelligenceReadiness(clientId));
}
