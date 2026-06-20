import { randomBytes } from "crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase";
import { getIntelligenceReadiness, requireIntelligenceReady } from "./processing";

export const ClientSchema = z.object({
  firmId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  businessType: z.string().max(120).optional(),
  gstNumber: z.string().max(40).optional(),
  contactName: z.string().max(160).optional(),
  contactEmail: z.string().email().optional()
});

export const DocumentRequestSchema = z.object({
  firmId: z.string().uuid().optional(),
  documentCategory: z.enum(["bank_statement", "sales_register", "purchase_register", "gst_data", "tds_data", "expense_sheet", "invoice", "contract", "other"]),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  dueDate: z.string().optional()
});

export const UploadDocumentSchema = z.object({
  firmId: z.string().uuid().optional(),
  name: z.string().min(1).max(240),
  type: z.string().min(1).max(80).default("document"),
  sourceType: z.string().min(1).max(80).default("manual_upload"),
  documentCategory: z.string().min(1).max(80).default("other"),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  storageUrl: z.string().url().optional(),
  extractedText: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const FirmSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional()
});

export const CalculationSchema = z.object({
  firmId: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional()
});

export const ReportGenerateSchema = z.object({
  firmId: z.string().uuid().optional(),
  reportType: z.string().min(1).max(80).default("mis_report"),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional()
});

export const ExportGenerateSchema = z.object({
  firmId: z.string().uuid().optional(),
  exportType: z.enum(["cleaned_sales_register", "cleaned_purchase_register", "bank_summary", "gst_ready_data", "mis_report", "client_summary"]),
  fileFormat: z.enum(["pdf", "csv", "xlsx"]),
  sourceReportId: z.string().uuid().optional(),
  sourceDatasetId: z.string().uuid().optional()
});

export const AskMvpSchema = z.object({
  question: z.string().min(3).max(500),
  firmId: z.string().uuid().optional()
});

export const IssueResolutionSchema = z.object({
  status: z.enum(["resolved", "ignored"]),
  resolutionNote: z.string().max(1000).optional()
});

function unavailable() {
  return { ok: false as const, status: 503, error: "Supabase is not configured." };
}

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return { ok: false as const, status, error, ...extra };
}

function dbError(error: { message: string }) {
  return fail(500, error.message);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeUuid(value: string) {
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match?.[0] ?? value;
}

function supabaseOrFail() {
  const supabase = createSupabaseServerClient();
  return supabase ? { ok: true as const, supabase } : unavailable();
}

function orderColumnFor(table: string) {
  return table === "documents" ? "uploaded_at" : "created_at";
}

export async function listRows(table: string, filters: Record<string, string> = {}) {
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  let query = ready.supabase.from(table).select("*");
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data, error } = await query.order(orderColumnFor(table), { ascending: false });
  return error ? dbError(error) : { ok: true as const, data };
}

export async function listRowsForClient(table: string, clientId: string, extra: Record<string, string> = {}) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  return listRows(table, { client_id: clientId, ...extra });
}

