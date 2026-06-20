import type { MetricResult, ValidationOutput } from "./types";

export function validateResults(results: MetricResult[]): ValidationOutput {
  const sources = results.flatMap((result) => result.evidence);
  const calculationReference = results.map((result) => `${result.id}: ${result.formula}`);
  const hasSources = sources.length > 0;
  const hasCalculations = calculationReference.length > 0;

  if (!hasSources || !hasCalculations) {
    return {
      validated: false,
      confidence: "low",
      sources,
      calculation_reference: calculationReference,
      failureReason: "Missing source evidence or calculation reference."
    };
  }

  return {
    validated: true,
    confidence: sources.length >= results.length ? "high" : "medium",
    sources,
    calculation_reference: calculationReference
  };
}
