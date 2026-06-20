import { NextResponse } from "next/server";
import { demoGraph } from "@/lib/financial-graph";
import { buildDashboardModel } from "@/lib/rules-engine";
import { validateResults } from "@/lib/validation-engine";

export async function GET() {
  const dashboard = buildDashboardModel(demoGraph);
  const validation = validateResults(Object.values(dashboard.metrics));

  return NextResponse.json({
    mode: "demo_seed",
    dashboard: {
      ...dashboard,
      validation
    }
  });
}
