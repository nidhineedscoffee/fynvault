import { createHmac } from "crypto";
import { env } from "./env";

type Bucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, Bucket>();

function getNow() {
  return Date.now();
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function enforceRateLimit(input: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = getNow();
  const bucketKey = `${input.scope}:${input.key}`;
  const current = rateBuckets.get(bucketKey);

  if (!current || now > current.resetAt) {
    const next = { count: 1, resetAt: now + input.windowMs };
    rateBuckets.set(bucketKey, next);
    return { allowed: true as const, remaining: input.limit - 1, resetAt: next.resetAt };
  }

  if (current.count >= input.limit) {
    return { allowed: false as const, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  rateBuckets.set(bucketKey, current);
  return { allowed: true as const, remaining: Math.max(0, input.limit - current.count), resetAt: current.resetAt };
}

export function isTrustedOrigin(request: Request) {
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const allowedHost = new URL(appUrl).host;
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === allowedHost;
  } catch {
    return false;
  }
}

function oauthSecret() {
  return env.OAUTH_STATE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "finvault_dev_oauth_state_secret";
}

export function signOAuthState(payloadBase64Url: string) {
  return createHmac("sha256", oauthSecret()).update(payloadBase64Url).digest("base64url");
}

export function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
