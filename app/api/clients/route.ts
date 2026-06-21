import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { ClientSchema, createClient, listRows } from "@/lib/mvp";
import { requireFirmSession } from "@/lib/workspace-auth";

export async function GET(request: Request) {
  const session = await requireFirmSession(request);
  if (!session.ok) return serviceResponse(session);

  return serviceResponse(await listRows("clients", { firm_id: session.firmId }));
}

export async function POST(request: Request) {
  const session = await requireFirmSession(request);
  if (!session.ok) return serviceResponse(session);

  const body = await request.json().catch(() => null);
  const parsed = ClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid client payload.", issues: parsed.error.issues }, { status: 400 });
  }

  return serviceResponse(await createClient({ ...parsed.data, firmId: session.firmId }));
}
