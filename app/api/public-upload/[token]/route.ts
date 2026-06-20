import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { UploadDocumentSchema, publicUpload } from "@/lib/mvp";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = UploadDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid upload payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { token } = await context.params;
  return serviceResponse(await publicUpload(token, parsed.data));
}
