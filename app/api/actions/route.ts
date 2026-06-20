import { NextResponse } from "next/server";
import { z } from "zod";
import { demoGraph } from "@/lib/financial-graph";
import { calculateMetrics, calculateRisks } from "@/lib/rules-engine";
import { validateResults } from "@/lib/validation-engine";

const ActionSchema = z.object({
  action: z.enum(["payment_reminder", "collection_plan", "board_report", "investor_update", "risk_report"])
});

export async function POST(request: Request) {
  const { action } = ActionSchema.parse(await request.json());
  const metrics = calculateMetrics(demoGraph);
  const risks = calculateRisks(demoGraph, metrics);
  const validation = validateResults([metrics.overdueAmount, metrics.runway, metrics.cashBalance, metrics.receivables]);

  if (!validation.validated) {
    return NextResponse.json({ status: "blocked", validation }, { status: 422 });
  }

  return NextResponse.json({
    status: "ready",
    action,
    validation,
    draft: {
      title: action.replaceAll("_", " "),
      summary: `Generated from ${validation.sources.length} validated sources. Runway is ${metrics.runway.value} months and overdue invoices total ${metrics.overdueAmount.value}.`,
      recommendedNextStep: risks[0]?.recommendedAction ?? "Review dashboard and export CFO summary."
    }
  });
}
