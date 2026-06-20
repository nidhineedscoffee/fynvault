import type { MetricResult } from "./types";

const routes: Array<{ match: RegExp; metricIds: string[] }> = [
  { match: /runway|burn/i, metricIds: ["runway", "monthlyBurn", "cashBalance"] },
  { match: /overdue|stuck|receivable|invoice/i, metricIds: ["overdueAmount", "receivables", "dso"] },
  { match: /expense|spend|cost/i, metricIds: ["expenses", "expenseGrowth", "vendorConcentration"] },
  { match: /risk|alert|problem/i, metricIds: ["runway", "overdueAmount", "revenueConcentration", "vendorConcentration"] },
  { match: /revenue|growth|customer/i, metricIds: ["revenue", "revenueGrowth", "revenueConcentration", "averageInvoiceValue"] },
  { match: /margin|profit|ebitda/i, metricIds: ["grossMargin", "netMargin", "ebitda"] },
  { match: /payable|bill|obligation|vendor/i, metricIds: ["payables", "vendorConcentration"] }
];

export function selectMetrics(question: string, metrics: Record<string, MetricResult>) {
  const route = routes.find((candidate) => candidate.match.test(question)) ?? routes[3];
  return route.metricIds.map((id) => metrics[id]).filter(Boolean);
}
