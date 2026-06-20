import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { IssueResolutionSchema, getRow, resolveValidationIssue } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await getRow("validation_issues", id));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = IssueResolutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid issue payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  return serviceResponse(await resolveValidationIssue(id, parsed.data));
}
