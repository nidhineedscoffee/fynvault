import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { EscalateSubmissionSchema, escalateSubmission } from "@/lib/submissions";
import { requireFirmSession } from "@/lib/workspace-auth";

export async function POST(request: Request) {
  const session = await requireFirmSession(request);
  if (!session.ok) return serviceResponse(session);
  const body = await request.json().catch(() => null);
  const parsed = EscalateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid escalation payload.", issues: parsed.error.issues }, { status: 400 });
  }
  return serviceResponse(await escalateSubmission(session.firmId, parsed.data));
}
