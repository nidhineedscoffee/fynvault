import { serviceResponse } from "@/lib/api-response";
import { getProcessingOverview } from "@/lib/processing";
import { requireClientAccess, requireFirmSession } from "@/lib/workspace-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  if (clientId) {
    const access = await requireClientAccess(request, clientId);
    if (!access.ok) return serviceResponse(access);
    return serviceResponse(await getProcessingOverview(clientId));
  }

  const session = await requireFirmSession(request);
  if (!session.ok) return serviceResponse(session);
  return serviceResponse(await getProcessingOverview(undefined, session.firmId));
}
