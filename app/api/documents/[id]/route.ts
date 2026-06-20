import { serviceResponse } from "@/lib/api-response";
import { deleteRow, getRow } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await getRow("documents", id));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await deleteRow("documents", id));
}
