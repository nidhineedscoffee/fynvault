import { NextResponse } from "next/server";
import { env, missingProviderVars, providerStatus } from "@/lib/env";

export async function GET() {
  const providers = providerStatus();

  return NextResponse.json({
    app: "FinVault",
    mode: Object.values(providers).every(Boolean) ? "production_configured" : "demo_or_partial_config",
    appUrl: env.NEXT_PUBLIC_APP_URL,
    providers,
    missing: {
      supabase: missingProviderVars("supabase"),
      scalekit: missingProviderVars("scalekit"),
      google: missingProviderVars("google"),
      zoho: missingProviderVars("zoho"),
      openai: missingProviderVars("openai")
    },
    routes: {
      dashboard: "/api/dashboard",
      graph: "/api/graph",
      ask: "/api/ask",
      actions: "/api/actions",
      zohoSync: "/api/sync/zoho",
      gmailSync: "/api/sync/gmail"
    }
  });
}
