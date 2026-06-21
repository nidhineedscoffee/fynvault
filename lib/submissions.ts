import { randomBytes } from "crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase";
import { UploadDocumentSchema, uploadDocumentForClient } from "./mvp";

export const SubmissionRequirementSchema = z.object({
  documentCategory: z.enum(["bank_statement", "sales_register", "purchase_register", "gst_data", "tds_data", "expense_sheet", "invoice", "contract", "other"]),
  label: z.string().min(1).max(160),
  priority: z.enum(["normal", "high"]).default("normal"),
  owner: z.string().max(160).optional()
});

export const CreateSubmissionCycleSchema = z.object({
  firmId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  cycleName: z.string().min(1).max(180).default("Monthly MIS"),
  frequency: z.enum(["monthly", "quarterly", "annual", "one_time"]).default("monthly"),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodYear: z.number().int().min(2000).max(2100).optional(),
  dueDate: z.string().min(1),
  owner: z.string().max(160).optional(),
  requirements: z.array(SubmissionRequirementSchema).min(1).default([
    { documentCategory: "bank_statement", label: "Bank Statement", priority: "high" },
    { documentCategory: "sales_register", label: "Sales Register", priority: "high" },
    { documentCategory: "purchase_register", label: "Purchase Register", priority: "high" },
    { documentCategory: "gst_data", label: "GST Data", priority: "high" }
  ])
});

export const SendReminderSchema = z.object({
  requestId: z.string().uuid(),
  channel: z.enum(["email", "whatsapp"]).default("email"),
  tone: z.enum(["friendly", "follow_up", "urgent"]).optional()
});

export const EscalateSubmissionSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().max(500).optional()
});

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return { ok: false as const, status, error, ...extra };
}

function unavailable() {
  return fail(503, "Supabase is not configured.");
}

function dbError(error: { message: string }) {
  const missing = /relation .* does not exist|schema cache|does not exist/i.test(error.message);
  return fail(missing ? 503 : 500, missing ? "Submission tables are not configured yet. Create submission_cycles, submission_requirements, submission_requests, submission_reminders, submission_escalations, and client_upload_links in Supabase." : error.message);
}

