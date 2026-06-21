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
        authorizeUrl: getGoogleOAuthUrl({ provider: "gmail" }),
        redirectUri: getGoogleRedirectUri("gmail"),
        missing: missingProviderVars("google")
      },
      googleDrive: {
        authorizeUrl: getGoogleOAuthUrl({ provider: "google_drive" }),
        redirectUri: getGoogleRedirectUri("google_drive"),
        missing: missingProviderVars("google")
      }
    }
  });
}
