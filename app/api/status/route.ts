import { NextResponse } from "next/server";
import { env, missingProviderVars, providerStatus } from "@/lib/env";

export async function GET() {
  const providers = providerStatus();

  return NextResponse.json({
    app: "Fynny",
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
      firm: "/api/firm",
      clients: "/api/clients",
      client: "/api/clients/:id",
      processing: "/api/processing",
      processingJobs: "/api/processing/jobs",
      processingJobRetry: "/api/processing/jobs/:id/retry",
      processingIssues: "/api/processing/issues",
      intelligenceReady: "/api/intelligence-ready/:clientId",
      clientProcessing: "/api/clients/:id/processing",
      clientValidationIssues: "/api/clients/:id/validation-issues",
      documentRequests: "/api/clients/:id/document-requests",
      documentUpload: "/api/clients/:id/documents",
      publicUpload: "/api/public-upload/:token",
      calculate: "/api/clients/:id/calculate",
      snapshot: "/api/clients/:id/snapshot",
      memory: "/api/clients/:id/memory",
      clientAsk: "/api/clients/:id/ask",
      reports: "/api/clients/:id/reports",
      exports: "/api/clients/:id/exports",
      advisory: "/api/clients/:id/advisory",
      clientPortal: "/api/client-portal/:id",
      consentRequest: "/api/clients/:id/consent/request",
      consentList: "/api/clients/:id/consent",
      dataSources: "/api/clients/:id/data-sources",
      zohoSync: "/api/sync/zoho",
      gmailSync: "/api/sync/gmail"
    }
  });
}