function daysBetween(date: Date, now = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

function reminderTone(daysOverdue: number) {
  if (daysOverdue >= 5) return "urgent" as const;
  if (daysOverdue >= 3) return "follow_up" as const;
  return "friendly" as const;
}

function reminderStatus(daysOverdue: number, lastContacted?: string | null) {
  if (daysOverdue >= 7) return "escalation_due";
  if (lastContacted) return "reminder_sent";
  if (daysOverdue > 0) return "overdue";
  if (daysOverdue === 0) return "due_today";
  return "awaiting_client";
}

function persistedReminderStatus(tone: "friendly" | "follow_up" | "urgent") {
  if (tone === "urgent") return "urgent_sent";
  if (tone === "follow_up") return "follow_up_sent";
  return "friendly_sent";
}

function tokenUrl(token: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fynvault.vercel.app"}/client-upload/${token}`;
}

function buildReminderCopy(input: {
  clientName: string;
  missingItems: string[];
  dueDate: string;
  uploadUrl: string;
  owner?: string | null;
  tone: "friendly" | "follow_up" | "urgent";
}) {
  const bulletList = input.missingItems.map((item) => `- ${item}`).join("\n");
  const opener = input.tone === "urgent"
    ? "The following items are still pending and are now overdue:"
    : input.tone === "follow_up"
      ? "Just a reminder that we are still awaiting the following items required to complete your reporting cycle:"
      : "We're preparing your monthly financial review and are awaiting the following:";
  const closing = input.tone === "urgent"
    ? "Without these documents, reporting may be delayed. Please share them as soon as possible."
    : input.tone === "follow_up"
      ? "Receiving these documents will help us complete your financial review on time."
      : "Please share them at your convenience.";
  const whatsapp = `Hi ${input.clientName},\n\n${opener}\n\n${bulletList}\n\n${closing}\n\nSecure upload: ${input.uploadUrl}\n\nThank you.`;
  const email = `Subject: Pending documents for ${input.clientName} financial review\n\nHi ${input.clientName},\n\n${opener}\n\n${bulletList}\n\nDue date: ${input.dueDate}\nSecure upload link: ${input.uploadUrl}\nAssigned accountant: ${input.owner || "CA team"}\n\n${closing}\n\nRegards,\nFynny Collection Engine`;
  return { whatsapp, email };
}

export async function createSubmissionCycle(input: z.infer<typeof CreateSubmissionCycleSchema>) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return unavailable();

  const { data: client, error: clientError } = await supabase.from("clients").select("id,name,firm_id,contact_email").eq("id", input.clientId).maybeSingle();
  if (clientError) return dbError(clientError);
  if (!client) return fail(404, "Client not found.");
  if (input.firmId && client.firm_id !== input.firmId) return fail(403, "Client does not belong to this firm.");

  const { data: cycle, error: cycleError } = await supabase
    .from("submission_cycles")
    .insert({
      firm_id: input.firmId ?? client.firm_id,
      client_id: input.clientId,
      cycle_name: input.cycleName,
      frequency: input.frequency,
      period_month: input.periodMonth,
      period_year: input.periodYear,
      due_date: input.dueDate,
      owner: input.owner,
      status: "active"
    })
    .select("*")
    .single();
  if (cycleError) return dbError(cycleError);

  const requirementRows = input.requirements.map((requirement) => ({
    firm_id: input.firmId ?? client.firm_id,
    client_id: input.clientId,
    cycle_id: cycle.id,
    document_category: requirement.documentCategory,
    required_item: requirement.label,
    priority: requirement.priority,
    instructions: requirement.owner ? `Owner: ${requirement.owner}` : null
  }));
  const { data: requirements, error: requirementError } = await supabase.from("submission_requirements").insert(requirementRows).select("*");
  if (requirementError) return dbError(requirementError);

  const requestRows = (requirements ?? []).map((requirement) => {
    const token = randomBytes(32).toString("base64url");
    return {
      firm_id: input.firmId ?? client.firm_id,
      client_id: input.clientId,
      cycle_id: cycle.id,
      requirement_id: requirement.id,
      required_item: requirement.required_item,
      document_category: requirement.document_category,
      due_date: input.dueDate,
      owner: input.owner,
      priority: requirement.priority,
      status: "awaiting_client",
      reminder_status: "not_sent",
      secure_upload_token: token,
      secure_upload_url: tokenUrl(token)
    };
  });
  const { data: requests, error: requestError } = await supabase.from("submission_requests").insert(requestRows).select("*");
  if (requestError) return dbError(requestError);

  if (requests?.length) {
    const linkRows = requests.map((request) => ({
      firm_id: input.firmId ?? client.firm_id,
      client_id: input.clientId,
      submission_request_id: request.id,
      token: request.secure_upload_token,
      upload_url: request.secure_upload_url,
      status: "active",
      expires_at: null
    }));
    const linkInsert = await supabase.from("client_upload_links").insert(linkRows);
    if (linkInsert.error) return dbError(linkInsert.error);
  }

  return { ok: true as const, data: { cycle, requirements, requests } };
}

export async function listPendingSubmissions(firmId: string, filters: { status?: string; priority?: string } = {}) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return unavailable();
  let query = supabase
    .from("submission_requests")
    .select("*, clients(name,contact_email,business_type)")
    .eq("firm_id", firmId)
    .in("status", ["awaiting_client", "reminder_sent", "overdue", "escalated"])
    .order("due_date", { ascending: true });
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) return dbError(error);
  const now = new Date();
  const pending = (data ?? []).map((row) => {
    const due = new Date(row.due_date);
    const daysOverdue = Number.isNaN(due.valueOf()) ? 0 : Math.max(0, daysBetween(due, now));
    return {
      ...row,
      client_name: row.clients?.name ?? "Client",
      days_overdue: daysOverdue,
      computed_reminder_status: reminderStatus(daysOverdue, row.last_contacted_at)
    };
  });
  const total = pending.length;
  const overdue = pending.filter((row) => row.days_overdue > 0).length;
  const dueToday = pending.filter((row) => row.days_overdue === 0 && new Date(row.due_date).toDateString() === now.toDateString()).length;
  const highPriority = pending.filter((row) => row.priority === "high").length;
  return {
    ok: true as const,
    data: {
      pending,
      health: {
        pendingUploads: total,
        overdueClients: new Set(pending.filter((row) => row.days_overdue > 0).map((row) => row.client_id)).size,
        dueToday,
        highPriority,
        submissionCompletionRate: total ? 0 : 100,
        reportsBlocked: overdue
      }
    }
  };
}

