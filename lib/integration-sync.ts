import { env } from "./env";
import { uploadDocumentForClient } from "./mvp";

type ProviderSourceType = "gmail" | "google_drive" | "zoho_books";

type CollectInput = {
  clientId: string;
  dataSource: {
    id: string;
    firm_id?: string;
    source_type: ProviderSourceType | string;
    provider?: string;
    metadata?: Record<string, unknown> | null;
  };
  accessToken: string;
};

type CollectedDocument = {
  name: string;
  sourceType: ProviderSourceType;
  documentCategory: string;
  extractedText: string;
  storageUrl?: string;
  metadata?: Record<string, unknown>;
};

type ProviderFetchResult = {
  ok: boolean;
  status?: number;
  payload?: unknown;
  error?: string;
};

const FINANCIAL_TERMS = ["invoice", "bill", "gst", "statement", "payment", "tds", "tax", "receipt", "purchase", "sales"];
const TEXT_ATTACHMENT_EXTENSIONS = new Set([".csv", ".txt", ".json", ".md"]);

async function fetchJson(url: string | URL, accessToken: string): Promise<ProviderFetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json"
      }
    });
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : {};
    return response.ok ? { ok: true, payload } : { ok: false, status: response.status, payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Provider request failed." };
  }
}

function base64UrlDecode(value?: string) {
  if (!value) return "";
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
}

function extensionOf(name: string) {
  const lastDot = name.lastIndexOf(".");
  return lastDot >= 0 ? name.slice(lastDot).toLowerCase() : "";
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function recordsToCsv(records: Array<Record<string, unknown>>, columns: string[]) {
  const header = columns.map(csvCell).join(",");
  const rows = records.map((record) => columns.map((column) => csvCell(record[column])).join(","));
  return [header, ...rows].join("\n");
}

function categoryForName(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("bank") || normalized.includes("statement")) return "bank_statement";
  if (normalized.includes("gst") || normalized.includes("gstr")) return "gst_data";
  if (normalized.includes("tds") || normalized.includes("tax")) return "tds_data";
  if (normalized.includes("purchase") || normalized.includes("bill") || normalized.includes("vendor")) return "purchase_register";
  if (normalized.includes("sales") || normalized.includes("invoice") || normalized.includes("customer")) return "sales_register";
  return "other";
}

function firstString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isTextAttachment(filename: string, mimeType: string) {
  return mimeType.startsWith("text/") || TEXT_ATTACHMENT_EXTENSIONS.has(extensionOf(filename));
}

function gmailSearchUrl() {
  const query = `newer_than:365d has:attachment (${FINANCIAL_TERMS.join(" OR ")})`;
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "10");
  return url;
}

function extractGmailAttachments(payload: Record<string, unknown>) {
  const found: Array<{ filename: string; mimeType: string; attachmentId?: string; inlineData?: string }> = [];
  const visit = (part: unknown) => {
    if (!part || typeof part !== "object") return;
    const row = part as Record<string, unknown>;
    const filename = firstString(row.filename);
    const mimeType = firstString(row.mimeType);
    const body = row.body && typeof row.body === "object" ? row.body as Record<string, unknown> : {};
    const attachmentId = firstString(body.attachmentId);
    const inlineData = firstString(body.data);
    if (filename || attachmentId || inlineData) {
      found.push({ filename: filename || "gmail-attachment", mimeType, attachmentId, inlineData });
    }
    const parts = Array.isArray(row.parts) ? row.parts : [];
    parts.forEach(visit);
  };
  visit(payload);
  return found;
}

function extractGmailHeaders(payload: Record<string, unknown>) {
  const headers = Array.isArray(payload.headers) ? payload.headers : [];
  const map = new Map(
    headers
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => [firstString(row.name).toLowerCase(), firstString(row.value)])
  );
  return {
    subject: map.get("subject") ?? "",
    from: map.get("from") ?? "",
    date: map.get("date") ?? ""
  };
}

