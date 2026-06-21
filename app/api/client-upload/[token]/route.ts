import { serviceResponse } from "@/lib/api-response";
import { getClientUploadLink } from "@/lib/submissions";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  return serviceResponse(await getClientUploadLink(token));
}
