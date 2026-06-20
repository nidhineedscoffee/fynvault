import { NextResponse } from "next/server";
import { revokeConsent } from "@/lib/consent";
import { serviceResponse } from "@/lib/api-response";
import { enforceRateLimit, getClientIp, isTrustedOrigin } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Untrusted origin." }, { status: 403 });
  }

  const limit = enforceRateLimit({ scope: "consent_revoke", key: getClientIp(request), limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Please retry shortly." }, { status: 429 });
  }

  const { id } = await context.params;
  return serviceResponse(await revokeConsent(id));
}
