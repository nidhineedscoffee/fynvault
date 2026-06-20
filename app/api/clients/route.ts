import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { ClientSchema, createClient, listRows } from "@/lib/mvp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const firmId = searchParams.get("firmId") ?? undefined;
  return serviceResponse(await listRows("clients", firmId ? { firm_id: firmId } : {}));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid client payload.", issues: parsed.error.issues }, { status: 400 });
  }

  return serviceResponse(await createClient(parsed.data));
}