export async function sendSubmissionReminder(firmId: string, input: z.infer<typeof SendReminderSchema>) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return unavailable();
  const { data: request, error } = await supabase
    .from("submission_requests")
    .select("*, clients(name,contact_email)")
    .eq("id", input.requestId)
    .eq("firm_id", firmId)
    .maybeSingle();
  if (error) return dbError(error);
  if (!request) return fail(404, "Submission request not found.");
  const due = new Date(request.due_date);
  const daysOverdue = Number.isNaN(due.valueOf()) ? 0 : Math.max(0, daysBetween(due));
  const tone = input.tone ?? reminderTone(daysOverdue);
  const uploadUrl = request.secure_upload_url || tokenUrl(request.secure_upload_token);
  const copy = buildReminderCopy({
    clientName: request.clients?.name ?? "Client",
    missingItems: [request.required_item ?? request.document_category],
    dueDate: request.due_date,
    uploadUrl,
    owner: request.owner,
    tone
  });
  const { data: reminder, error: reminderError } = await supabase
    .from("submission_reminders")
    .insert({
      firm_id: firmId,
      client_id: request.client_id,
      submission_request_id: request.id,
      channel: input.channel,
      tone,
      status: "queued",
      subject: `Pending documents for ${request.clients?.name ?? "client"} financial review`,
      message: input.channel === "whatsapp" ? copy.whatsapp : copy.email,
      sent_at: new Date().toISOString()
    })
    .select("*")
    .single();
  if (reminderError) return dbError(reminderError);
  const update = await supabase
    .from("submission_requests")
    .update({ status: "reminder_sent", reminder_status: persistedReminderStatus(tone), last_contacted_at: new Date().toISOString() })
    .eq("id", request.id);
  if (update.error) return dbError(update.error);
  return { ok: true as const, data: { reminder, copy, uploadUrl } };
}

export async function escalateSubmission(firmId: string, input: z.infer<typeof EscalateSubmissionSchema>) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return unavailable();
  const { data: request, error } = await supabase.from("submission_requests").select("*").eq("id", input.requestId).eq("firm_id", firmId).maybeSingle();
  if (error) return dbError(error);
  if (!request) return fail(404, "Submission request not found.");
  const { data: escalation, error: escalationError } = await supabase
    .from("submission_escalations")
    .insert({
      firm_id: firmId,
      client_id: request.client_id,
      submission_request_id: request.id,
      status: "open",
      reason: input.reason ?? "Submission overdue beyond escalation threshold.",
      created_at: new Date().toISOString()
    })
    .select("*")
    .single();
  if (escalationError) return dbError(escalationError);
  const update = await supabase.from("submission_requests").update({ status: "escalated", reminder_status: "escalated" }).eq("id", request.id);
  if (update.error) return dbError(update.error);
  return { ok: true as const, data: { escalation } };
}

export async function getClientUploadLink(token: string) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return unavailable();
  const { data, error } = await supabase
    .from("client_upload_links")
    .select("*, submission_requests(*, clients(name,contact_email))")
    .eq("token", token)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "Upload link is invalid or expired.");
  if (data.status !== "active") return fail(410, "Upload link is no longer active.");
  return { ok: true as const, data: { uploadLink: data, request: data.submission_requests } };
}

export async function uploadForClientLink(token: string, input: z.infer<typeof UploadDocumentSchema>) {
  const link = await getClientUploadLink(token);
  if (!link.ok) return link;
  const request = (link.data as { request: Record<string, unknown> }).request;
  const upload = await uploadDocumentForClient(String(request.client_id), {
    ...input,
    firmId: String(request.firm_id),
    documentCategory: String(request.document_category),
    storageUrl: input.storageUrl
  });
  if (!upload.ok) return upload;
  const supabase = createSupabaseServerClient();
  if (!supabase) return unavailable();
  await Promise.all([
    supabase.from("submission_requests").update({ status: "received", received_at: new Date().toISOString(), received_document_id: upload.data.id }).eq("id", request.id),
    supabase.from("client_upload_links").update({ status: "used", used_at: new Date().toISOString() }).eq("token", token)
  ]);
  return upload;
}
