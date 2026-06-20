import { serviceResponse } from "@/lib/api-response";
import { generateAdvisory, listRowsForClient } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await listRowsForClient("advisory_opportunities", id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { id } = await context.params;
  return serviceResponse(await generateAdvisory(id, body?.firmId));
}
