import { serviceResponse } from "@/lib/api-response";
import { listPendingSubmissions } from "@/lib/submissions";
import { requireFirmSession } from "@/lib/workspace-auth";

export async function GET(request: Request) {
  const session = await requireFirmSession(request);
  if (!session.ok) return serviceResponse(session);
  const url = new URL(request.url);
  return serviceResponse(await listPendingSubmissions(session.firmId, {
    status: url.searchParams.get("status") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined
  }));
}
