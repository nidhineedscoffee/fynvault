import { serviceResponse } from "@/lib/api-response";
import { processDocument } from "@/lib/mvp";
import { requireFirmRowAccess } from "@/lib/workspace-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireFirmRowAccess(request, "documents", id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await processDocument(id));
}
