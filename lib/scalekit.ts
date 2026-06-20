import { createHash, randomBytes } from "crypto";
import { env, hasScalekitConfig, missingProviderVars } from "./env";
import { signOAuthState, timingSafeEqualString } from "./security";

export const scalekitCookieNames = {
  state: "finvault_scalekit_state",
  verifier: "finvault_scalekit_verifier",
  session: "finvault_session"
} as const;

export function getScalekitRedirectUri() {
  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/scalekit/callback`;
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createScalekitState() {
  const payload = Buffer.from(JSON.stringify({ provider: "scalekit", createdAt: Date.now() })).toString("base64url");
  return `${payload}.${signOAuthState(payload)}`;
}

export function validateScalekitState(state: string | null, expectedState: string | undefined) {
  if (!state || !expectedState || !timingSafeEqualString(state, expectedState)) {
    return { ok: false as const, reason: "Missing or invalid ScaleKit state." };
  }

  const [payload, signature] = state.split(".");
  if (!payload || !signature || !timingSafeEqualString(signOAuthState(payload), signature)) {
    return { ok: false as const, reason: "ScaleKit state signature mismatch." };
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const maxAgeMs = 10 * 60 * 1000;
    if (parsed.provider !== "scalekit" || typeof parsed.createdAt !== "number" || Date.now() - parsed.createdAt > maxAgeMs) {
      return { ok: false as const, reason: "ScaleKit state expired. Restart signup." };
    }
  } catch {
    return { ok: false as const, reason: "ScaleKit state could not be decoded." };
  }

  return { ok: true as const };
}

export function getScalekitSignupUrl(input: { state: string; codeChallenge: string }) {
  if (!hasScalekitConfig()) {
    return null;
  }

  const url = new URL("/oauth/authorize", env.SCALEKIT_ENVIRONMENT_URL);
  url.searchParams.set("client_id", env.SCALEKIT_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", getScalekitRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile offline_access");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeScalekitCode(code: string, verifier: string) {
  if (!hasScalekitConfig()) {
    return { configured: false as const, missing: missingProviderVars("scalekit") };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.SCALEKIT_CLIENT_ID ?? "",
    client_secret: env.SCALEKIT_CLIENT_SECRET ?? "",
    redirect_uri: getScalekitRedirectUri(),
    code,
    code_verifier: verifier
  });

  try {
    const response = await fetch(new URL("/oauth/token", env.SCALEKIT_ENVIRONMENT_URL), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { configured: true as const, ok: false as const, status: response.status, error: payload };
    }

    return {
      configured: true as const,
      ok: true as const,
      accessToken: payload.access_token as string | undefined,
      idToken: payload.id_token as string | undefined,
      refreshToken: payload.refresh_token as string | undefined,
      expiresIn: payload.expires_in as number | undefined
    };
  } catch (error) {
    return {
      configured: true as const,
      ok: false as const,
      error: `Network error while exchanging ScaleKit code: ${error instanceof Error ? error.message : "unknown error"}`
    };
  }
}
