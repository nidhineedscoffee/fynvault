import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceResponse } from "@/lib/api-response";
import { retryProcessingJob } from "@/lib/processing";
import { enforceRateLimit, getClientIp, isTrustedOrigin } from "@/lib/security";

const RetrySchema = z.object({
  jobId: z.string().uuid()
});

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Untrusted origin." }, { status: 403 });
  }

  const limit = enforceRateLimit({ scope: "processing_retry", key: getClientIp(request), limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Please retry shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = RetrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request payload.", issues: parsed.error.issues }, { status: 400 });
  }

  return serviceResponse(await retryProcessingJob(parsed.data.jobId));
}
