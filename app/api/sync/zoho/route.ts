import { NextResponse } from "next/server";
import { missingProviderVars } from "@/lib/env";
import { exchangeZohoCode, getZohoOAuthUrl } from "@/lib/integrations/normalizers";
import { persistIntegrationConnection } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

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

  const tokenResult = await exchangeZohoCode(code);

  if (!tokenResult.configured) {
    return NextResponse.json({ status: "setup_required", provider: "zoho", missing: tokenResult.missing }, { status: 503 });
  }

  if (!tokenResult.ok) {
    return NextResponse.json({ status: "error", provider: "zoho", tokenResult }, { status: 502 });
  }

  const expiresAt = tokenResult.expiresIn ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString() : undefined;
  const persistence = await persistIntegrationConnection({
    provider: "zoho",
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
    nextStep: "Fetch Zoho Books modules and upsert normalized graph entities into Supabase."
  });
}
