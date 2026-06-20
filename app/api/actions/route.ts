import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveFinancialGraph } from "@/lib/data-source";
import { requireIntelligenceReady } from "@/lib/processing";
import { calculateMetrics, calculateRisks } from "@/lib/rules-engine";
import { enforceRateLimit, getClientIp, isTrustedOrigin } from "@/lib/security";
import { validateResults } from "@/lib/validation-engine";

const ActionSchema = z.object({
  action: z.enum(["payment_reminder", "collection_plan", "board_report", "investor_update", "risk_report"]),
  clientId: z.string().uuid()
});

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = enforceRateLimit({ scope: "actions", key: ip, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please retry shortly." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      },
      { status: 400 }
    );
  }

  const { action, clientId } = parsed.data;
  const readiness = await requireIntelligenceReady(clientId);
  if (!readiness.ok) {
    return NextResponse.json(readiness, { status: readiness.status });
  }

  const source = await resolveFinancialGraph(clientId);
  if (!source.graph) {
    return NextResponse.json({ error: source.reason ?? "Client financial graph is unavailable." }, { status: 404 });
  }

  const metrics = calculateMetrics(source.graph);
  const risks = calculateRisks(source.graph, metrics);
  const validation = validateResults([metrics.overdueAmount, metrics.runway, metrics.cashBalance, metrics.receivables]);

  if (!validation.validated) {
    return NextResponse.json({ status: "blocked", validation }, { status: 422 });
  }

  return NextResponse.json({
    status: "ready",
    mode: source.mode,
    clientId: source.clientId,
    intelligenceReadiness: readiness.data,
    reason: source.reason,
    action,
    validation,
    draft: {
      title: action.replaceAll("_", " "),
      summary: `Generated from ${validation.sources.length} validated sources. Runway is ${metrics.runway.value} months and overdue invoices total ${metrics.overdueAmount.value}.`,
      recommendedNextStep: risks[0]?.recommendedAction ?? "Review dashboard and export CFO summary."
    }
  });
}
