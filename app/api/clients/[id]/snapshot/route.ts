import { serviceResponse } from "@/lib/api-response";
import { listRowsForClient } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await listRowsForClient("calculations", id));
}
