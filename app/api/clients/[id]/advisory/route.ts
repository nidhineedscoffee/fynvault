import { serviceResponse } from "@/lib/api-response";
import { generateAdvisory, listRowsForClient } from "@/lib/mvp";
import { requireClientAccess } from "@/lib/workspace-auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await listRowsForClient("advisory_opportunities", id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await generateAdvisory(id, access.firmId ?? body?.firmId));
}
