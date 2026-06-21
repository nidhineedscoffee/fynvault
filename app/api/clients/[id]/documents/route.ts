import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { UploadDocumentSchema, listRowsForClient, uploadDocumentForClient } from "@/lib/mvp";
import { requireClientAccess } from "@/lib/workspace-auth";

async function clientIdFrom(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  return id.match(uuidPattern)?.[0] ?? new URL(request.url).pathname.match(uuidPattern)?.[0] ?? id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await clientIdFrom(_request, context);
  const access = await requireClientAccess(_request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await listRowsForClient("documents", id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = UploadDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid upload payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const id = await clientIdFrom(request, context);
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await uploadDocumentForClient(id, { ...parsed.data, firmId: access.firmId }));
}
