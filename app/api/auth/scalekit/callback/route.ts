import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { exchangeScalekitCode, scalekitCookieNames, validateScalekitState } from "@/lib/scalekit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?auth=error&reason=${encodeURIComponent(error)}`, env.NEXT_PUBLIC_APP_URL));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?auth=error&reason=missing_code", env.NEXT_PUBLIC_APP_URL));
  }

  const expectedState = request.headers.get("cookie")?.match(/(?:^|;\s*)finvault_scalekit_state=([^;]+)/)?.[1];
  const verifier = request.headers.get("cookie")?.match(/(?:^|;\s*)finvault_scalekit_verifier=([^;]+)/)?.[1];
  const stateValidation = validateScalekitState(state, expectedState ? decodeURIComponent(expectedState) : undefined);

  if (!stateValidation.ok) {
    return NextResponse.redirect(new URL(`/?auth=error&reason=${encodeURIComponent(stateValidation.reason)}`, env.NEXT_PUBLIC_APP_URL));
  }
  if (!verifier) {
    return NextResponse.redirect(new URL("/?auth=error&reason=missing_pkce_verifier", env.NEXT_PUBLIC_APP_URL));
  }

  const tokenResult = await exchangeScalekitCode(code, decodeURIComponent(verifier));
  if (!tokenResult.configured || !tokenResult.ok || !tokenResult.idToken) {
    return NextResponse.redirect(new URL("/?auth=error&reason=scalekit_token_exchange_failed", env.NEXT_PUBLIC_APP_URL));
  }

  const response = NextResponse.redirect(new URL("/?auth=connected", env.NEXT_PUBLIC_APP_URL));
  response.cookies.delete(scalekitCookieNames.state);
  response.cookies.delete(scalekitCookieNames.verifier);
  response.cookies.set(scalekitCookieNames.session, tokenResult.idToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: tokenResult.expiresIn ?? 60 * 60,
    path: "/"
  });

  return response;
}
