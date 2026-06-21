import { z } from "zod";
import { collectAndProcessDataSource } from "./integration-sync";
import { refreshZohoAccessToken } from "./integrations/normalizers";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./security";
import { createSupabaseServerClient } from "./supabase";

export const SourceTypeSchema = z.enum([
  "whatsapp",
  "email",
  "gmail",
  "google_drive",
  "tally",
  "zoho_books",
  "quickbooks",
  "accounting_export",
  "bank_statement",
  "gst_file",
  "tds_file",
  "spreadsheet",
  "csv",
  "xlsx",
  "payroll_report",
  "pdf"
]);

export const ConsentRequestSchema = z.object({
  firmId: z.string().uuid().optional(),
  sourceType: SourceTypeSchema,
  accessScope: z.string().default("read_only"),
  expiresAt: z.string().datetime().optional()
});

export const ConsentApprovalSchema = z.object({
  approvedBy: z.string().min(1).max(200)
});

export const DataSourceConnectSchema = z.object({
  firmId: z.string().uuid().optional(),
  sourceType: SourceTypeSchema,
  provider: z.string().min(1).max(80),
  consentGrantId: z.string().uuid().optional()
});

export const DataSourceSyncSchema = z.object({
  dataSourceId: z.string().uuid()
});

export const OAuthSourceTypeSchema = z.enum(["gmail", "google_drive", "zoho_books"]);

function unavailable<T>() {
  return { ok: false as const, status: 503, error: "Supabase is not configured." };
}

function fail<T>(status: number, error: string) {
  return { ok: false as const, status, error };
}

function dbError(error: { message: string }) {
  return fail(500, error.message);
}

function uuidIsValid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateClientId(clientId: string) {
  return uuidIsValid(clientId) ? null : fail(400, "clientId must be a valid UUID.");
}

