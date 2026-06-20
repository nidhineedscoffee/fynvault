import type { MetricResult, RiskAlert, ValidationOutput } from "./types";
import { env, hasOpenAIConfig } from "./env";

function formatValue(result: MetricResult) {
  if (result.unit === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(result.value);
  }

  if (result.unit === "percent") {
    return `${result.value}%`;
  }

  if (result.unit === "months") {
    return `${result.value} months`;
  }

  return String(result.value);
}

export async function explainValidatedResult(input: {
  question: string;
  metrics: MetricResult[];
  risks?: RiskAlert[];
  validation: ValidationOutput;
}) {
  if (!input.validation.validated) {
    return {
      answer: "I do not have enough validated source data to answer that. Connect or sync the missing finance records, then ask again.",
      confidence: input.validation.confidence,
      sources: input.validation.sources
    };
  }

  const metricText = input.metrics.map((metric) => `${metric.label}: ${formatValue(metric)}`).join("; ");
  const riskText = input.risks?.length ? ` Related risks: ${input.risks.map((risk) => risk.title).join(", ")}.` : "";
  const fallback = {
    answer: `${metricText}.${riskText} Confidence is ${input.validation.confidence}. This answer only explains validated system calculations and does not create new numbers.`,
    confidence: input.validation.confidence,
    sources: input.validation.sources,
    calculation_reference: input.validation.calculation_reference,
    mode: "deterministic_fallback"
  };

  if (!hasOpenAIConfig()) {
    return fallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Fynny. Explain verified financial information in simple language. Never invent numbers. Never perform calculations. Only explain validated financial results provided by the system. Always include confidence level and reference supporting evidence."
          },
          {
            role: "user",
            content: JSON.stringify({
              question: input.question,
              validatedMetrics: input.metrics.map((metric) => ({
                label: metric.label,
                value: metric.value,
                unit: metric.unit,
                formula: metric.formula
              })),
              risks: input.risks?.map((risk) => ({
                title: risk.title,
                reason: risk.reason,
                impact: risk.impact,
                recommendedAction: risk.recommendedAction
              })),
              validation: input.validation
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "finvault_explanation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                answer: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                citedEvidenceCount: { type: "number" }
              },
              required: ["answer", "confidence", "citedEvidenceCount"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      return { ...fallback, mode: "openai_error_fallback", openaiStatus: response.status };
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    let parsed: { answer?: string; confidence?: "high" | "medium" | "low" } | null = null;

    if (typeof content === "string") {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }
    }

    return {
      answer: parsed?.answer ?? fallback.answer,
      confidence: parsed?.confidence ?? input.validation.confidence,
      sources: input.validation.sources,
      calculation_reference: input.validation.calculation_reference,
      mode: "openai_explanation"
    };
  } catch {
    return { ...fallback, mode: "openai_exception_fallback" };
  }
}
