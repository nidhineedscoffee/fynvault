import type { Bill, EmailThread, Expense, Invoice, Payment } from "../types";
import { env, hasGoogleConfig, hasZohoConfig, missingProviderVars } from "../env";

export type ZohoSyncResult = {
  customers: number;
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  bills: Bill[];
  reports: string[];
};

export type GmailSyncResult = {
  threads: EmailThread[];
  categories: string[];
};

function oauthState(provider: "zoho" | "gmail") {
  return Buffer.from(JSON.stringify({ provider, createdAt: Date.now() })).toString("base64url");
}

export function getZohoRedirectUri() {
  return `${env.NEXT_PUBLIC_APP_URL}/api/sync/zoho`;
}

export function getGoogleRedirectUri() {
  return `${env.NEXT_PUBLIC_APP_URL}/api/sync/gmail`;
}

export function getZohoOAuthUrl() {
  if (!hasZohoConfig()) {
    return null;
  }

  const scope = "ZohoBooks.fullaccess.all";
  const url = new URL("/oauth/v2/auth", env.ZOHO_ACCOUNTS_BASE_URL);
  url.searchParams.set("scope", scope);
  url.searchParams.set("client_id", env.ZOHO_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", oauthState("zoho"));
  url.searchParams.set("redirect_uri", getZohoRedirectUri());
  return url.toString();
}

export function getGoogleOAuthUrl() {
  if (!hasGoogleConfig()) {
    return null;
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", getGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", oauthState("gmail"));
  url.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/gmail.readonly");
  return url.toString();
}

export async function exchangeZohoCode(code: string) {
  if (!hasZohoConfig()) {
    return {
      configured: false,
      missing: missingProviderVars("zoho")
    };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.ZOHO_CLIENT_ID ?? "",
    client_secret: env.ZOHO_CLIENT_SECRET ?? "",
    redirect_uri: getZohoRedirectUri(),
    code
  });

  const response = await fetch(new URL("/oauth/v2/token", env.ZOHO_ACCOUNTS_BASE_URL), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      configured: true,
      ok: false,
      status: response.status,
      error: payload
    };
  }

  return {
    configured: true,
    ok: true,
    accessToken: payload.access_token as string | undefined,
    refreshToken: payload.refresh_token as string | undefined,
    expiresIn: payload.expires_in as number | undefined,
    apiDomain: payload.api_domain as string | undefined
  };
}

export async function exchangeGoogleCode(code: string) {
  if (!hasGoogleConfig()) {
    return {
      configured: false,
      missing: missingProviderVars("google")
    };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: getGoogleRedirectUri(),
    code
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      configured: true,
      ok: false,
      status: response.status,
      error: payload
    };
  }

  return {
    configured: true,
    ok: true,
    accessToken: payload.access_token as string | undefined,
    refreshToken: payload.refresh_token as string | undefined,
    expiresIn: payload.expires_in as number | undefined,
    idToken: payload.id_token as string | undefined
  };
}
