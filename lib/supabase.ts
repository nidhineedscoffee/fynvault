import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes, createHash } from "crypto";
import { env, getSupabaseUrl, hasSupabaseConfig } from "./env";
import type { FinancialGraph } from "./types";

export function createSupabaseServerClient() {
  const url = getSupabaseUrl();

  if (!hasSupabaseConfig() || !url || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
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

  if (!input.organizationId) {
    return { persisted: false, reason: "organizationId is required to persist integration credentials." };
  }

  const encryptedAccessToken = encryptIntegrationToken(input.accessToken);
  const encryptedRefreshToken = encryptIntegrationToken(input.refreshToken);

  const { error } = await supabase.from("integration_connections").insert({
    organization_id: input.organizationId,
    provider: input.provider,
    external_organization_id: input.externalOrganizationId,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expires_at: input.expiresAt,
    last_synced_at: new Date().toISOString()
  });

  if (error) {
    return { persisted: false, reason: error.message };
  }

  return { persisted: true };
}

function encryptionKeyMaterial() {
  const source = env.INTEGRATION_TOKEN_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!source) {
    return null;
  }

  return createHash("sha256").update(source).digest();
}

function encryptIntegrationToken(token: string | undefined) {
  if (!token) {
    return token;
  }

  const key = encryptionKeyMaterial();
  if (!key) {
    return token;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function asIso(value: string | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
}

function inferInvoiceStatus(status: string | null | undefined, dueDate: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  if (["paid", "closed", "completed", "settled"].includes(normalized)) {
    return "paid" as const;
  }

  if (["overdue", "past_due"].includes(normalized)) {
    return "overdue" as const;
  }

  if (dueDate) {
    const due = new Date(dueDate);
    if (!Number.isNaN(due.valueOf()) && due.getTime() < Date.now()) {
      return "overdue" as const;
    }
  }

  return "open" as const;
}

export async function loadFinancialGraphFromSupabase(organizationId: string): Promise<{
  graph: FinancialGraph | null;
  reason?: string;
}> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return { graph: null, reason: "Supabase is not configured." };
  }

  const [organizationResult, customersResult, documentsResult] = await Promise.all([
    supabase.from("organizations").select("id,name,created_at").eq("id", organizationId).maybeSingle(),
    supabase.from("customers").select("id,name,industry,outstanding_amount,risk_score").eq("organization_id", organizationId),
    supabase.from("documents").select("id,name,source,file_url,uploaded_at").eq("organization_id", organizationId)
  ]);

  if (organizationResult.error) {
    return { graph: null, reason: organizationResult.error.message };
  }
  if (!organizationResult.data) {
    return { graph: null, reason: "Organization not found." };
  }
  if (customersResult.error) {
    return { graph: null, reason: customersResult.error.message };
  }
  if (documentsResult.error) {
    return { graph: null, reason: documentsResult.error.message };
  }

  const customerIds = new Set((customersResult.data ?? []).map((row) => row.id));
  const customerIdList = [...customerIds];
  if (customerIdList.length === 0) {
    return {
      graph: {
        organization: {
          id: organizationResult.data.id,
          name: organizationResult.data.name,
          cashBalance: 0
        },
        customers: [],
        vendors: [],
        invoices: [],
        payments: [],
        expenses: [],
        bills: [],
        emails: [],
        evidence: []
      }
    };
  }

  const invoicesResult = await supabase
    .from("invoices")
    .select("id,customer_id,amount,due_date,status,source_document")
    .in("customer_id", customerIdList);

  if (invoicesResult.error) {
    return { graph: null, reason: invoicesResult.error.message };
  }

  const invoices = (invoicesResult.data ?? []).filter((row) => customerIds.has(row.customer_id));
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const invoiceIdList = [...invoiceIds];
  const paymentsResult =
    invoiceIdList.length > 0
      ? await supabase.from("payments").select("id,invoice_id,amount,payment_date").in("invoice_id", invoiceIdList)
      : { data: [], error: null };

  if (paymentsResult.error) {
    return { graph: null, reason: paymentsResult.error.message };
  }

  const payments = (paymentsResult.data ?? []).filter((row) => invoiceIds.has(row.invoice_id));

  const documentEvidence = (documentsResult.data ?? []).map((doc) => ({
    id: `doc_${doc.id}`,
    source: "document" as const,
    label: doc.name,
    url: doc.file_url ?? undefined,
    capturedAt: asIso(doc.uploaded_at)
  }));

  const invoiceDocumentMap = new Map<string, string[]>();
  for (const invoice of invoices) {
    if (invoice.source_document) {
      invoiceDocumentMap.set(invoice.id, [`doc_${invoice.source_document}`]);
    }
  }

  const graph: FinancialGraph = {
    organization: {
      id: organizationResult.data.id,
      name: organizationResult.data.name,
      cashBalance: 0
    },
    customers: (customersResult.data ?? []).map((customer) => ({
      id: customer.id,
      name: customer.name,
      owner: customer.industry ?? "Unassigned",
      contractRenewal: "2099-01-01"
    })),
    vendors: [],
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      customerId: invoice.customer_id,
      amount: Number(invoice.amount ?? 0),
      issuedAt: asIso(invoice.due_date),
      dueAt: asIso(invoice.due_date),
      status: inferInvoiceStatus(invoice.status, invoice.due_date),
      evidenceIds: invoiceDocumentMap.get(invoice.id) ?? []
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      customerId: invoices.find((invoice) => invoice.id === payment.invoice_id)?.customer_id ?? "unknown_customer",
      invoiceId: payment.invoice_id,
      amount: Number(payment.amount ?? 0),
      paidAt: asIso(payment.payment_date),
      evidenceIds: []
    })),
    expenses: [],
    bills: [],
    emails: [],
    evidence: documentEvidence
  };

  return { graph };
}

export async function loadFinancialGraphForClient(clientId: string): Promise<{
  graph: FinancialGraph | null;
  reason?: string;
}> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return { graph: null, reason: "Supabase is not configured." };
  }

  const { data: client, error } = await supabase.from("clients").select("id,organization_id").eq("id", clientId).maybeSingle();
  if (error) {
    return { graph: null, reason: error.message };
  }
  if (!client?.organization_id) {
    return { graph: null, reason: "Client is not linked to an organization." };
  }

  return loadFinancialGraphFromSupabase(client.organization_id);
}
