import { serviceResponse } from "@/lib/api-response";
import { listDataSources } from "@/lib/consent";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await listDataSources(id));
}
