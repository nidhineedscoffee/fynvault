import { serviceResponse } from "@/lib/api-response";
import { updateRow } from "@/lib/mvp";
import { requireFirmRowAccess } from "@/lib/workspace-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireFirmRowAccess(request, "reports", id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await updateRow("reports", id, { status: "published", published_to_client: true, published_at: new Date().toISOString() }));
}
