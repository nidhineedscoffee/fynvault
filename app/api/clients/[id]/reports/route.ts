import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { ReportGenerateSchema, generateReport, listRowsForClient } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await listRowsForClient("reports", id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  const parsed = ReportGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid report payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  return serviceResponse(await generateReport(id, parsed.data));
}
