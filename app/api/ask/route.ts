import { NextResponse } from "next/server";
import { z } from "zod";
import { explainValidatedResult } from "@/lib/ai";
import { selectMetrics } from "@/lib/ask-router";
import { demoGraph } from "@/lib/financial-graph";
import { calculateMetrics, calculateRisks } from "@/lib/rules-engine";
import { validateResults } from "@/lib/validation-engine";

const AskSchema = z.object({
  question: z.string().min(3).max(500)
});

export async function POST(request: Request) {
  const body = AskSchema.parse(await request.json());
  const metrics = calculateMetrics(demoGraph);
  const selectedMetrics = selectMetrics(body.question, metrics);
  const validation = validateResults(selectedMetrics);
  const risks = calculateRisks(demoGraph, metrics).filter((risk) =>
    risk.supportingData.some((metric) => selectedMetrics.some((selected) => selected.id === metric.id))
  );

  const response = await explainValidatedResult({
    question: body.question,
    metrics: selectedMetrics,
    risks,
    validation
  });

  return NextResponse.json(response);
}
