import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { FirmSchema, createFirm, listRows } from "@/lib/mvp";

export async function GET() {
  return serviceResponse(await listRows("firms"));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = FirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid firm payload.", issues: parsed.error.issues }, { status: 400 });
  }

  return serviceResponse(await createFirm(parsed.data));
}
