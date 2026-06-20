import { NextResponse } from "next/server";
import { resolveFinancialGraph } from "@/lib/data-source";
import { requireIntelligenceReady } from "@/lib/processing";
import { buildDashboardModel } from "@/lib/rules-engine";
import { validateResults } from "@/lib/validation-engine";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required. Dashboard generation is gated by Intelligence Ready status." }, { status: 400 });
  }

  const readiness = await requireIntelligenceReady(clientId);
  if (!readiness.ok) {
    return NextResponse.json(readiness, { status: readiness.status });
  }

  const source = await resolveFinancialGraph(clientId);
  if (!source.graph) {
    return NextResponse.json({ error: source.reason ?? "Client financial graph is unavailable." }, { status: 404 });
  }

  const dashboard = buildDashboardModel(source.graph);
  const validation = validateResults(Object.values(dashboard.metrics));

  return NextResponse.json({
    mode: source.mode,
    clientId: source.clientId,
    intelligenceReadiness: readiness.data,
    reason: source.reason,
    dashboard: {
      ...dashboard,
      validation
    }
  });
}
