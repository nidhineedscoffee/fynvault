import type { Bill, EmailThread, Expense, Invoice, Payment } from "../types";
import { env, hasGoogleConfig, hasZohoConfig, missingProviderVars } from "../env";
import { signOAuthState, timingSafeEqualString } from "../security";

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

type OAuthProvider = "zoho" | "gmail";

type OAuthStatePayload = {
  provider: OAuthProvider;
  createdAt: number;
};

type TokenExchangeFailure = {
  configured: true;
  ok: false;
  status?: number;
  error: unknown;
};

function oauthState(provider: OAuthProvider) {
  const payload = Buffer.from(JSON.stringify({ provider, createdAt: Date.now() })).toString("base64url");
  const sig = signOAuthState(payload);
  return `${payload}.${sig}`;
}

export function decodeOAuthState(state: string | null): OAuthStatePayload | null {
  if (!state) {
    return null;
  }

  try {
    const [payload, sig] = state.split(".");
    if (!payload || !sig) {
      return null;
    }

    const expectedSig = signOAuthState(payload);
    if (!timingSafeEqualString(sig, expectedSig)) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      parsed &&
      (parsed.provider === "zoho" || parsed.provider === "gmail") &&
      typeof parsed.createdAt === "number"
    ) {
      return parsed as OAuthStatePayload;
    }
    return null;
  } catch {
    return null;
  }
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

async function parseResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const raw = await response.text();

  if (!raw) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function isFreshOAuthState(payload: OAuthStatePayload | null) {
  if (!payload) {
    return false;
  }

  const maxAgeMs = 10 * 60 * 1000;
  return Date.now() - payload.createdAt <= maxAgeMs;
}

export function validateOAuthState(state: string | null, expectedProvider: OAuthProvider) {
  const payload = decodeOAuthState(state);
  if (!payload) {
    return { ok: false as const, reason: "Missing or invalid OAuth state." };
  }

  if (payload.provider !== expectedProvider) {
    return { ok: false as const, reason: "OAuth state provider mismatch." };
  }

  if (!isFreshOAuthState(payload)) {
    return { ok: false as const, reason: "OAuth state expired. Restart the connection flow." };
  }

  return { ok: true as const };
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

  let response: Response;
  try {
    response = await fetch(new URL("/oauth/v2/token", env.ZOHO_ACCOUNTS_BASE_URL), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: `Network error while exchanging Zoho code: ${error instanceof Error ? error.message : "unknown error"}`
    } satisfies TokenExchangeFailure;
  }

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    return {
      configured: true,
      ok: false,
      status: response.status,
      error: payload
    } satisfies TokenExchangeFailure;
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

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: `Network error while exchanging Google code: ${error instanceof Error ? error.message : "unknown error"}`
    } satisfies TokenExchangeFailure;
  }

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    return {
      configured: true,
      ok: false,
      status: response.status,
      error: payload
    } satisfies TokenExchangeFailure;
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
