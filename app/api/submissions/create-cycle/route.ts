import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { CreateSubmissionCycleSchema, createSubmissionCycle } from "@/lib/submissions";
import { requireFirmSession } from "@/lib/workspace-auth";

export async function POST(request: Request) {
  const session = await requireFirmSession(request);
  if (!session.ok) return serviceResponse(session);
  const body = await request.json().catch(() => null);
  const parsed = CreateSubmissionCycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid submission cycle payload.", issues: parsed.error.issues }, { status: 400 });
  }
  return serviceResponse(await createSubmissionCycle({ ...parsed.data, firmId: session.firmId }));
}