export async function getRow(table: string, id: string) {
  if (!isUuid(id)) return fail(400, "id must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, `${table} row not found.`);
  return { ok: true as const, data };
}

export async function updateRow(table: string, id: string, values: Record<string, unknown>) {
  if (!isUuid(id)) return fail(400, "id must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase.from(table).update(values).eq("id", id).select("*").single();
  return error ? dbError(error) : { ok: true as const, data };
}

export async function deleteRow(table: string, id: string) {
  if (!isUuid(id)) return fail(400, "id must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { error } = await ready.supabase.from(table).delete().eq("id", id);
  return error ? dbError(error) : { ok: true as const, data: { deleted: true } };
}

export async function createFirm(input: z.infer<typeof FirmSchema>) {
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase.from("firms").insert({ name: input.name, email: input.email }).select("*").single();
  return error ? dbError(error) : { ok: true as const, data };
}

export async function createClient(input: z.infer<typeof ClientSchema>) {
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase
    .from("clients")
    .insert({
      firm_id: input.firmId,
      organization_id: input.organizationId,
      name: input.name,
      business_type: input.businessType,
      gst_number: input.gstNumber,
      contact_name: input.contactName,
      contact_email: input.contactEmail
    })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}

export async function createDocumentRequest(clientId: string, input: z.infer<typeof DocumentRequestSchema>) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const token = randomBytes(32).toString("base64url");
  const message = buildWhatsAppMessage({ token, category: input.documentCategory, month: input.month, year: input.year });
  const { data, error } = await ready.supabase
    .from("document_requests")
    .insert({
      firm_id: input.firmId,
      client_id: clientId,
      document_category: input.documentCategory,
      month: input.month,
      year: input.year,
      due_date: input.dueDate,
      secure_upload_token: token,
      requested_message: message
    })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}

export function buildWhatsAppMessage(input: { token: string; category: string; month?: number; year?: number }) {
  const period = input.month && input.year ? ` for ${input.month}/${input.year}` : "";
  return `Fynny only collects financial documents you approve. Please upload ${input.category}${period} using this secure link: https://fynvault.vercel.app/public-upload/${input.token}. Access is read-only and can be revoked anytime.`;
}

export async function createUploadLink(requestId: string) {
  const request = await getRow("document_requests", requestId);
  if (!request.ok) return request;
  const row = request.data as { secure_upload_token?: string; document_category?: string; month?: number; year?: number };
  const token = row.secure_upload_token || randomBytes(32).toString("base64url");
  if (!row.secure_upload_token) await updateRow("document_requests", requestId, { secure_upload_token: token });
  return { ok: true as const, data: { token, uploadUrl: `https://fynvault.vercel.app/public-upload/${token}`, message: buildWhatsAppMessage({ token, category: row.document_category ?? "document", month: row.month, year: row.year }) } };
}

export async function uploadDocumentForClient(clientId: string, input: z.infer<typeof UploadDocumentSchema>) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data: client, error: clientError } = await ready.supabase.from("clients").select("id,firm_id,organization_id").eq("id", clientId).maybeSingle();
  if (clientError) return dbError(clientError);
  if (!client) return fail(404, "Client not found.");
  const { data, error } = await ready.supabase
    .from("documents")
    .insert({
      firm_id: input.firmId ?? client.firm_id,
      client_id: clientId,
      organization_id: client.organization_id,
      name: input.name,
      type: input.type,
      source: input.sourceType,
      source_type: input.sourceType,
      document_category: input.documentCategory,
      month: input.month,
      year: input.year,
      processing_status: "queued",
      validation_status: "needs_review",
      storage_url: input.storageUrl,
      file_url: input.storageUrl,
      extracted_text: input.extractedText,
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}

export async function publicUpload(token: string, input: z.infer<typeof UploadDocumentSchema>) {
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data: request, error: requestError } = await ready.supabase.from("document_requests").select("*").eq("secure_upload_token", token).maybeSingle();
  if (requestError) return dbError(requestError);
  if (!request) return fail(404, "Upload link is invalid or expired.");
  if (request.status === "expired" || request.status === "cancelled") return fail(410, "Upload link is no longer active.");
  const upload = await uploadDocumentForClient(request.client_id, { ...input, firmId: request.firm_id, documentCategory: request.document_category, month: request.month, year: request.year });
  if (!upload.ok) return upload;
  await updateRow("document_requests", request.id, { status: "uploaded", completed_at: new Date().toISOString() });
  return upload;
}

export async function processDocument(documentId: string) {
  const doc = await getRow("documents", documentId);
  if (!doc.ok) return doc;
  const row = doc.data as { firm_id?: string; client_id?: string; source_type?: string };
  if (!row.client_id) return fail(400, "Document must be linked to a client before processing.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase
    .from("processing_jobs")
    .insert({ firm_id: row.firm_id, client_id: row.client_id, document_id: documentId, source_type: row.source_type ?? "manual_upload", current_stage: "collection", status: "queued" })
    .select("*")
    .single();
  if (error) return dbError(error);
  return { ok: true as const, data: { job: data } };
}

export async function resolveValidationIssue(issueId: string, input: z.infer<typeof IssueResolutionSchema>) {
  return updateRow("validation_issues", issueId, {
    status: input.status,
    suggested_fix: input.resolutionNote
  });
}

export async function listClientMemory(clientId: string) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const [events, entities, relationships] = await Promise.all([
    ready.supabase.from("financial_memory_events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    ready.supabase.from("memory_entities").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    ready.supabase.from("memory_relationships").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100)
  ]);
  for (const result of [events, entities, relationships]) {
    if (result.error) return dbError(result.error);
  }
  return {
    ok: true as const,
    data: {
      events: events.data ?? [],
      entities: entities.data ?? [],
      relationships: relationships.data ?? []
    }
  };
}

export async function getClientPortal(clientId: string) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const [clientResult, reportsResult, exportsResult, requestsResult, readiness] = await Promise.all([
    ready.supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    ready.supabase.from("reports").select("*").eq("client_id", clientId).eq("published_to_client", true).order("created_at", { ascending: false }),
    ready.supabase.from("exports").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ready.supabase.from("document_requests").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    getIntelligenceReadiness(clientId)
  ]);
  if (clientResult.error) return dbError(clientResult.error);
  if (!clientResult.data) return fail(404, "Client not found.");
  if (reportsResult.error) return dbError(reportsResult.error);
  if (exportsResult.error) return dbError(exportsResult.error);
  if (requestsResult.error) return dbError(requestsResult.error);
  return {
    ok: true as const,
    data: {
      client: clientResult.data,
      publishedReports: reportsResult.data ?? [],
      exports: exportsResult.data ?? [],
      documentRequests: requestsResult.data ?? [],
      readiness: readiness.ok ? readiness.data : null
    }
  };
}

export async function answerMvpQuestion(clientId: string, input: z.infer<typeof AskMvpSchema>) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  const readiness = await requireIntelligenceReady(clientId);
  if (!readiness.ok) return readiness;
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const [calculations, datasets, memory] = await Promise.all([
    ready.supabase.from("calculations").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(3),
    ready.supabase.from("intelligence_datasets").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    ready.supabase.from("financial_memory_events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5)
  ]);
  for (const result of [calculations, datasets, memory]) {
    if (result.error) return dbError(result.error);
  }
  const readinessData = readiness.data as { score: number; factors: Record<string, number> };
  const calculationCount = calculations.data?.length ?? 0;
  const datasetCount = datasets.data?.length ?? 0;
  const memoryCount = memory.data?.length ?? 0;
  const factorSummary = Object.entries(readinessData.factors)
    .map(([name, score]) => `${name.replaceAll("_", " ")} ${score}%`)
    .join(", ");
  return {
    ok: true as const,
    data: {
      answer: `This client is Intelligence Ready with a readiness score of ${readinessData.score}%. For "${input.question}", I found ${calculationCount} recent calculations, ${datasetCount} intelligence datasets, and ${memoryCount} financial memory events. Key readiness factors: ${factorSummary}. Use the cited evidence below to prepare the client-safe response; Fynny has not invented any numbers outside the verified records.`,
      question: input.question,
      readiness: readinessData,
      evidence: {
        calculations: calculations.data ?? [],
        datasets: datasets.data ?? [],
        memoryEvents: memory.data ?? []
      }
    }
  };
}

export async function calculateFinancialSnapshot(clientId: string, input: z.infer<typeof CalculationSchema>) {
  clientId = normalizeUuid(clientId);
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  let query = ready.supabase.from("financial_records").select("*").eq("client_id", clientId);
  if (input.month && input.year) {
    const start = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
    const endMonth = input.month === 12 ? 1 : input.month + 1;
    const endYear = input.month === 12 ? input.year + 1 : input.year;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("date", start).lt("date", end);
  }
  const { data: records, error } = await query;
  if (error) return dbError(error);
  const rows = records ?? [];
  const inflow = rows.filter((r) => ["sale", "receipt", "cash_inflow"].includes(r.record_type)).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const outflow = rows.filter((r) => ["purchase", "expense", "payment", "cash_outflow"].includes(r.record_type)).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const receivables = rows.filter((r) => r.record_type === "receivable").reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const payables = rows.filter((r) => r.record_type === "payable").reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const missingInputs = rows.length ? [] : ["financial_records"];
  const sourceIds = [...new Set(rows.map((r) => r.source_document_id).filter(Boolean))];
  const snapshot = {
    firm_id: input.firmId,
    client_id: clientId,
    month: input.month,
    year: input.year,
    cash_inflow: inflow,
    cash_outflow: outflow,
    net_cash_position: inflow - outflow,
    receivables,
    payables,
    gst_estimate: Math.max(0, (inflow - outflow) * 0.18),
    tds_estimate: Math.max(0, outflow * 0.1),
    overdue_invoices: rows.filter((r) => r.status === "overdue").reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
    readiness_score: rows.length ? 80 : 0,
    risk_score: rows.length ? 25 : 100,
    data_completeness: rows.length ? 80 : 0,
    missing_inputs: missingInputs,
    source_document_ids: sourceIds,
    formula_audit: {
      cash_inflow: "sum(financial_records.amount where record_type in sale, receipt, cash_inflow)",
      cash_outflow: "sum(financial_records.amount where record_type in purchase, expense, payment, cash_outflow)",
      net_cash_position: "cash_inflow - cash_outflow"
    }
  };
  const { data, error: insertError } = await ready.supabase.from("calculations").insert(snapshot).select("*").single();
  return insertError ? dbError(insertError) : { ok: true as const, data };
}

export async function generateReport(clientId: string, input: z.infer<typeof ReportGenerateSchema>) {
  const readiness = await requireIntelligenceReady(clientId);
  if (!readiness.ok) return readiness;
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data: calc } = await ready.supabase.from("calculations").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!calc) return fail(428, "Cannot generate report because calculations are missing.", { missingData: ["calculations"] });
  const { data, error } = await ready.supabase
    .from("reports")
    .insert({ firm_id: input.firmId, client_id: clientId, report_type: input.reportType, month: input.month, year: input.year, status: "ready", report_json: { calculation: calc, readiness: readiness.data }, ai_summary: "Report generated from rules-based calculations. AI may explain but does not calculate primary values." })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}

export async function generateExport(clientId: string, input: z.infer<typeof ExportGenerateSchema>) {
  const readiness = await requireIntelligenceReady(clientId);
  if (!readiness.ok) return readiness;
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase
    .from("exports")
    .insert({ firm_id: input.firmId, client_id: clientId, export_type: input.exportType, file_format: input.fileFormat, source_report_id: input.sourceReportId, source_dataset_id: input.sourceDatasetId })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}

export async function generateAdvisory(clientId: string, firmId?: string) {
  const readiness = await getIntelligenceReadiness(clientId);
  if (!readiness.ok) return readiness;
  const readinessData = readiness.data as { intelligenceReady: boolean };
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const { data, error } = await ready.supabase
    .from("advisory_opportunities")
    .insert({
      firm_id: firmId,
      client_id: clientId,
      opportunity_type: "data_readiness",
      title: readinessData.intelligenceReady ? "Client is ready for advisory review" : "Resolve data blockers before advisory",
      evidence: readiness.data,
      potential_impact: "Reduce preparation effort and unlock MIS, exports, and client visibility.",
      suggested_talking_points: ["Review missing inputs", "Confirm validation issues", "Publish only approved outputs"]
    })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}
