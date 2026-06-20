import { NextResponse } from "next/server";
import { scalekitCookieNames } from "@/lib/scalekit";

function readCookie(request: Request, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`))?.[1];
}

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const sessionCookie = readCookie(request, scalekitCookieNames.session);
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false });
  }

  const payload = decodeJwtPayload(decodeURIComponent(sessionCookie));
  if (!payload || (typeof payload.exp === "number" && payload.exp * 1000 < Date.now())) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.preferred_username
    }
  });
}
