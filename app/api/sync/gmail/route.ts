import { NextResponse } from "next/server";
import { env, missingProviderVars } from "@/lib/env";
import { completeOAuthDataSourceConnection } from "@/lib/consent";
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
    return NextResponse.json({ status: "error", provider: "gmail", error }, { status: 400 });
  }

  if (!code) {
    const oauthUrl = getGoogleOAuthUrl({ provider: "gmail", clientId: clientId ?? undefined, organizationId: organizationId ?? undefined });

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

  const stateValidation = validateOAuthState(state, "gmail");
  if (!stateValidation.ok) {
    return NextResponse.json({ status: "error", provider: "gmail", error: stateValidation.reason }, { status: 400 });
  }

  const tokenResult = await exchangeGoogleCode(code, "gmail");

  if (!tokenResult.configured) {
    return NextResponse.json({ status: "setup_required", provider: "gmail", missing: tokenResult.missing }, { status: 503 });
  }

  if (!tokenResult.ok) {
    return NextResponse.json({ status: "error", provider: "gmail", tokenResult }, { status: 502 });
  }
  if (!tokenResult.accessToken) {
    return NextResponse.json(
      { status: "error", provider: "gmail", error: "Provider did not return an access token.", tokenResult },
      { status: 502 }
    );
  }

  const resolvedClientId = clientId ?? stateValidation.payload.clientId ?? undefined;
  const resolvedOrganizationId = organizationId ?? stateValidation.payload.organizationId ?? undefined;
  if (resolvedOrganizationId && !UUID_PATTERN.test(resolvedOrganizationId)) {
    return NextResponse.json({ status: "error", provider: "gmail", error: "organizationId must be a valid UUID." }, { status: 400 });
  }
  if (resolvedClientId && !UUID_PATTERN.test(resolvedClientId)) {
    return NextResponse.json({ status: "error", provider: "gmail", error: "clientId must be a valid UUID." }, { status: 400 });
  }

  const expiresAt = tokenResult.expiresIn ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString() : undefined;
  const persistence = await persistIntegrationConnection({
    provider: "gmail",
    organizationId: resolvedOrganizationId,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt
  });
  const clientConnection = resolvedClientId
    ? await completeOAuthDataSourceConnection(resolvedClientId, {
        sourceType: "gmail",
        provider: "Gmail",
        expiresAt,
        accessTokenReceived: Boolean(tokenResult.accessToken),
        refreshTokenReceived: Boolean(tokenResult.refreshToken),
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        capabilities: ["gmail.readonly", "financial_email_filters", "attachment_collection"]
      })
    : { ok: false as const, status: 400, error: "clientId is required to attach Gmail to a client." };

  if (clientConnection.ok) {
    return NextResponse.redirect(new URL("/?integration=gmail&status=connected", env.NEXT_PUBLIC_APP_URL));
  }

  return NextResponse.json({
    status: "connected",
    provider: "gmail",
    persistence,
    clientConnection,
    normalizedEntities: [
      "customer_emails",
      "vendor_emails",
      "invoice_emails",
      "payment_reminders",
      "collections_activity",
      "contract_renewals",
      "attachments"
    ],
    nextStep: "Fetch permitted Gmail threads, classify finance communication, and attach evidence to graph entities.",
    notes:
      !resolvedOrganizationId && persistence.persisted === false
        ? "Pass ?organizationId=<uuid> in the OAuth flow callback URL to persist credentials."
        : undefined
  });
}
