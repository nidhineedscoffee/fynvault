import { serviceResponse } from "@/lib/api-response";
import { createUploadLink } from "@/lib/mvp";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await createUploadLink(id));
}