export async function requestConsent(clientId: string, input: z.infer<typeof ConsentRequestSchema>) {
  const invalid = validateClientId(clientId);
  if (invalid) {
    return invalid;
  }

  if (input.accessScope !== "read_only") {
    return fail(400, "Fynny only supports read-only source access by default.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const { data, error } = await supabase
    .from("consent_grants")
    .insert({
      firm_id: input.firmId,
      client_id: clientId,
      source_type: input.sourceType,
      access_scope: input.accessScope,
      status: "requested",
      expires_at: input.expiresAt
    })
    .select("*")
    .single();

  if (error) {
    return dbError(error);
  }

  return { ok: true as const, data: { consentGrant: data } };
}

export async function approveConsent(consentId: string, approvedBy: string) {
  if (!uuidIsValid(consentId)) {
    return fail(400, "consentId must be a valid UUID.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const { data, error } = await supabase
    .from("consent_grants")
    .update({ status: "approved", approved_by: approvedBy, approved_at: new Date().toISOString(), revoked_at: null })
    .eq("id", consentId)
    .select("*")
    .single();

  if (error) {
    return dbError(error);
  }

  return { ok: true as const, data: { consentGrant: data } };
}

export async function revokeConsent(consentId: string) {
  if (!uuidIsValid(consentId)) {
    return fail(400, "consentId must be a valid UUID.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const { data, error } = await supabase
    .from("consent_grants")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", consentId)
    .select("*")
    .single();

  if (error) {
    return dbError(error);
  }

  await supabase.from("data_sources").update({ connection_status: "revoked" }).eq("consent_grant_id", consentId);
  return { ok: true as const, data: { consentGrant: data } };
}

export async function listDataSources(clientId: string) {
  const invalid = validateClientId(clientId);
  if (invalid) {
    return invalid;
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const { data, error } = await supabase.from("data_sources").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) {
    return dbError(error);
  }

  return { ok: true as const, data: { dataSources: data ?? [] } };
}

export async function connectDataSource(clientId: string, input: z.infer<typeof DataSourceConnectSchema>) {
  const invalid = validateClientId(clientId);
  if (invalid) {
    return invalid;
  }

  if (input.sourceType === "whatsapp") {
    return fail(400, "Direct WhatsApp access is not supported for MVP. Use manual upload, collection email, or mobile portal upload.");
  }
  if (input.sourceType === "tally") {
    return fail(423, "Tally direct API is locked for this MVP. Upload Tally CSV/XLSX exports through Secure Upload.");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const grantId = input.consentGrantId;
  const consentQuery = grantId
    ? supabase.from("consent_grants").select("*").eq("id", grantId).eq("client_id", clientId).maybeSingle()
    : supabase
        .from("consent_grants")
        .insert({
          firm_id: input.firmId,
          client_id: clientId,
          source_type: input.sourceType,
          access_scope: "read_only",
          status: "approved",
          approved_by: "firm_user",
          approved_at: new Date().toISOString()
        })
        .select("*")
        .single();

  const { data: consent, error: consentError } = await consentQuery;

  if (consentError) {
    return dbError(consentError);
  }
  if (!consent) {
    return fail(404, "Source authorization record not found for this client.");
  }
  if (consent.status !== "approved" || consent.access_scope !== "read_only") {
    return fail(403, "Source access must be read-only before connecting.");
  }

  const { data, error } = await supabase
    .from("data_sources")
    .insert({
      firm_id: input.firmId ?? consent.firm_id,
      client_id: clientId,
      source_type: input.sourceType,
      provider: input.provider,
      connection_status: "connected",
      consent_grant_id: consent.id
    })
    .select("*")
    .single();

  if (error) {
    return dbError(error);
  }

  return { ok: true as const, data: { dataSource: data } };
}

export async function syncDataSource(clientId: string, dataSourceId: string) {
  const invalid = validateClientId(clientId);
  if (invalid) {
    return invalid;
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const { data: dataSource, error: sourceError } = await supabase
    .from("data_sources")
    .select("*, consent_grants(status,access_scope)")
    .eq("id", dataSourceId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (sourceError) {
    return dbError(sourceError);
  }
  if (!dataSource) {
    return fail(404, "Data source not found for this client.");
  }
  if (dataSource.source_type === "whatsapp") {
    return fail(400, "Direct WhatsApp sync is not supported for MVP.");
  }
  if (dataSource.consent_grants?.status !== "approved" || dataSource.consent_grants?.access_scope !== "read_only") {
    return fail(403, "Read-only source access is required before sync.");
  }

  const now = new Date().toISOString();
  let metadata = (dataSource.metadata ?? {}) as Record<string, unknown>;
  let accessToken = decryptIntegrationSecret(metadata.encryptedAccessToken);

  if (dataSource.source_type === "zoho_books") {
    const refreshToken = decryptIntegrationSecret(metadata.encryptedRefreshToken);
    const expiresAt = typeof metadata.expiresAt === "string" ? Date.parse(metadata.expiresAt) : 0;
    const shouldRefresh = Boolean(refreshToken && (!accessToken || !expiresAt || expiresAt - Date.now() < 120_000));
    if (shouldRefresh && refreshToken) {
      const refreshed = await refreshZohoAccessToken(refreshToken);
      if (refreshed.configured && refreshed.ok && refreshed.accessToken) {
        const refreshedExpiresAt = refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : metadata.expiresAt;
        accessToken = refreshed.accessToken;
        metadata = {
          ...metadata,
          encryptedAccessToken: encryptIntegrationSecret(refreshed.accessToken),
          expiresAt: refreshedExpiresAt,
          apiDomain: refreshed.apiDomain ?? metadata.apiDomain,
          zohoBooksBaseUrl: refreshed.apiDomain ? `${refreshed.apiDomain}/books/v3` : metadata.zohoBooksBaseUrl,
          tokenRefreshedAt: new Date().toISOString()
        };
        await supabase.from("data_sources").update({ metadata }).eq("id", dataSourceId);
      } else {
        await supabase.from("data_sources").update({ connection_status: "error" }).eq("id", dataSourceId);
        return fail(409, "Zoho token refresh failed. Reconnect Zoho Books and confirm the OAuth redirect URI matches this deployment.");
      }
    }
  }

  if (["gmail", "google_drive", "zoho_books"].includes(dataSource.source_type) && !accessToken) {
    await supabase.from("data_sources").update({ connection_status: "error" }).eq("id", dataSourceId);
    return fail(409, "This source needs to be reconnected before sync. OAuth access token is missing or expired.");
  }

  const [sourceUpdate, logInsert] = await Promise.all([
    supabase.from("data_sources").update({ connection_status: "syncing", last_sync_at: now }).eq("id", dataSourceId).select("*").single(),
    supabase
      .from("ingestion_logs")
      .insert({
        firm_id: dataSource.firm_id,
        client_id: clientId,
        data_source_id: dataSourceId,
        action: "read_only_sync_requested",
        file_count: 0,
        status: "started"
      })
      .select("*")
      .single()
  ]);

  if (sourceUpdate.error) {
    return dbError(sourceUpdate.error);
  }
  if (logInsert.error) {
    return dbError(logInsert.error);
  }

  if (accessToken && ["gmail", "google_drive", "zoho_books"].includes(dataSource.source_type)) {
    try {
      const collected = await collectAndProcessDataSource({
        clientId,
        accessToken,
        dataSource: {
          id: dataSource.id,
          firm_id: dataSource.firm_id,
          source_type: dataSource.source_type,
          provider: dataSource.provider,
          metadata
        }
      });
      const completedAt = new Date().toISOString();
      const status = collected.errors.length ? "needs_review" : "connected";
      const { data: syncedSource, error: syncUpdateError } = await supabase
        .from("data_sources")
        .update({
          connection_status: status,
          last_sync_at: completedAt,
          metadata: {
            ...metadata,
            lastSync: {
              completedAt,
              fileCount: collected.fileCount,
              errors: collected.errors.slice(0, 5)
            }
          }
        })
        .eq("id", dataSourceId)
        .select("*")
        .single();
      if (syncUpdateError) return dbError(syncUpdateError);
      await supabase
        .from("ingestion_logs")
        .update({ file_count: collected.fileCount, status: collected.errors.length ? "needs_review" : "completed" })
        .eq("id", logInsert.data.id);

      return {
        ok: true as const,
        data: {
          dataSource: syncedSource,
          ingestionLog: { ...logInsert.data, file_count: collected.fileCount, status: collected.errors.length ? "needs_review" : "completed" },
          collected,
          message: collected.fileCount
            ? `Synced ${collected.fileCount} financial item${collected.fileCount === 1 ? "" : "s"} into processing.`
            : "Sync completed. No matching financial files were found with the approved filters."
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Provider sync failed.";
      await Promise.all([
        supabase
          .from("data_sources")
          .update({ connection_status: "error", metadata: { ...metadata, lastSync: { completedAt: new Date().toISOString(), error: errorMessage } } })
          .eq("id", dataSourceId),
        supabase.from("ingestion_logs").update({ status: "failed" }).eq("id", logInsert.data.id)
      ]);
      return fail(502, errorMessage);
    }
  }

  return {
    ok: true as const,
    data: {
      dataSource: sourceUpdate.data,
      ingestionLog: logInsert.data,
      message: "Read-only sync requested. Collection rules restrict ingestion to financial documents only."
    }
  };
}

export async function completeOAuthDataSourceConnection(clientId: string, input: {
  sourceType: z.infer<typeof OAuthSourceTypeSchema>;
  provider: string;
  expiresAt?: string;
  accessTokenReceived?: boolean;
  refreshTokenReceived?: boolean;
  accessToken?: string;
  refreshToken?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}) {
  const invalid = validateClientId(clientId);
  if (invalid) {
    return invalid;
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return unavailable<unknown>();
  }

  const { data: client, error: clientError } = await supabase.from("clients").select("id,firm_id").eq("id", clientId).maybeSingle();
  if (clientError) {
    return dbError(clientError);
  }
  if (!client) {
    return fail(404, "Client not found.");
  }

  const now = new Date().toISOString();
  const metadata: Record<string, unknown> = {
    oauthConnectedAt: now,
    expiresAt: input.expiresAt,
    accessTokenReceived: Boolean(input.accessTokenReceived),
    refreshTokenReceived: Boolean(input.refreshTokenReceived),
    capabilities: input.capabilities ?? [],
    ...(input.metadata ?? {})
  };
  const encryptedAccessToken = encryptIntegrationSecret(input.accessToken);
  const encryptedRefreshToken = encryptIntegrationSecret(input.refreshToken);
  if (encryptedAccessToken) metadata.encryptedAccessToken = encryptedAccessToken;
  if (encryptedRefreshToken) metadata.encryptedRefreshToken = encryptedRefreshToken;

  const { data: existing } = await supabase
    .from("data_sources")
    .select("id,metadata")
    .eq("client_id", clientId)
    .eq("source_type", input.sourceType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("data_sources")
      .update({
        provider: input.provider,
        connection_status: "connected",
        consent_status: "approved",
        last_sync_at: now,
        metadata: { ...((existing.metadata as Record<string, unknown> | null) ?? {}), ...metadata }
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      return dbError(error);
    }

    await supabase.from("ingestion_logs").insert({
      firm_id: client.firm_id,
      client_id: clientId,
      data_source_id: existing.id,
      action: "oauth_connected",
      file_count: 0,
      status: "completed"
    });

    return { ok: true as const, data: { dataSource: data } };
  }

  const { data: consent, error: consentError } = await supabase
    .from("consent_grants")
    .insert({
      firm_id: client.firm_id,
      client_id: clientId,
      source_type: input.sourceType,
      access_scope: "read_only",
      status: "approved",
      approved_by: "oauth_callback",
      approved_at: now
    })
    .select("*")
    .single();

  if (consentError) {
    return dbError(consentError);
  }

  const { data, error } = await supabase
    .from("data_sources")
    .insert({
      firm_id: client.firm_id,
      client_id: clientId,
      source_type: input.sourceType,
      provider: input.provider,
      connection_status: "connected",
      consent_status: "approved",
      last_sync_at: now,
      consent_grant_id: consent.id,
      metadata
    })
    .select("*")
    .single();

  if (error) {
    return dbError(error);
  }

  await supabase.from("ingestion_logs").insert({
    firm_id: client.firm_id,
    client_id: clientId,
    data_source_id: data.id,
    action: "oauth_connected",
    file_count: 0,
    status: "completed"
  });

  return { ok: true as const, data: { dataSource: data } };
}
