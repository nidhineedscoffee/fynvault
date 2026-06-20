import { serviceResponse } from "@/lib/api-response";
import { processDocument } from "@/lib/mvp";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await processDocument(id));
}
