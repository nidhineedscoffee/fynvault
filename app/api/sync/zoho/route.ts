import { NextResponse } from "next/server";
import { missingProviderVars } from "@/lib/env";
import { exchangeZohoCode, getZohoOAuthUrl, validateOAuthState } from "@/lib/integrations/normalizers";
import { persistIntegrationConnection } from "@/lib/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const organizationId = url.searchParams.get("organizationId");

  if (error) {
    return NextResponse.json({ status: "error", provider: "zoho", error }, { status: 400 });
  }

  if (!code) {
    const oauthUrl = getZohoOAuthUrl();

    if (!oauthUrl) {
      return NextResponse.json(
        {
          status: "setup_required",
          provider: "zoho",
          missing: missingProviderVars("zoho"),
          redirectUri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/sync/zoho`
        },
        { status: 503 }
      );
    }

    return NextResponse.redirect(oauthUrl);
  }

  const stateValidation = validateOAuthState(state, "zoho");
  if (!stateValidation.ok) {
    return NextResponse.json({ status: "error", provider: "zoho", error: stateValidation.reason }, { status: 400 });
  }

  const tokenResult = await exchangeZohoCode(code);

  if (!tokenResult.configured) {
    return NextResponse.json({ status: "setup_required", provider: "zoho", missing: tokenResult.missing }, { status: 503 });
  }

  if (!tokenResult.ok) {
    return NextResponse.json({ status: "error", provider: "zoho", tokenResult }, { status: 502 });
  }
  if (!tokenResult.accessToken) {
    return NextResponse.json(
      { status: "error", provider: "zoho", error: "Provider did not return an access token.", tokenResult },
      { status: 502 }
    );
  }

  if (organizationId && !UUID_PATTERN.test(organizationId)) {
    return NextResponse.json({ status: "error", provider: "zoho", error: "organizationId must be a valid UUID." }, { status: 400 });
  }

  const expiresAt = tokenResult.expiresIn ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString() : undefined;
  const persistence = await persistIntegrationConnection({
    provider: "zoho",
    organizationId: organizationId ?? undefined,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt
  });

  return NextResponse.json({
    status: "connected",
    provider: "zoho",
    persistence,
    normalizedEntities: [
      "customers",
      "invoices",
      "payments",
      "expenses",
      "bills",
      "vendors",
      "profit_and_loss",
      "balance_sheet",
      "cash_flow",
      "receivables_aging",
      "payables_aging"
    ],
    nextStep: "Fetch Zoho Books modules and upsert normalized graph entities into Supabase.",
    notes:
      !organizationId && persistence.persisted === false
        ? "Pass ?organizationId=<uuid> in the OAuth flow callback URL to persist credentials."
        : undefined
  });
}
