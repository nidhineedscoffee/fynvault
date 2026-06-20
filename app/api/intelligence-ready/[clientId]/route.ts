import { serviceResponse } from "@/lib/api-response";
import { getIntelligenceReadiness } from "@/lib/processing";

export async function GET(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await context.params;
  return serviceResponse(await getIntelligenceReadiness(clientId));
}
