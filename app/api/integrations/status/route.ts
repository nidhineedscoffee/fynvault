import { NextResponse } from "next/server";
import { missingProviderVars, providerStatus } from "@/lib/env";
import { getGoogleOAuthUrl, getGoogleRedirectUri, getZohoOAuthUrl, getZohoRedirectUri } from "@/lib/integrations/normalizers";

export async function GET() {
  return NextResponse.json({
    providers: providerStatus(),
    oauth: {
      zoho: {
        authorizeUrl: getZohoOAuthUrl(),
        redirectUri: getZohoRedirectUri(),
        missing: missingProviderVars("zoho")
      },
      gmail: {
        authorizeUrl: getGoogleOAuthUrl(),
        redirectUri: getGoogleRedirectUri(),
        missing: missingProviderVars("google")
      }
    }
  });
}
