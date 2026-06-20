import type { MetricResult } from "@/lib/types";

export function formatMetric(metric: MetricResult) {
  if (metric.unit === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(metric.value);
  }

  if (metric.unit === "percent") {
    return `${metric.value}%`;
  }

  if (metric.unit === "months") {
    return `${metric.value} mo`;
  }

  return String(metric.value);
}
