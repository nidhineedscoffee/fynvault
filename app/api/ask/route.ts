import { NextResponse } from "next/server";
import { z } from "zod";
import { explainValidatedResult } from "@/lib/ai";
import { selectMetrics } from "@/lib/ask-router";
import { resolveFinancialGraph } from "@/lib/data-source";
import { requireIntelligenceReady } from "@/lib/processing";
import { calculateMetrics, calculateRisks } from "@/lib/rules-engine";
import { enforceRateLimit, getClientIp, isTrustedOrigin } from "@/lib/security";
import { validateResults } from "@/lib/validation-engine";

const AskSchema = z.object({
  question: z.string().min(3).max(500),
  clientId: z.string().uuid()
});

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = enforceRateLimit({ scope: "ask", key: ip, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please retry shortly." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = AskSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const readiness = await requireIntelligenceReady(body.clientId);
  if (!readiness.ok) {
    return NextResponse.json(readiness, { status: readiness.status });
  }

  const source = await resolveFinancialGraph(body.clientId);
  if (!source.graph) {
    return NextResponse.json({ error: source.reason ?? "Client financial graph is unavailable." }, { status: 404 });
  }

  const metrics = calculateMetrics(source.graph);
  const selectedMetrics = selectMetrics(body.question, metrics);
  if (!selectedMetrics.length) {
    return NextResponse.json({ error: "No metrics available to answer this question." }, { status: 422 });
  }

  const validation = validateResults(selectedMetrics);
  const risks = calculateRisks(source.graph, metrics).filter((risk) =>
    risk.supportingData.some((metric) => selectedMetrics.some((selected) => selected.id === metric.id))
  );

  const response = await explainValidatedResult({
    question: body.question,
    metrics: selectedMetrics,
    risks,
    validation
  });

  return NextResponse.json({
    ...response,
    mode: source.mode,
    clientId: source.clientId,
    intelligenceReadiness: readiness.data,
    reason: source.reason
  });
}
