import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "./env";

export function createSupabaseServerClient() {
  if (!hasSupabaseConfig() || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}

export async function persistIntegrationConnection(input: {
  provider: "zoho" | "gmail" | "google" | "scalekit";
  organizationId?: string;
  accessToken?: string;
  refreshToken?: string;
  externalOrganizationId?: string;
  expiresAt?: string;
}) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return { persisted: false, reason: "Supabase is not configured." };
  }

  const organizationId = input.organizationId ?? "00000000-0000-0000-0000-000000000000";
  const { error } = await supabase.from("integration_connections").insert({
    organization_id: organizationId,
    provider: input.provider,
    external_organization_id: input.externalOrganizationId,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: input.expiresAt,
    last_synced_at: new Date().toISOString()
  });

  if (error) {
    return { persisted: false, reason: error.message };
  }

  return { persisted: true };
}
