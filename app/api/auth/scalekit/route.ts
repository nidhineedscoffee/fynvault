import { NextResponse } from "next/server";
import { createPkcePair, createScalekitState, getScalekitSignupUrl, scalekitCookieNames } from "@/lib/scalekit";
import { missingProviderVars } from "@/lib/env";

export async function GET() {
  const state = createScalekitState();
  const pkce = createPkcePair();
  const signupUrl = getScalekitSignupUrl({ state, codeChallenge: pkce.challenge });

  if (!signupUrl) {
    return NextResponse.json({ status: "setup_required", provider: "scalekit", missing: missingProviderVars("scalekit") }, { status: 503 });
  }

  const response = NextResponse.redirect(signupUrl);
  response.cookies.set(scalekitCookieNames.state, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/"
  });
  response.cookies.set(scalekitCookieNames.verifier, pkce.verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/"
  });

  return response;
}
