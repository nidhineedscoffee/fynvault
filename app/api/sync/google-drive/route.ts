import { NextResponse } from "next/server";
import { missingProviderVars } from "@/lib/env";
import { exchangeGoogleCode, getGoogleOAuthUrl, validateOAuthState } from "@/lib/integrations/normalizers";
import { persistIntegrationConnection } from "@/lib/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const organizationId = url.searchParams.get("organizationId");
  const clientId = url.searchParams.get("clientId");

  if (error) {
    return NextResponse.json({ status: "error", provider: "google_drive", error }, { status: 400 });
  }

  if (!code) {
    const oauthUrl = getGoogleOAuthUrl({ provider: "google_drive", clientId: clientId ?? undefined, organizationId: organizationId ?? undefined });

    if (!oauthUrl) {
      return NextResponse.json(
        {
          status: "setup_required",
          provider: "google_drive",
          missing: missingProviderVars("google"),
          redirectUri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/sync/google-drive`
        },
        { status: 503 }
      );
    }

    return NextResponse.redirect(oauthUrl);
  }

  const stateValidation = validateOAuthState(state, "google_drive");
  if (!stateValidation.ok) {
    return NextResponse.json({ status: "error", provider: "google_drive", error: stateValidation.reason }, { status: 400 });
  }

  const tokenResult = await exchangeGoogleCode(code, "google_drive");

  if (!tokenResult.configured) {
    return NextResponse.json({ status: "setup_required", provider: "google_drive", missing: tokenResult.missing }, { status: 503 });
  }

  if (!tokenResult.ok) {
    return NextResponse.json({ status: "error", provider: "google_drive", tokenResult }, { status: 502 });
  }
  if (!tokenResult.accessToken) {
    return NextResponse.json(
      { status: "error", provider: "google_drive", error: "Provider did not return an access token.", tokenResult },
      { status: 502 }
    );
  }

  const resolvedOrganizationId = organizationId ?? stateValidation.payload.organizationId ?? stateValidation.payload.clientId ?? undefined;
  if (resolvedOrganizationId && !UUID_PATTERN.test(resolvedOrganizationId)) {
    return NextResponse.json({ status: "error", provider: "google_drive", error: "clientId must be a valid UUID." }, { status: 400 });
  }

  const expiresAt = tokenResult.expiresIn ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString() : undefined;
  const persistence = await persistIntegrationConnection({
    provider: "google",
    organizationId: resolvedOrganizationId,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt
  });

  return NextResponse.json({
    status: "connected",
    provider: "google_drive",
    persistence,
    normalizedEntities: ["folders", "financial_documents", "spreadsheets", "pdfs", "bank_statements", "gst_files"],
    nextStep: "Fetch approved Drive folders, classify finance files, and route them into Fynny processing."
  });
}