async function readGmailAttachmentText(accessToken: string, messageId: string, attachment: { filename: string; mimeType: string; attachmentId?: string; inlineData?: string }) {
  const inlineText = base64UrlDecode(attachment.inlineData).replace(/\0/g, "").trim();
  if (inlineText) {
    return inlineText.slice(0, 120_000);
  }

  if (!attachment.attachmentId || !isTextAttachment(attachment.filename, attachment.mimeType)) {
    return "";
  }

  const attachmentUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.attachmentId}`);
  const attachmentResult = await fetchJson(attachmentUrl, accessToken);
  if (!attachmentResult.ok || !attachmentResult.payload || typeof attachmentResult.payload !== "object") {
    return "";
  }

  const bodyText = base64UrlDecode(firstString((attachmentResult.payload as Record<string, unknown>).data)).replace(/\0/g, "").trim();
  return bodyText.slice(0, 120_000);
}

async function collectGmail(input: CollectInput): Promise<CollectedDocument[]> {
  const list = await fetchJson(gmailSearchUrl(), input.accessToken);
  if (!list.ok) throw new Error(`Gmail sync failed${list.status ? ` (${list.status})` : ""}.`);
  const messages = Array.isArray((list.payload as { messages?: unknown[] }).messages) ? (list.payload as { messages: Array<{ id?: string }> }).messages : [];
  const collected: CollectedDocument[] = [];

  for (const message of messages.slice(0, 8)) {
    if (!message.id) continue;
    const detailsUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`);
    detailsUrl.searchParams.set("format", "full");
    const details = await fetchJson(detailsUrl, input.accessToken);
    if (!details.ok || !details.payload || typeof details.payload !== "object") continue;
    const payload = details.payload as Record<string, unknown>;
    const snippet = firstString(payload.snippet);
    const messagePayload = asObject(payload.payload);
    const attachments = extractGmailAttachments(messagePayload);
    const headers = extractGmailHeaders(messagePayload);
    const storageUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(message.id)}`;

    if (!attachments.length) {
      collected.push({
        name: headers.subject || `Gmail financial email ${message.id}`,
        sourceType: "gmail",
        documentCategory: categoryForName(`${headers.subject} ${snippet}`),
        extractedText: [
          "source,subject,from,sent_at,description,status",
          `gmail,${csvCell(headers.subject || `message-${message.id}`)},${csvCell(headers.from)},${csvCell(headers.date)},${csvCell(snippet)},needs_review`
        ].join("\n"),
        storageUrl,
        metadata: {
          providerMessageId: message.id,
          subject: headers.subject,
          from: headers.from,
          sentAt: headers.date,
          snippet,
          attachmentCount: 0,
          filter: "financial_terms_with_attachments"
        }
      });
      continue;
    }

    for (const attachment of attachments.slice(0, 8)) {
      const attachmentText = await readGmailAttachmentText(input.accessToken, message.id, attachment);
      const fallbackExtracted = [
        "source,subject,from,sent_at,attachment_name,attachment_type,description,status",
        `gmail,${csvCell(headers.subject || `message-${message.id}`)},${csvCell(headers.from)},${csvCell(headers.date)},${csvCell(attachment.filename)},${csvCell(attachment.mimeType)},${csvCell(snippet)},needs_review`
      ].join("\n");
      const attachmentName = attachment.filename || `${headers.subject || `gmail-${message.id}`}.txt`;
      collected.push({
        name: attachmentName,
        sourceType: "gmail",
        documentCategory: categoryForName(`${attachmentName} ${headers.subject} ${snippet}`),
        extractedText: attachmentText || fallbackExtracted,
        storageUrl,
        metadata: {
          providerMessageId: message.id,
          subject: headers.subject,
          from: headers.from,
          sentAt: headers.date,
          snippet,
          attachmentName,
          attachmentMimeType: attachment.mimeType,
          attachmentId: attachment.attachmentId,
          attachmentTextExtracted: Boolean(attachmentText),
          filter: "financial_terms_with_attachments"
        }
      });
    }
  }

  return collected;
}

async function collectGoogleDrive(input: CollectInput): Promise<CollectedDocument[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime,size)");
  url.searchParams.set("q", `trashed=false and (${FINANCIAL_TERMS.map((term) => `name contains '${term}'`).join(" or ")})`);
  const list = await fetchJson(url, input.accessToken);
  if (!list.ok) throw new Error(`Google Drive sync failed${list.status ? ` (${list.status})` : ""}.`);
  const files = Array.isArray((list.payload as { files?: unknown[] }).files) ? (list.payload as { files: Array<Record<string, unknown>> }).files : [];

  const collected: CollectedDocument[] = [];
  for (const file of files) {
    const name = firstString(file.name) || "Drive financial file";
    const mimeType = firstString(file.mimeType);
    const extractedText = await readDriveFileText(input.accessToken, file);
    collected.push({
      name,
      sourceType: "google_drive" as const,
      documentCategory: categoryForName(name),
      extractedText: extractedText || [
        "source,file_name,mime_type,modified_time,status",
        `google_drive,${csvCell(name)},${csvCell(mimeType)},${csvCell(file.modifiedTime)},needs_review`
      ].join("\n"),
      storageUrl: firstString(file.webViewLink),
      metadata: {
        providerFileId: firstString(file.id),
        mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        textExtracted: Boolean(extractedText)
      }
    });
  }
  return collected;
}

async function readDriveFileText(accessToken: string, file: Record<string, unknown>) {
  const id = firstString(file.id);
  const name = firstString(file.name);
  const mimeType = firstString(file.mimeType);
  if (!id) return "";

  const isGoogleSheet = mimeType === "application/vnd.google-apps.spreadsheet";
  const isTextFile = isTextAttachment(name, mimeType) || ["application/json", "text/csv", "text/plain"].includes(mimeType);
  if (!isGoogleSheet && !isTextFile) return "";

  const url = isGoogleSheet
    ? new URL(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/csv`)
    : new URL(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "text/csv,text/plain,application/json"
      }
    });
    if (!response.ok) return "";
    return (await response.text()).replace(/\0/g, "").trim().slice(0, 120_000);
  } catch {
    return "";
  }
}

