import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { scalekitCookieNames } from "@/lib/scalekit";

export async function GET() {
  const response = NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_APP_URL));
  response.cookies.delete(scalekitCookieNames.session);
  return response;
}
