import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { AskMvpSchema } from "@/lib/mvp";
import { handleAskQuestion } from "@/lib/ask-orchestrator";
import { requireClientAccess } from "@/lib/workspace-auth";

async function clientIdFrom(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  return id.match(uuidPattern)?.[0] ?? new URL(request.url).pathname.match(uuidPattern)?.[0] ?? id;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = AskMvpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid Ask Fynny payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const id = await clientIdFrom(request, context);
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await handleAskQuestion(id, { ...parsed.data, firmId: access.firmId }));
}