async function collectZoho(input: CollectInput): Promise<CollectedDocument[]> {
  const orgs = await fetchJson(new URL(`${env.ZOHO_BOOKS_BASE_URL}/organizations`), input.accessToken);
  if (!orgs.ok) throw new Error(`Zoho organization sync failed${orgs.status ? ` (${orgs.status})` : ""}.`);
  const organizations = Array.isArray((orgs.payload as { organizations?: unknown[] }).organizations)
    ? (orgs.payload as { organizations: Array<Record<string, unknown>> }).organizations
    : [];
  const organizationId = firstString(input.dataSource.metadata?.zohoOrganizationId) || firstString(organizations[0]?.organization_id);
  if (!organizationId) throw new Error("Zoho Books organization was not found for this account.");

  const endpoints = [
    { key: "invoices", path: "invoices", category: "sales_register", columns: ["invoice_number", "customer_name", "date", "due_date", "total", "balance", "status"] },
    { key: "bills", path: "bills", category: "purchase_register", columns: ["bill_number", "vendor_name", "date", "due_date", "total", "balance", "status"] },
    { key: "customerpayments", path: "customerpayments", category: "bank_statement", columns: ["payment_number", "customer_name", "date", "amount", "payment_mode", "status"] },
    { key: "expenses", path: "expenses", category: "purchase_register", columns: ["expense_id", "vendor_name", "date", "amount", "expense_category_name", "status"] }
  ];
  const collected: CollectedDocument[] = [];

  for (const endpoint of endpoints) {
    const url = new URL(`${env.ZOHO_BOOKS_BASE_URL}/${endpoint.path}`);
    url.searchParams.set("organization_id", organizationId);
    url.searchParams.set("per_page", "25");
    const result = await fetchJson(url, input.accessToken);
    if (!result.ok) continue;
    const records = Array.isArray((result.payload as Record<string, unknown>)[endpoint.key])
      ? (result.payload as Record<string, unknown>)[endpoint.key] as Array<Record<string, unknown>>
      : [];
    if (!records.length) continue;
    collected.push({
      name: `Zoho Books ${endpoint.path}`,
      sourceType: "zoho_books",
      documentCategory: endpoint.category,
      extractedText: recordsToCsv(records.slice(0, 25), endpoint.columns),
      metadata: {
        zohoOrganizationId: organizationId,
        module: endpoint.path,
        recordCount: records.length
      }
    });
  }

  return collected;
}

async function providerDocuments(input: CollectInput) {
  if (input.dataSource.source_type === "gmail") return collectGmail(input);
  if (input.dataSource.source_type === "google_drive") return collectGoogleDrive(input);
  if (input.dataSource.source_type === "zoho_books") return collectZoho(input);
  throw new Error(`Sync is not implemented for ${input.dataSource.source_type}.`);
}

export async function collectAndProcessDataSource(input: CollectInput) {
  const documents = await providerDocuments(input);
  const uploaded = [];
  const errors = [];

  for (const document of documents) {
    const result = await uploadDocumentForClient(input.clientId, {
      firmId: input.dataSource.firm_id,
      name: document.name,
      type: "integration_document",
      sourceType: document.sourceType,
      documentCategory: document.documentCategory,
      storageUrl: document.storageUrl,
      extractedText: document.extractedText,
      metadata: {
        ...document.metadata,
        dataSourceId: input.dataSource.id,
        provider: input.dataSource.provider,
        collectedAt: new Date().toISOString()
      }
    });

    if (result.ok) {
      uploaded.push(result.data);
    } else {
      errors.push({ document: document.name, error: result.error });
    }
  }

  return {
    fileCount: uploaded.length,
    uploaded,
    errors
  };
}
