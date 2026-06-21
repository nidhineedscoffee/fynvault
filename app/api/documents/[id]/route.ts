import { serviceResponse } from "@/lib/api-response";
import { deleteRow, getRow } from "@/lib/mvp";
import { requireFirmRowAccess } from "@/lib/workspace-auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireFirmRowAccess(request, "documents", id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await getRow("documents", id));
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireFirmRowAccess(request, "documents", id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await deleteRow("documents", id));
}
