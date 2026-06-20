import { loadFinancialGraphForClient } from "./supabase";
import type { FinancialGraph } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveFinancialGraph(clientId?: string): Promise<{
  mode: "supabase";
  graph: FinancialGraph | null;
  clientId?: string;
  reason?: string;
}> {
  if (!clientId) {
    return { mode: "supabase", graph: null, reason: "clientId is required. No fake fallback data is available." };
  }

  if (!UUID_PATTERN.test(clientId)) {
    return { mode: "supabase", graph: null, clientId, reason: "clientId must be a valid UUID." };
  }

  const loaded = await loadFinancialGraphForClient(clientId);
  if (!loaded.graph) {
    return { mode: "supabase", graph: null, clientId, reason: loaded.reason ?? "Unable to load Supabase data." };
  }

  return { mode: "supabase", graph: loaded.graph, clientId };
}
