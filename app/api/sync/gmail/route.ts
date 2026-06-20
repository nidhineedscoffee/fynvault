import { NextResponse } from "next/server";
import { missingProviderVars } from "@/lib/env";
import { exchangeGoogleCode, getGoogleOAuthUrl } from "@/lib/integrations/normalizers";
import { persistIntegrationConnection } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json({ status: "error", provider: "gmail", error }, { status: 400 });
  }

  if (!code) {
    const oauthUrl = getGoogleOAuthUrl();

    if (!oauthUrl) {
      return NextResponse.json(
        {
          status: "setup_required",
          provider: "gmail",
          missing: missingProviderVars("google"),
          redirectUri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/sync/gmail`
        },
        { status: 503 }
      );
    }

    return NextResponse.redirect(oauthUrl);
  }

  const tokenResult = await exchangeGoogleCode(code);

  if (!tokenResult.configured) {
    return NextResponse.json({ status: "setup_required", provider: "gmail", missing: tokenResult.missing }, { status: 503 });
  }

  if (!tokenResult.ok) {
    return NextResponse.json({ status: "error", provider: "gmail", tokenResult }, { status: 502 });
  }

  const expiresAt = tokenResult.expiresIn ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString() : undefined;
  const persistence = await persistIntegrationConnection({
    provider: "gmail",
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt
  });

  return NextResponse.json({
    status: "connected",
    provider: "gmail",
    persistence,
    normalizedEntities: [
      "customer_emails",
      "vendor_emails",
      "invoice_emails",
      "payment_reminders",
      "collections_activity",
      "contract_renewals",
      "attachments"
    ],
    nextStep: "Fetch permitted Gmail threads, classify finance communication, and attach evidence to graph entities."
  });
}
