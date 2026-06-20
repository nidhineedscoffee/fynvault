import { randomBytes } from "crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase";
import { buildFinancialIntelligenceAnswer, buildReadinessTrainingGuidance } from "./financial-intelligence";
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

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text?: string) {
  if (!text?.trim()) return [] as Record<string, string>[];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index]?.trim() ?? "";
      return row;
    }, {});
  });
}

function numeric(value?: string) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstValue(row: Record<string, string>, keys: string[]) {
  const lowerMap = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  return keys.map((key) => lowerMap.get(key.toLowerCase())).find((value) => value !== undefined && value !== "") ?? "";
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function classifyDocument(input: { name?: string; sourceType?: string; documentCategory?: string; extractedText?: string }) {
  const haystack = `${input.name ?? ""} ${input.sourceType ?? ""} ${input.documentCategory ?? ""} ${input.extractedText?.slice(0, 500) ?? ""}`.toLowerCase();
  if (haystack.includes("bank") || haystack.includes("transaction_date") || haystack.includes("reference_no")) return "bank_statement";
  if (haystack.includes("gst") || haystack.includes("gstr") || haystack.includes("itc")) return "gst_data";
  if (haystack.includes("tds") || haystack.includes("challan")) return "tds_data";
  if (haystack.includes("payroll") || haystack.includes("employee")) return "payroll";
  if (haystack.includes("contract") || haystack.includes("renewal")) return "contract";
  if (haystack.includes("purchase") || haystack.includes("vendor") || haystack.includes("bill_no")) return "purchase_register";
  if (haystack.includes("sales") || haystack.includes("invoice_no") || haystack.includes("customer")) return "sales_register";
  return "other";
}

function recordTypeFor(documentType: string) {
  if (documentType === "bank_statement") return "bank_entry";
  if (documentType === "gst_data") return "gst_entry";
  if (documentType === "tds_data") return "tds_entry";
  if (documentType === "payroll") return "payroll_entry";
  if (documentType === "contract") return "contract";
  if (documentType === "purchase_register") return "purchase";
  if (documentType === "sales_register") return "sale";
  return "other";
}

function datasetTypesFor(documentType: string) {
  if (documentType === "bank_statement") return ["cash_flow", "advisory"];
  if (documentType === "sales_register") return ["receivables", "mis_report", "advisory"];
  if (documentType === "purchase_register") return ["payables", "gst", "advisory"];
  if (documentType === "gst_data") return ["gst", "compliance"];
  if (documentType === "tds_data") return ["compliance", "advisory"];
  if (documentType === "payroll") return ["mis_report", "advisory"];
  if (documentType === "contract") return ["client_visibility", "advisory"];
  return ["other", "advisory"];
}

function issueSignals(documentType: string, rows: Record<string, string>[], text?: string) {
  const issues: Array<{ severity: "critical" | "warning" | "info"; category: string; issue_type: string; message: string; impact: string; suggested_fix: string }> = [];
  const normalizedText = (text ?? "").toLowerCase();
  const invoiceCounts = new Map<string, number>();
  for (const row of rows) {
    const invoiceNo = firstValue(row, ["invoice_no", "invoice number", "bill_no"]);
    if (invoiceNo) invoiceCounts.set(invoiceNo, (invoiceCounts.get(invoiceNo) ?? 0) + 1);
    if (documentType === "bank_statement" && "reference_no" in row && !row.reference_no?.trim()) {
      issues.push({ severity: "warning", category: "reconciliation", issue_type: "missing_bank_reference", message: "A bank entry is missing a reference number.", impact: "The transaction may need manual reconciliation.", suggested_fix: "Add or confirm the bank reference before client-facing reporting." });
    }
  }
  for (const [invoiceNo, count] of invoiceCounts.entries()) {
    if (count > 1) {
      issues.push({ severity: "warning", category: "duplicate_record", issue_type: "duplicate_invoice", message: `Duplicate invoice or bill number detected: ${invoiceNo}.`, impact: "Duplicate records can overstate receivables, payables, or revenue.", suggested_fix: "Confirm whether the duplicate is valid or correct the source register." });
    }
  }
  if (normalizedText.includes("incomplete") || normalizedText.includes("missing")) {
    issues.push({ severity: "warning", category: "missing_input", issue_type: "missing_input", message: "The uploaded file references incomplete or missing supporting inputs.", impact: "Readiness may be reduced until the missing input is supplied.", suggested_fix: "Upload the missing source file or mark the item resolved after review." });
  }
  if (normalizedText.includes("pending") && normalizedText.includes("tds")) {
    issues.push({ severity: "warning", category: "compliance", issue_type: "tds_pending", message: "Pending TDS deposit or challan evidence detected.", impact: "TDS compliance output should be reviewed before filing.", suggested_fix: "Deposit pending TDS or upload challan evidence." });
  }
  if (normalizedText.includes("mismatch") || normalizedText.includes("rounding")) {
    issues.push({ severity: "info", category: "reconciliation", issue_type: "reconciliation_mismatch", message: "Potential reconciliation mismatch or rounding difference detected.", impact: "A reviewer should confirm the variance before final reporting.", suggested_fix: "Compare source totals and document the adjustment." });
  }
  return issues.slice(0, 8);
}

function financialRecordFrom(row: Record<string, string>, documentType: string, documentId: string) {
  const credit = numeric(firstValue(row, ["credit", "total_amount", "amount", "taxable_value", "gross_amount", "monthly_value", "outstanding_amount", "net_salary"]));
  const debit = numeric(firstValue(row, ["debit"]));
  const amount = Math.max(credit, debit, 0);
  const date = firstValue(row, ["transaction_date", "invoice_date", "bill_date", "payment_date", "date", "contract_start_date"]);
  const counterparty = firstValue(row, ["customer_name", "vendor_name", "deductee_name", "employee_name", "description"]);
  const status = firstValue(row, ["payment_status", "status", "renewal_status", "deposit_status"]) || "active";
  const type = documentType === "bank_statement" ? (credit >= debit ? "receipt" : "payment") : recordTypeFor(documentType);
  return {
    source_document_id: documentId,
    record_type: type,
    amount,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    category: documentType,
    description: firstValue(row, ["description", "expense_category", "notes", "invoice_no", "bill_no"]) || documentType,
    counterparty,
    status: status.toLowerCase().includes("overdue") ? "overdue" : status.toLowerCase().includes("paid") ? "paid" : "active"
  };
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
  return `Please upload ${input.category}${period} using this secure Fynny link: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://fynvault.vercel.app"}/public-upload/${input.token}. Fynny will process only the financial file you upload.`;
}

export async function createUploadLink(requestId: string) {
  const request = await getRow("document_requests", requestId);
  if (!request.ok) return request;
  const row = request.data as { secure_upload_token?: string; document_category?: string; month?: number; year?: number };
  const token = row.secure_upload_token || randomBytes(32).toString("base64url");
  if (!row.secure_upload_token) await updateRow("document_requests", requestId, { secure_upload_token: token });
  return { ok: true as const, data: { token, uploadUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fynvault.vercel.app"}/public-upload/${token}`, message: buildWhatsAppMessage({ token, category: row.document_category ?? "document", month: row.month, year: row.year }) } };
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
  if (error) return dbError(error);
  const processing = await processDocument(data.id);
  return { ok: true as const, data: { ...data, processing: processing.ok ? processing.data : null, processingError: processing.ok ? null : processing.error } };
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
  const row = doc.data as { firm_id?: string; client_id?: string; source_type?: string; name?: string; document_category?: string; extracted_text?: string; month?: number; year?: number };
  if (!row.client_id) return fail(400, "Document must be linked to a client before processing.");
  const ready = supabaseOrFail();
  if (!ready.ok) return ready;
  const rows = parseCsv(row.extracted_text).slice(0, 250);
  const documentType = classifyDocument({ name: row.name, sourceType: row.source_type, documentCategory: row.document_category, extractedText: row.extracted_text });
  const hasUsableRows = rows.length > 0 || Boolean(row.extracted_text?.trim());
  const detectedIssues = issueSignals(documentType, rows, row.extracted_text);
  const issueRows = hasUsableRows
    ? detectedIssues
    : [
        ...detectedIssues,
        {
          severity: "critical" as const,
          category: "missing_input",
          issue_type: "no_extractable_data",
          message: "No extractable financial rows were found in this upload.",
          impact: "Fynny cannot build financial memory or intelligence datasets from an empty source.",
          suggested_fix: "Upload a CSV, spreadsheet, PDF text extract, or supported financial document with readable content."
        }
      ];
  const validationStatus = issueRows.some((issue) => issue.severity === "critical") ? "needs_review" : issueRows.length ? "needs_review" : "verified";
  const readinessScore = hasUsableRows ? (issueRows.some((issue) => issue.severity === "critical") ? 68 : issueRows.length ? 86 : 94) : 42;
  const confidence = hasUsableRows ? (rows.length ? 88 : 72) : 35;

  const { data: job, error } = await ready.supabase
    .from("processing_jobs")
    .insert({
      firm_id: row.firm_id,
      client_id: row.client_id,
      document_id: documentId,
      source_type: row.source_type ?? "manual_upload",
      document_type: documentType,
      validation_status: validationStatus,
      current_stage: "intelligence_ready",
      status: hasUsableRows ? "intelligence_ready" : "blocked",
      intelligence_ready: hasUsableRows && !issueRows.some((issue) => issue.severity === "critical"),
      intelligence_readiness_score: readinessScore,
      processing_confidence: confidence,
      confidence_score: confidence,
      completed_at: hasUsableRows ? new Date().toISOString() : undefined,
      error_message: hasUsableRows ? undefined : "No extractable text or CSV rows were available for processing."
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  const now = new Date().toISOString();
  const stageRows = ["collection", "classification", "extraction", "validation", "normalization", "memory_build", "intelligence_ready"].map((stage, index) => ({
    job_id: job.id,
    stage_order: index + 1,
    stage_name: stage,
    status: hasUsableRows ? "completed" : stage === "collection" || stage === "classification" ? "completed" : "blocked",
    started_at: now,
    completed_at: hasUsableRows || stage === "collection" || stage === "classification" ? now : undefined,
    details: { documentType, sourceType: row.source_type ?? "manual_upload" },
    output_json: {
      rows: rows.length,
      validationIssues: issueRows.length,
      readinessScore,
      confidence
    },
    error_message: hasUsableRows ? undefined : "Upload has no extractable financial rows."
  }));
  const stagesInsert = await ready.supabase.from("processing_stages").insert(stageRows);
  if (stagesInsert.error) return dbError(stagesInsert.error);

  if (issueRows.length) {
    const issuesInsert = await ready.supabase.from("validation_issues").insert(
      issueRows.map((issue) => ({
        ...issue,
        job_id: job.id,
        processing_job_id: job.id,
        firm_id: row.firm_id,
        client_id: row.client_id,
        document_id: documentId
      }))
    );
    if (issuesInsert.error) return dbError(issuesInsert.error);
  }

  if (!hasUsableRows) {
    const documentUpdate = await updateRow("documents", documentId, {
      processing_status: "blocked",
      validation_status: validationStatus,
      document_category: documentType
    });
    if (!documentUpdate.ok) return documentUpdate;
    return {
      ok: true as const,
      data: {
        job,
        stages: stageRows,
        normalizedRecords: [],
        validationIssues: issueRows,
        intelligenceDatasets: [],
        readinessScore
      }
    };
  }

  const sourceRows = rows.length ? rows : [{ document_name: row.name ?? documentId, extracted_text: row.extracted_text?.slice(0, 1000) ?? "" }];
  const normalizedRows = sourceRows.slice(0, 100).map((sourceRow) => ({
    job_id: job.id,
    firm_id: row.firm_id,
    client_id: row.client_id,
    document_id: documentId,
    record_type: recordTypeFor(documentType),
    source_document_id: documentId,
    payload: sourceRow,
    normalized_payload: { ...sourceRow, document_type: documentType },
    source_payload: sourceRow,
    confidence,
    confidence_score: confidence,
    reconciliation_status: documentType === "bank_statement" || documentType === "sales_register" || documentType === "purchase_register" ? "matched" : "not_required"
  }));
  const normalizedInsert = await ready.supabase.from("normalized_records").insert(normalizedRows).select("*");
  if (normalizedInsert.error) return dbError(normalizedInsert.error);

  const financialRows = hasUsableRows ? sourceRows
    .map((sourceRow) => financialRecordFrom(sourceRow, documentType, documentId))
    .filter((record) => record.amount > 0 || record.counterparty || record.description)
    .slice(0, 100)
    .map((record) => ({ ...record, firm_id: row.firm_id, client_id: row.client_id })) : [];
  if (financialRows.length) {
    const financialInsert = await ready.supabase.from("financial_records").insert(financialRows);
    if (financialInsert.error) return dbError(financialInsert.error);
  }

  const counterparties = Array.from(new Set(sourceRows.map((sourceRow) => firstValue(sourceRow, ["customer_name", "vendor_name", "deductee_name", "employee_name", "description"])).filter(Boolean))).slice(0, 12);
  const entityInput = (counterparties.length ? counterparties : [row.name ?? `${documentType} document`]).map((name) => ({
    client_id: row.client_id,
    job_id: job.id,
    entity_type: counterparties.length ? "counterparty" : "business_event",
    display_name: name,
    attributes: { document_type: documentType, source_document_id: documentId },
    confidence
  }));
  const entitiesInsert = await ready.supabase.from("memory_entities").insert(entityInput).select("*");
  if (entitiesInsert.error) return dbError(entitiesInsert.error);

  const memoryInsert = await ready.supabase.from("financial_memory_events").insert({
    firm_id: row.firm_id,
    client_id: row.client_id,
    event_type: documentType,
    title: `${titleCase(documentType)} processed`,
    description: `${row.name ?? "Uploaded document"} produced ${normalizedRows.length} normalized records and ${datasetTypesFor(documentType).length} intelligence datasets.`,
    source_document_id: documentId,
    metadata: { job_id: job.id, readiness_score: readinessScore, issue_count: issueRows.length }
  });
  if (memoryInsert.error) return dbError(memoryInsert.error);

  const entityRows = entitiesInsert.data ?? [];
  if (entityRows.length > 1) {
    const relationshipRows = entityRows.slice(1).map((entity) => ({
      client_id: row.client_id,
      source_entity_id: entityRows[0].id,
      target_entity_id: entity.id,
      relationship_type: "appears_with",
      attributes: { document_id: documentId, job_id: job.id },
      confidence
    }));
    const relationshipInsert = await ready.supabase.from("memory_relationships").insert(relationshipRows);
    if (relationshipInsert.error) return dbError(relationshipInsert.error);
  }

  const datasetRows = datasetTypesFor(documentType).map((datasetType) => ({
    firm_id: row.firm_id,
    client_id: row.client_id,
    job_id: job.id,
    month: row.month,
    year: row.year,
    dataset_type: datasetType,
    readiness_status: hasUsableRows ? "ready" : "blocked",
    payload: { document_type: documentType, rows: sourceRows.slice(0, 20), validation_issues: issueRows },
    data_json: { source_document_id: documentId, normalized_record_count: normalizedRows.length, confidence },
    source_document_ids: [documentId],
    readiness_score: readinessScore,
    intelligence_ready: hasUsableRows
  }));
  const datasetInsert = await ready.supabase.from("intelligence_datasets").insert(datasetRows);
  if (datasetInsert.error) return dbError(datasetInsert.error);

  if (financialRows.length) {
    const inflow = financialRows.filter((record) => ["sale", "receipt", "cash_inflow"].includes(record.record_type)).reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
    const outflow = financialRows.filter((record) => ["purchase", "expense", "payment", "cash_outflow"].includes(record.record_type)).reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
    const calculationInsert = await ready.supabase.from("calculations").insert({
      firm_id: row.firm_id,
      client_id: row.client_id,
      month: row.month,
      year: row.year,
      cash_inflow: inflow,
      cash_outflow: outflow,
      net_cash_position: inflow - outflow,
      receivables: documentType === "sales_register" ? inflow : 0,
      payables: documentType === "purchase_register" ? outflow : 0,
      gst_estimate: documentType === "gst_data" ? Math.max(0, inflow - outflow) : Math.max(0, inflow * 0.18),
      tds_estimate: documentType === "tds_data" ? Math.max(0, outflow) : 0,
      overdue_invoices: financialRows.filter((record) => record.status === "overdue").reduce((sum, record) => sum + Number(record.amount ?? 0), 0),
      readiness_score: readinessScore,
      risk_score: Math.max(0, 100 - readinessScore),
      data_completeness: hasUsableRows ? 88 : 30,
      missing_inputs: issueRows.filter((issue) => issue.category === "missing_input").map((issue) => issue.issue_type),
      source_document_ids: [documentId],
      formula_audit: {
        source: "processing_layer",
        formulas: ["cash_inflow=sum(receipt/sale records)", "cash_outflow=sum(payment/purchase records)", "net_cash_position=cash_inflow-cash_outflow"]
      }
    });
    if (calculationInsert.error) return dbError(calculationInsert.error);
  }

  const documentUpdate = await updateRow("documents", documentId, {
    processing_status: hasUsableRows ? "intelligence_ready" : "blocked",
    validation_status: validationStatus,
    document_category: documentType
  });
  if (!documentUpdate.ok) return documentUpdate;

  return {
    ok: true as const,
    data: {
      job,
      stages: stageRows,
      normalizedRecords: normalizedInsert.data ?? [],
      validationIssues: issueRows,
      intelligenceDatasets: datasetRows,
      readinessScore
    }
  };
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
  if (!readiness.ok) {
    const blocked = readiness as typeof readiness & { readiness?: { score: number; factors: Record<string, number>; blockers?: Record<string, number> } };
    return {
      ...readiness,
      trainingGuidance: buildReadinessTrainingGuidance(blocked.readiness)
    };
  }
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
  const intelligence = buildFinancialIntelligenceAnswer({
    question: input.question,
    readiness: readinessData,
    calculations: calculations.data ?? [],
    datasets: datasets.data ?? [],
    memoryEvents: memory.data ?? []
  });
  return {
    ok: true as const,
    data: {
      answer: intelligence.answer,
      question: input.question,
      readiness: readinessData,
      intelligence,
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
      suggested_talking_points: ["Review missing inputs", "Confirm validation issues", "Publish only verified outputs"]
    })
    .select("*")
    .single();
  return error ? dbError(error) : { ok: true as const, data };
}
