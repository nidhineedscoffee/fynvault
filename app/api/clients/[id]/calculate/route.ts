import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { CalculationSchema, calculateFinancialSnapshot } from "@/lib/mvp";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  const parsed = CalculationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid calculation payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  return serviceResponse(await calculateFinancialSnapshot(id, parsed.data));
}
