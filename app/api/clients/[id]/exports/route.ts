import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { ExportGenerateSchema, generateExport, listRowsForClient } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await listRowsForClient("exports", id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = ExportGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid export payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  return serviceResponse(await generateExport(id, parsed.data));
}
