import { serviceResponse } from "@/lib/api-response";
import { updateRow } from "@/lib/mvp";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await updateRow("reports", id, { status: "published", published_to_client: true, published_at: new Date().toISOString() }));
}
