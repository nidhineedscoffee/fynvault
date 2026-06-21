"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AgenticGlyph, AgenticLoading } from "@/components/agentic-loading";

type ApiState<T> = { loading: boolean; data: T | null; error: string | null };
type StatusResponse = { mode?: string; providers?: Record<string, boolean>; missing?: Record<string, string[]> };
type SessionResponse = { authenticated: boolean; user?: { email?: string; name?: string } };
type ProcessingOverviewResponse = {
  ok: boolean;
  data?: { counts: { total: number; intelligenceReady: number; byStatus: Record<string, number> }; jobs: ProcessingJob[] };
  error?: string;
};
type ProcessingJob = {
  id: string;
  client_id?: string;
  document_id?: string;
  source_type?: string;
  status: string;
  current_stage: string;
  intelligence_readiness_score?: number;
  intelligence_ready?: boolean;
  created_at?: string;
};
type ReadinessResponse = {
  ok: boolean;
  data?: { intelligenceReady: boolean; score: number; factors: Record<string, number>; blockers: Record<string, number> };
  error?: string;
};
type ListResponse<T> = { ok: boolean; data?: T[] | Record<string, unknown>; error?: string };
type Client = { id: string; name: string; business_type?: string; contact_email?: string; created_at?: string };
type Issue = { id: string; severity: string; category: string; message: string; status: string; suggested_fix?: string };
type DataSource = { id: string; source_type: string; provider: string; connection_status: string; consent_status?: string; last_sync_at?: string };
type Report = { id: string; report_type: string; status: string; published_to_client?: boolean; created_at?: string };
type ExportRow = { id: string; export_type: string; file_format: string; storage_url?: string; created_at?: string };
type SubmissionRequest = {
  id: string;
  client_id: string;
  client_name?: string;
  required_item?: string;
  document_category?: string;
  due_date?: string;
  days_overdue?: number;
  computed_reminder_status?: string;
  reminder_status?: string;
  last_contacted_at?: string;
  owner?: string;
  priority?: string;
  status?: string;
};
type SubmissionHealth = {
  pendingUploads: number;
  overdueClients: number;
  dueToday: number;
  highPriority: number;
  submissionCompletionRate: number;
  reportsBlocked: number;
};
type SubmissionPendingResponse = {
  ok: boolean;
  data?: {
    pending: SubmissionRequest[];
    health: SubmissionHealth;
  };
  error?: string;
};
type ExportLayoutColumn = { key: string; label: string; type: string; formula?: string; source?: string };
type ExportLayout = { id: string; label: string; description: string; columns: ExportLayoutColumn[]; sheets: Array<{ name: string; purpose: string; columns: string[] }>; standardProcess: string[] };
type IntelligencePayload = {
  matchedUseCases?: Array<{ id: string; label: string; intent: string; requiredEvidence: string[] }>;
  formulas?: Array<{ label: string; formula: string; useWhen: string; guardrail: string }>;
  processChecks?: string[];
  requiredEvidence?: string[];
  exportLayout?: ExportLayout;
  nextBestActions?: string[];
  confidence?: string;
};
type AskActionPayload = {
  sampleFiles?: string[];
  suggestedPrompts?: string[];
  syncedSources?: Array<{ provider: string; sourceType: string; message: string; fileCount: number }>;
  report?: { id: string; reportType: string; status: string };
  export?: { id: string; exportType: string; fileFormat: string; file?: { filename: string; storageUrl: string } };
};
type AskMessage = { role: "user" | "fynny"; text: string; blocked?: boolean; intelligence?: IntelligencePayload };
type ClientCreateInput = { name: string; businessType?: string; contactEmail?: string };
type TabId = "ask" | "processing" | "clients" | "sources" | "collection" | "validation" | "memory" | "reports" | "exports" | "advisory" | "portal" | "settings";
type ActionNotice = { tone: "success" | "warning" | "error"; title: string; body: string } | null;
type SourceCategory = "all" | "upload" | "integration" | "manual";
type SourceOption = {
  id: string;
  sourceType?: string;
  label: string;
  provider: string;
  icon: string;
  category: SourceCategory;
  description: string;
  action: "upload" | "connect" | "manual";
  locked?: boolean;
  lockedReason?: string;
};

const navItems: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "ask", label: "Ask Fynny", icon: "psychology" },
  { id: "processing", label: "Processing Center", icon: "tune" },
  { id: "clients", label: "Clients", icon: "groups" },
  { id: "sources", label: "Data Sources", icon: "database" },
  { id: "collection", label: "Collection Queue", icon: "assignment_late" },
  { id: "reports", label: "Reports", icon: "assessment" },
  { id: "exports", label: "Exports", icon: "file_download" },
  { id: "memory", label: "Financial Memory", icon: "memory" },
  { id: "advisory", label: "Advisory", icon: "auto_graph" },
  { id: "portal", label: "Client Portal", icon: "approval_delegation" },
  { id: "settings", label: "Settings", icon: "settings" }
];
const processingStages = ["collection", "classification", "extraction", "validation", "normalization", "memory_build", "intelligence_ready"];
const sourceOptions: SourceOption[] = [
  { id: "manual_upload", label: "Secure Upload", provider: "Fynny Vault", icon: "upload_file", category: "upload", action: "upload", description: "Upload PDFs, spreadsheets, bank statements, GST files, and exports." },
  { id: "gmail", label: "Gmail", provider: "Google", icon: "mail", category: "integration", action: "connect", description: "Connect Gmail for financial emails and attachments only." },
  { id: "google_drive", label: "Google Drive", provider: "Google", icon: "add_to_drive", category: "integration", action: "connect", description: "Connect Drive folders and pull financial files into processing." },
  { id: "zoho_books", label: "Zoho Books", provider: "Zoho", icon: "account_balance", category: "integration", action: "connect", description: "Bring books, invoices, customers, and accounting exports into Fynny." },
  { id: "tally", label: "Tally", provider: "Tally", icon: "receipt_long", category: "integration", action: "connect", locked: true, lockedReason: "Tally direct API is locked for this MVP. Upload Tally CSV/XLSX exports instead.", description: "Locked for direct API. Upload Tally exports as CSV/XLSX for processing, validation, and MIS intelligence." },
  { id: "slack", sourceType: "email", label: "Slack", provider: "Slack", icon: "tag", category: "integration", action: "connect", description: "Collect approved finance files from client workflow channels." },
  { id: "bank_statement", label: "Bank Statements", provider: "Manual upload", icon: "assured_workload", category: "upload", action: "upload", description: "Process statement files through validation and financial memory." },
  { id: "gst_file", label: "GST Files", provider: "Manual upload", icon: "receipt_long", category: "upload", action: "upload", description: "Validate GST inputs, filing periods, and missing compliance records." },
  { id: "spreadsheet", sourceType: "spreadsheet", label: "Spreadsheets", provider: "Excel / CSV", icon: "table_chart", category: "upload", action: "upload", description: "Upload CSV spreadsheet exports for trackers, reconciliations, ledgers, and reports." },
  { id: "whatsapp", label: "WhatsApp Files", provider: "Manual collection", icon: "forum", category: "manual", action: "upload", description: "Use safe upload links or forwarded files. No full WhatsApp access requested." }
];
const askSuggestions = [
  { icon: "warning", title: "Client Risks", prompt: "Identify the top client risks from validated data.", body: "Find attention areas once a client is intelligence ready." },
  { icon: "account_balance_wallet", title: "Cash Flow", prompt: "Explain cash-flow pressure and runway using verified records.", body: "Use receivables, payables, and bank records." },
  { icon: "verified_user", title: "Compliance", prompt: "List compliance gaps and missing filing inputs.", body: "Check GST, TDS, and missing validation blockers." },
  { icon: "trending_up", title: "Advisory", prompt: "Find advisory opportunities from financial memory.", body: "Surface tax, working capital, and risk opportunities." },
  { icon: "table_chart", title: "Export Layout", prompt: "Give me the standard CSV and Excel export layout with formulas for this client.", body: "Return model columns, sheets, and evidence checks." },
  { icon: "mail", title: "Client Demo", prompt: "Give me one client-specific demo using Aster Foods and show all product use cases from Gmail sync to reports.", body: "Get one client story, sample files, prompts, and end-to-end success criteria.", wide: true }
];
const clientDemoFlow: Array<{ title: string; body: string; actionLabel: string; tab: TabId; prompt?: string }> = [
  { title: "Choose Client", body: "Choose `Aster Foods Pvt Ltd` as the active client so every sync, upload, and output stays together.", actionLabel: "Open Clients", tab: "clients" as TabId },
  { title: "Connect Intake", body: "Connect Gmail as the CA operator, then send the three email sample files or upload the Aster Foods pack.", actionLabel: "Open Sources", tab: "sources" as TabId },
  { title: "Run Processing", body: "Sync Gmail or upload the pack, then review validation issues, readiness, and stage progress in the pipeline.", actionLabel: "Open Processing", tab: "processing" as TabId },
  { title: "Test AI", body: "Ask about customers, GST mismatch, overdue invoices, oldest unpaid bill, payroll change, renewal, and bank review.", actionLabel: "Open Ask", tab: "ask" as TabId, prompt: "Who are our top customers this quarter?" },
  { title: "Generate Outputs", body: "Create GST CSV and MIS Excel outputs once the client reaches Intelligence Ready.", actionLabel: "Open Exports", tab: "exports" as TabId, prompt: "Generate an MIS workbook in Excel." },
  { title: "Show Advisory", body: "Finish with evidence-backed advisory opportunities to demonstrate the AI layer clearly.", actionLabel: "Run Advisory Prompt", tab: "ask" as TabId, prompt: "What advisory opportunities do you see from verified records?" }
];

function emptyState<T>(): ApiState<T> {
  return { loading: true, data: null, error: null };
}
async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return (await response.json().catch(() => ({}))) as T;
}
async function readFilePreview(file: File) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    return readPdfTextPreview(file);
  }
  if (!/\.(csv|txt|json|md)$/i.test(file.name) && !["text/csv", "text/plain", "application/json", "text/markdown", "application/vnd.ms-excel"].includes(file.type)) {
    return undefined;
  }
  return file.text().then((text) => text.slice(0, 40_000)).catch(() => undefined);
}
async function readPdfTextPreview(file: File) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }
    const literalText = Array.from(binary.matchAll(/\(([^()]{2,500})\)\s*T[jJ]/g))
      .map((match) => match[1])
      .join(" ");
    const hexText = Array.from(binary.matchAll(/<([0-9A-Fa-f]{8,1000})>\s*T[jJ]/g))
      .map((match) => {
        const hex = match[1] ?? "";
        const chars: string[] = [];
        for (let index = 0; index < hex.length; index += 2) {
          const code = Number.parseInt(hex.slice(index, index + 2), 16);
          if (Number.isFinite(code) && code >= 32 && code <= 126) chars.push(String.fromCharCode(code));
        }
        return chars.join("");
      })
      .join(" ");
    const cleaned = `${literalText} ${hexText}`
      .replace(/\\[rn]/g, " ")
      .replace(/\\([()\\])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length >= 20 ? cleaned.slice(0, 40_000) : undefined;
  } catch {
    return undefined;
  }
}
function documentCategoryForSource(sourceType: string) {
  if (sourceType === "bank_statement") return "bank_statement";
  if (sourceType === "gst_file") return "gst_data";
  if (["spreadsheet", "csv", "xlsx"].includes(sourceType)) return "other";
  return "other";
}
function apiError(payload: { ok?: boolean; error?: string } | null, fallback: string) {
  if (!payload) return fallback;
  return payload.ok === false ? payload.error ?? fallback : null;
}
function getArray<T>(payload: ListResponse<T> | null, key: string): T[] {
  if (!payload?.data) return [];
  if (Array.isArray(payload.data)) return payload.data;
  const value = payload.data[key];
  return Array.isArray(value) ? (value as T[]) : [];
}
function formatDate(value?: string) {
  if (!value) return "Not synced";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}
function titleCase(value?: string) {
  if (!value) return "-";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function shortId(value?: string) {
  if (!value) return "-";
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
}
function initials(name?: string) {
  if (!name) return "CL";
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CL";
}
function Icon({ name, className = "text-[20px]", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
      {name}
    </span>
  );
}
function SourceLogo({ source, className = "h-8 w-8" }: { source: string; className?: string }) {
  const normalized = source.toLowerCase();
  if (normalized.includes("gmail") || normalized.includes("email")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#EA4335" d="M4 9.5 16 18l12-8.5V25a2 2 0 0 1-2 2h-4V15.8L16 20.1 10 15.8V27H6a2 2 0 0 1-2-2V9.5Z" /><path fill="#FBBC04" d="M4 9.5V7.8c0-1.6 1.8-2.5 3-1.6l9 6.4 9-6.4c1.2-.9 3 .1 3 1.6v1.7L16 18 4 9.5Z" /><path fill="#34A853" d="M22 27h4a2 2 0 0 0 2-2V9.5l-6 4.3V27Z" /><path fill="#4285F4" d="M4 9.5V25a2 2 0 0 0 2 2h4V13.8L4 9.5Z" /></svg>;
  }
  if (normalized.includes("drive")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#1FA463" d="m12.5 4 7.5 13H5L12.5 4Z" /><path fill="#FFD04B" d="M19.5 4 27 17H20L12.5 4h7Z" /><path fill="#4285F4" d="M5 17h15l-4 7H1l4-7Z" /><path fill="#0F9D58" d="m20 17 4 7h-8l4-7Z" /></svg>;
  }
  if (normalized.includes("whatsapp")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#25D366" d="M16 4a11 11 0 0 0-9.4 16.7L5 28l7.5-1.6A11 11 0 1 0 16 4Z" /><path fill="#fff" d="M22.3 18.7c-.3-.2-1.8-.9-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.9c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-.9-2c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.9 5.1 3.5 1.4 3.5.9 4.1.9.6-.1 1.8-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z" /></svg>;
  }
  if (normalized.includes("slack")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#36C5F0" d="M12.8 5.2a3 3 0 0 1 6 0v6h-6v-6Z" /><path fill="#2EB67D" d="M26.8 12.8a3 3 0 0 1 0 6h-6v-6h6Z" /><path fill="#ECB22E" d="M19.2 26.8a3 3 0 0 1-6 0v-6h6v6Z" /><path fill="#E01E5A" d="M5.2 19.2a3 3 0 0 1 0-6h6v6h-6Z" /><path fill="#2EB67D" d="M20.8 5.2a3 3 0 0 1 6 0 3 3 0 0 1-3 3h-3v-3Z" /><path fill="#ECB22E" d="M26.8 20.8a3 3 0 0 1 0 6 3 3 0 0 1-3-3v-3h3Z" /><path fill="#E01E5A" d="M11.2 26.8a3 3 0 0 1-6 0 3 3 0 0 1 3-3h3v3Z" /><path fill="#36C5F0" d="M5.2 11.2a3 3 0 0 1 0-6 3 3 0 0 1 3 3v3h-3Z" /></svg>;
  }
  if (normalized.includes("zoho")) {
    return <svg className={className} viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="9" width="10" height="10" rx="2" fill="#E42527" /><rect x="13" y="15" width="10" height="10" rx="2" fill="#089949" /><rect x="23" y="9" width="10" height="10" rx="2" fill="#226DB4" /><rect x="17" y="3" width="10" height="10" rx="2" fill="#F9B21D" /><text x="20" y="33" textAnchor="middle" fontSize="8" fill="#111" fontWeight="800">Zoho</text></svg>;
  }
  if (normalized.includes("tally")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0F5EA8" /><path fill="#fff" d="M7 8h18v4h-7v12h-4V12H7V8Z" /><path fill="#F5B400" d="M20 14h5v10h-5V14Z" /></svg>;
  }
  if (normalized.includes("spreadsheet") || normalized.includes("excel") || normalized.includes("csv")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#107C41" d="M6 5h13l7 7v15H6V5Z" /><path fill="#185C37" d="M19 5v7h7l-7-7Z" /><path fill="#fff" d="m10 13 3.1 4.1L10 21h3l1.7-2.3L16.4 21h3l-3.2-4 3-4h-2.9l-1.5 2.1-1.5-2.1H10Z" /></svg>;
  }
  if (normalized.includes("bank")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#1E3A8A" d="M16 4 4 10v3h24v-3L16 4Z" /><path fill="#3B82F6" d="M7 15h4v8H7v-8Zm7 0h4v8h-4v-8Zm7 0h4v8h-4v-8Z" /><path fill="#1E3A8A" d="M5 24h22v4H5v-4Z" /></svg>;
  }
  if (normalized.includes("gst") || normalized.includes("tax")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="4" fill="#F97316" /><path fill="#fff" d="M10 10h12v2H10v-2Zm0 5h8v2h-8v-2Zm0 5h12v2H10v-2Z" /><path fill="#7C2D12" d="M21 14.5 24.5 18 21 21.5 19.6 20l2-2-2-2 1.4-1.5Z" /></svg>;
  }
  if (normalized.includes("pdf")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path fill="#D93025" d="M7 4h13l5 5v19H7V4Z" /><path fill="#FCE8E6" d="M20 4v5h5l-5-5Z" /><text x="16" y="22" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="800">PDF</text></svg>;
  }
  if (normalized.includes("manual") || normalized.includes("upload")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="7" fill="#700018" /><path fill="#fff" d="M15 20V10l-4 4-1.5-1.5L16 6l6.5 6.5L21 14l-4-4v10h-2Zm-5 5v-3h12v3H10Z" /></svg>;
  }
  if (normalized.includes("erp") || normalized.includes("api")) {
    return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="6" width="24" height="20" rx="5" fill="#111" /><path fill="#fff" d="m12 12-4 4 4 4 1.4-1.4L10.8 16l2.6-2.6L12 12Zm8 0-1.4 1.4 2.6 2.6-2.6 2.6L20 20l4-4-4-4Zm-3.1.2-3 7 1.8.7 3-7-1.8-.7Z" /></svg>;
  }
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="8" fill="#700018" /><path fill="#fff" d="M10 11h12v3H10v-3Zm0 5h12v3H10v-3Zm0 5h8v3h-8v-3Z" /></svg>;
}

function sourceLogoTileClass(source: string, active = false) {
  const normalized = source.toLowerCase();
  if (normalized.includes("gmail") || normalized.includes("email")) return "bg-[#fff1f0] ring-[#f9d1cc]";
  if (normalized.includes("drive")) return "bg-[#eef6ff] ring-[#c9defe]";
  if (normalized.includes("zoho")) return "bg-[#fff8e6] ring-[#f4ddb0]";
  if (normalized.includes("whatsapp")) return "bg-[#e9f9ef] ring-[#c9f0d7]";
  if (normalized.includes("slack")) return "bg-[#f5edf6] ring-[#e3cbe5]";
  if (normalized.includes("tally")) return "bg-[#eaf4ff] ring-[#c1dcf8]";
  if (normalized.includes("spreadsheet") || normalized.includes("excel") || normalized.includes("csv")) return "bg-[#eaf7ef] ring-[#c5e8d1]";
  if (normalized.includes("bank")) return "bg-[#eef4ff] ring-[#ccdcfb]";
  if (normalized.includes("gst") || normalized.includes("tax")) return "bg-[#fff3e8] ring-[#f4d2b5]";
  if (normalized.includes("manual") || normalized.includes("upload")) return "bg-[#f8ecef] ring-[#e5c5cc]";
  return active ? "bg-[#700018]/10 ring-[#dcc0c0]" : "bg-[#f4f3f3] ring-[#e2e2e2]";
}

export function FinvaultConsole() {
  const [activeTab, setActiveTab] = useState<TabId>("ask");
  const [clientId, setClientId] = useState("");
  const [question, setQuestion] = useState("What can you tell me once this client is intelligence ready?");
  const [messages, setMessages] = useState<AskMessage[]>([
    { role: "fynny", text: "I will answer only from intelligence-ready client data. Select a client, complete processing, and I will explain the evidence without inventing numbers." }
  ]);
  const [status, setStatus] = useState<ApiState<StatusResponse>>(emptyState());
  const [session, setSession] = useState<ApiState<SessionResponse>>(emptyState());
  const [clients, setClients] = useState<ApiState<ListResponse<Client>>>(emptyState());
  const [processing, setProcessing] = useState<ApiState<ProcessingOverviewResponse>>(emptyState());
  const [readiness, setReadiness] = useState<ApiState<ReadinessResponse>>({ loading: false, data: null, error: null });
  const [issues, setIssues] = useState<ApiState<ListResponse<Issue>>>({ loading: false, data: null, error: null });
  const [sources, setSources] = useState<ApiState<ListResponse<DataSource>>>({ loading: false, data: null, error: null });
  const [submissions, setSubmissions] = useState<ApiState<SubmissionPendingResponse>>({ loading: false, data: null, error: null });
  const [reports, setReports] = useState<ApiState<ListResponse<Report>>>({ loading: false, data: null, error: null });
  const [exports, setExports] = useState<ApiState<ListResponse<ExportRow>>>({ loading: false, data: null, error: null });
  const [asking, setAsking] = useState(false);
  const [requestingSource, setRequestingSource] = useState<string | null>(null);
  const [sourceNotice, setSourceNotice] = useState<ActionNotice>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [chatNotice, setChatNotice] = useState<ActionNotice>(null);
  const [chatExporting, setChatExporting] = useState<string | null>(null);
  const [showFlowGuide, setShowFlowGuide] = useState(false);

  async function refresh() {
    setStatus((current) => ({ ...current, loading: true, error: null }));
    setSession((current) => ({ ...current, loading: true, error: null }));
    setClients((current) => ({ ...current, loading: true, error: null }));
    setProcessing((current) => ({ ...current, loading: true, error: null }));
    setSubmissions((current) => ({ ...current, loading: true, error: null }));
    const [nextStatus, nextSession, nextClients, nextProcessing] = await Promise.all([
      readJson<StatusResponse>("/api/status").catch((error) => ({ error: error instanceof Error ? error.message : "Status unavailable" })),
      readJson<SessionResponse>("/api/auth/session").catch((error) => ({ authenticated: false, error: error instanceof Error ? error.message : "Session unavailable" })),
      readJson<ListResponse<Client>>("/api/clients").catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Clients unavailable" })),
      readJson<ProcessingOverviewResponse>("/api/processing").catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Processing unavailable" }))
    ]);
    setStatus({ loading: false, data: nextStatus as StatusResponse, error: "error" in nextStatus ? String(nextStatus.error) : null });
    setSession({ loading: false, data: nextSession as SessionResponse, error: "error" in nextSession ? String(nextSession.error) : null });
    setClients({ loading: false, data: nextClients as ListResponse<Client>, error: apiError(nextClients as ListResponse<Client>, "Clients unavailable") });
    setProcessing({ loading: false, data: nextProcessing as ProcessingOverviewResponse, error: apiError(nextProcessing as ProcessingOverviewResponse, "Processing unavailable") });
    if (!clientId) {
      setReadiness({ loading: false, data: null, error: null });
      setIssues({ loading: false, data: null, error: null });
      setSources({ loading: false, data: null, error: null });
      setReports({ loading: false, data: null, error: null });
      setExports({ loading: false, data: null, error: null });
      const pending = await readJson<SubmissionPendingResponse>("/api/submissions/pending").catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Collection queue unavailable" }));
      setSubmissions({ loading: false, data: pending, error: apiError(pending, "Collection queue unavailable") });
      return;
    }
    await refreshClient(clientId);
  }

  async function refreshClient(id: string) {
    setReadiness((current) => ({ ...current, loading: true, error: null }));
    setIssues((current) => ({ ...current, loading: true, error: null }));
    setSources((current) => ({ ...current, loading: true, error: null }));
    setSubmissions((current) => ({ ...current, loading: true, error: null }));
    setReports((current) => ({ ...current, loading: true, error: null }));
    setExports((current) => ({ ...current, loading: true, error: null }));
    const [nextReadiness, nextIssues, nextSources, nextSubmissions, nextReports, nextExports] = await Promise.all([
      readJson<ReadinessResponse>(`/api/intelligence-ready/${id}`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Readiness unavailable" })),
      readJson<ListResponse<Issue>>(`/api/clients/${id}/validation-issues`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Issues unavailable" })),
      readJson<ListResponse<DataSource>>(`/api/clients/${id}/data-sources`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Data sources unavailable" })),
      readJson<SubmissionPendingResponse>("/api/submissions/pending").catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Collection queue unavailable" })),
      readJson<ListResponse<Report>>(`/api/clients/${id}/reports`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Reports unavailable" })),
      readJson<ListResponse<ExportRow>>(`/api/clients/${id}/exports`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Exports unavailable" }))
    ]);
    setReadiness({ loading: false, data: nextReadiness, error: apiError(nextReadiness, "Readiness unavailable") });
    setIssues({ loading: false, data: nextIssues, error: apiError(nextIssues, "Issues unavailable") });
    setSources({ loading: false, data: nextSources, error: apiError(nextSources, "Data sources unavailable") });
    setSubmissions({ loading: false, data: nextSubmissions, error: apiError(nextSubmissions, "Collection queue unavailable") });
    setReports({ loading: false, data: nextReports, error: apiError(nextReports, "Reports unavailable") });
    setExports({ loading: false, data: nextExports, error: apiError(nextExports, "Exports unavailable") });
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("fynny-first-report-guide-dismissed") !== "true") {
      setShowFlowGuide(true);
    }
  }, []);

  const clientRows = getArray<Client>(clients.data, "clients");
  const selectedClient = clientRows.find((client) => client.id === clientId);
  const jobs = processing.data?.data?.jobs ?? [];
  const openIssues = getArray<Issue>(issues.data, "issues").filter((issue) => issue.status !== "resolved");
  const dataSources = getArray<DataSource>(sources.data, "dataSources");
  const reportRows = getArray<Report>(reports.data, "reports");
  const exportRows = getArray<ExportRow>(exports.data, "exports");
  const providerRows = useMemo(() => Object.entries(status.data?.providers ?? {}), [status.data]);
  const readinessScore = readiness.data?.data?.score ?? 0;
  const isReady = Boolean(readiness.data?.data?.intelligenceReady);
  const refreshing = status.loading || processing.loading || clients.loading || readiness.loading || issues.loading || sources.loading || submissions.loading || reports.loading || exports.loading;
  const hasMigrationBlocker = processing.error?.includes("processing_jobs") || readiness.error?.includes("processing_jobs");

  async function submitAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    setMessages((current) => [...current, { role: "user", text: cleanQuestion }]);
    if (!clientId) {
      setMessages((current) => [...current, { role: "fynny", text: clientRows.length ? "Pick the client you want to work on. The CA team connects and operates Fynny, and each client record keeps the data and outputs separate." : "Add your first client, then connect sources or upload files so Fynny can process them cleanly.", blocked: true }]);
      return;
    }
    setAsking(true);
    const payload = await readJson<{ ok?: boolean; data?: { answer?: string; intelligence?: IntelligencePayload; exportModel?: ExportLayout; actions?: AskActionPayload }; error?: string; trainingGuidance?: string[] }>(`/api/clients/${clientId}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: cleanQuestion })
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Ask Fynny is unavailable.", trainingGuidance: [] }));
    setAsking(false);
    if (payload.ok === false) {
      const blockedMessage = payload.error?.includes("Intelligence Ready")
        ? `I need this client to reach Intelligence Ready before I can answer. ${payload.trainingGuidance?.length ? payload.trainingGuidance.join(" ") : "Upload documents, resolve validation issues, and I will use the verified financial memory to respond."}`
        : payload.error ?? "Ask Fynny is blocked until processing is complete.";
      setMessages((current) => [...current, { role: "fynny", text: blockedMessage, blocked: true }]);
      return;
    }
    const answer = "data" in payload ? payload.data?.answer : undefined;
    const intelligence = "data" in payload ? payload.data?.intelligence : undefined;
    const actions = "data" in payload ? payload.data?.actions : undefined;
    const actionFile = actions?.export?.file;
    if (actionFile?.storageUrl) {
      const link = document.createElement("a");
      link.href = actionFile.storageUrl;
      link.download = actionFile.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setMessages((current) => [...current, { role: "fynny", text: answer ?? "I found intelligence-ready evidence, but no answer text was returned.", intelligence }]);
    if (actions?.report || actions?.export || actions?.syncedSources?.length) {
      await refreshClient(clientId);
    }
  }

  async function generateClientExport(exportType: string, fileFormat: "csv" | "xlsx" | "pdf") {
    if (!clientId) {
      setSourceNotice({ tone: "warning", title: "Choose a client", body: "Select a client before generating exports." });
      return;
    }
    const exportKey = `${exportType}-${fileFormat}`;
    setChatExporting(exportKey);
    setExports((current) => ({ ...current, loading: true, error: null }));
    const payload = await readJson<{ ok?: boolean; data?: ExportRow & { file?: { filename: string; storageUrl: string } }; error?: string }>(`/api/clients/${clientId}/exports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exportType, fileFormat })
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Export generation failed." }));
    if (payload.ok === false) {
      setExports((current) => ({ ...current, loading: false, error: payload.error ?? "Export generation failed." }));
      setChatExporting(null);
      return;
    }
    const exported = "data" in payload ? payload.data : undefined;
    const downloadUrl = exported?.file?.storageUrl ?? exported?.storage_url;
    if (downloadUrl) {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = exported?.file?.filename ?? `fynny-${exportType}.${fileFormat === "xlsx" ? "xls" : fileFormat}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    await refreshClient(clientId);
    setChatExporting(null);
  }

  async function createClient(input: ClientCreateInput) {
    const name = input.name.trim();
    if (!name) {
      setChatNotice({ tone: "warning", title: "Client name needed", body: "Add a client name so Fynny can set up their private record." });
      return false;
    }
    setCreatingClient(true);
    setChatNotice(null);
    try {
      const payload = await readJson<{ ok?: boolean; data?: Client; error?: string }>("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          businessType: input.businessType?.trim() || undefined,
          contactEmail: input.contactEmail?.trim() || undefined
        })
      });
      if (payload.ok === false || !payload.data?.id) {
        setChatNotice({ tone: "error", title: "Client could not be created", body: payload.error ?? "Please check the details and try again." });
        return false;
      }
      const createdClient = payload.data;
      setClientId(createdClient.id);
      setChatNotice({ tone: "success", title: "Client added", body: `${createdClient.name} is ready for processing and reporting.` });
      setMessages((current) => [...current, { role: "fynny", text: `${createdClient.name} has been created. Next, connect the CA data source or upload files for this client.`, blocked: true }]);
      await refresh();
      await refreshClient(createdClient.id);
      return true;
    } catch (error) {
      setChatNotice({ tone: "error", title: "Client setup failed", body: error instanceof Error ? error.message : "Please try again." });
      return false;
    } finally {
      setCreatingClient(false);
    }
  }

  function guideToClient() {
    setActiveTab("clients");
    setSourceNotice({ tone: "warning", title: "Pick a client", body: "The CA team connects and runs Fynny. Choose the client you want this source or file to route into." });
  }

  function closeFlowGuide(dismiss = false) {
    if (dismiss) {
      window.localStorage.setItem("fynny-first-report-guide-dismissed", "true");
    }
    setShowFlowGuide(false);
  }

  function runGuideAction(tab: TabId, prompt?: string) {
    setActiveTab(tab);
    if (prompt) setQuestion(prompt);
    setShowFlowGuide(false);
  }

  async function connectSource(source: SourceOption) {
    if (!clientId) {
      guideToClient();
      return;
    }
    if (source.locked) {
      setSourceNotice({ tone: "warning", title: `${source.label} is locked`, body: source.lockedReason ?? "This integration is not enabled yet." });
      return;
    }
    setRequestingSource(source.id);
    setSourceNotice(null);
    try {
      const payload = await readJson<{ ok?: boolean; data?: { dataSource?: DataSource }; error?: string }>(`/api/clients/${clientId}/data-sources/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceType: source.sourceType ?? source.id, provider: source.provider })
      });
      if (payload.ok === false) {
        setSourceNotice({ tone: "error", title: "Connection could not be created", body: payload.error ?? "Please check the source setup and try again." });
      } else {
        setSourceNotice({ tone: "success", title: `${source.label} connected`, body: "Fynny created a read-only CA connection and will route synced records into this client." });
        if (source.id === "gmail") {
          window.location.href = `/api/sync/gmail?clientId=${encodeURIComponent(clientId)}`;
          return;
        }
        if (source.id === "google_drive") {
          window.location.href = `/api/sync/google-drive?clientId=${encodeURIComponent(clientId)}`;
          return;
        }
        if (source.id === "zoho_books") {
          window.location.href = `/api/sync/zoho?clientId=${encodeURIComponent(clientId)}`;
          return;
        }
      }
      await refreshClient(clientId);
    } catch (error) {
      setSourceNotice({ tone: "error", title: "Connection failed", body: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setRequestingSource(null);
    }
  }

  async function uploadDocument(file: File, sourceType = "manual_upload") {
    if (!clientId) {
      guideToClient();
      return false;
    }
    setUploadingDocument(true);
    setSourceNotice(null);
    try {
      const extractedText = await readFilePreview(file);
      if (sourceType === "spreadsheet" && !extractedText) {
        setSourceNotice({
          tone: "warning",
          title: "Use CSV for spreadsheet processing",
          body: "Fynny can process spreadsheet CSV exports now. Export XLS/XLSX to CSV, then upload it here for validation and memory build."
        });
        return false;
      }
      const payload = await readJson<{ ok?: boolean; data?: { id?: string }; error?: string }>(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          type: file.type || "document",
          sourceType,
          documentCategory: documentCategoryForSource(sourceType),
          extractedText,
          metadata: { size: file.size, fileType: file.type, lastModified: file.lastModified, previewCaptured: Boolean(extractedText) }
        })
      });
      if (payload.ok === false) {
        setSourceNotice({ tone: "error", title: "Upload could not be queued", body: payload.error ?? "Please try again with another file." });
        return false;
      } else {
        setSourceNotice({ tone: "success", title: "Document queued for processing", body: `${file.name} has entered collection and validation. CSV previews are captured for testing without storing unrelated data.` });
        await refreshClient(clientId);
        await refresh();
        return true;
      }
    } catch (error) {
      setSourceNotice({ tone: "error", title: "Upload failed", body: error instanceof Error ? error.message : "Please try again." });
      return false;
    } finally {
      setUploadingDocument(false);
    }
  }

  async function attachFilesToChat(files: File[]) {
    if (!clientId) {
      setMessages((current) => [...current, { role: "fynny", text: "Pick the client first, then attach the financial file. I will process it before using it as chat context.", blocked: true }]);
      guideToClient();
      return;
    }
    if (!files.length) return;

    const fileList = files.map((file) => file.name).join(", ");
    setMessages((current) => [...current, { role: "user", text: `Attached ${files.length === 1 ? fileList : `${files.length} files: ${fileList}`}` }]);

    const results: Array<{ name: string; uploaded: boolean }> = [];
    for (const file of files) {
      const uploaded = await uploadDocument(file, "chat_upload");
      results.push({ name: file.name, uploaded });
    }

    const uploadedCount = results.filter((result) => result.uploaded).length;
    const failed = results.filter((result) => !result.uploaded).map((result) => result.name);
    setMessages((current) => [
      ...current,
      {
        role: "fynny",
        text: uploadedCount
          ? `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} queued for processing. I will use them only after Fynny finishes collection, validation, normalization, memory build, and Intelligence Ready checks.${failed.length ? ` Could not queue: ${failed.join(", ")}.` : ""}`
          : `I could not queue the selected files. Please try CSV, TXT, PDF, spreadsheet exports, bank statements, GST files, or accounting exports.`,
        blocked: uploadedCount === 0
      }
    ]);
  }

  async function syncSource(dataSourceId: string) {
    if (!clientId) {
      guideToClient();
      return;
    }
    setSyncingSource(dataSourceId);
    setSourceNotice(null);
    try {
      const payload = await readJson<{ ok?: boolean; error?: string; data?: { message?: string; collected?: { fileCount?: number } } }>(`/api/clients/${clientId}/data-sources/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataSourceId })
      });
      if (payload.ok === false) {
        setSourceNotice({ tone: "error", title: "Sync could not start", body: payload.error ?? "Please reconnect the source and try again." });
      } else {
        setSourceNotice({ tone: "success", title: "Sync complete", body: payload.data?.message ?? "Fynny collected financial records for this client and sent them into processing." });
        await refreshClient(clientId);
      }
    } catch (error) {
      setSourceNotice({ tone: "error", title: "Sync failed", body: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSyncingSource(null);
    }
  }

  async function createMonthlyCycle() {
    if (!clientId) {
      guideToClient();
      return;
    }
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 5).toISOString().slice(0, 10);
    const payload = await readJson<{ ok?: boolean; error?: string }>("/api/submissions/create-cycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId,
        cycleName: "Monthly MIS",
        frequency: "monthly",
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        dueDate,
        requirements: [
          { documentCategory: "bank_statement", label: "Bank Statement", priority: "high" },
          { documentCategory: "sales_register", label: "Sales Register", priority: "high" },
          { documentCategory: "purchase_register", label: "Purchase Register", priority: "high" },
          { documentCategory: "gst_data", label: "GST Data", priority: "high" }
        ]
      })
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Cycle creation failed." }));
    if (payload.ok === false) {
      setSourceNotice({ tone: "error", title: "Collection cycle unavailable", body: payload.error ?? "Please check submission table setup." });
    } else {
      setSourceNotice({ tone: "success", title: "Monthly MIS cycle created", body: "Fynny is now tracking required documents and reminder status for this client." });
      await refreshClient(clientId);
    }
  }

  async function sendReminder(requestId: string, channel: "email" | "whatsapp" = "email") {
    const payload = await readJson<{ ok?: boolean; error?: string; data?: { copy?: { email?: string; whatsapp?: string } } }>("/api/submissions/send-reminder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, channel })
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Reminder failed." }));
    if (payload.ok === false) {
      setSourceNotice({ tone: "error", title: "Reminder not prepared", body: payload.error ?? "Please try again." });
    } else {
      setSourceNotice({ tone: "success", title: "Reminder prepared", body: "Fynny prepared the reminder copy and logged the follow-up. Copy is available in the API response for sending." });
      await refreshClient(clientId);
    }
  }

  async function escalateSubmission(requestId: string) {
    const payload = await readJson<{ ok?: boolean; error?: string }>("/api/submissions/escalate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId })
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Escalation failed." }));
    if (payload.ok === false) {
      setSourceNotice({ tone: "error", title: "Escalation not created", body: payload.error ?? "Please try again." });
    } else {
      setSourceNotice({ tone: "success", title: "Escalation created", body: "CA team, client, and relationship-owner escalation is now tracked." });
      await refreshClient(clientId);
    }
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(122,31,43,0.10),transparent_34%),linear-gradient(180deg,#fbfaf8_0%,#f4f1ee_52%,#efebe7_100%)] text-[#1a1c1c]">
      <LiveBanner />
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex h-[calc(100dvh-84px)] overflow-hidden md:h-[calc(100dvh-32px)]">
        <SideNav activeTab={activeTab} setActiveTab={setActiveTab} authenticated={Boolean(session.data?.authenticated)} openGuide={() => setShowFlowGuide(true)} />
        {activeTab === "ask" ? (
          <AskWorkspace
            clientId={clientId}
            setClientId={setClientId}
            selectedClient={selectedClient}
            clientRows={clientRows}
            readinessScore={readinessScore}
            isReady={isReady}
            openIssues={openIssues}
            dataSources={dataSources}
            messages={messages}
            question={question}
            setQuestion={setQuestion}
            submitAsk={submitAsk}
            asking={asking}
            openClients={() => setActiveTab("clients")}
            openSources={() => setActiveTab("sources")}
            uploadDocument={attachFilesToChat}
            uploadingDocument={uploadingDocument}
            generateExport={generateClientExport}
            exporting={chatExporting}
          />
        ) : (
          <WorkbenchShell title={titleForTab(activeTab)} subtitle={subtitleForTab(activeTab)} clientId={clientId} setClientId={setClientId} selectedClient={selectedClient} clientRows={clientRows} refresh={refresh} refreshing={refreshing}>
            {refreshing ? <AgenticLoading variant="portfolio" compact className="mb-6" /> : null}
            {hasMigrationBlocker ? <SystemNotice title="Setup needed" body="Some processing services are not fully configured yet. Finish setup to activate readiness, reports, and Ask Fynny." /> : null}
            {activeTab === "processing" ? <ProcessingScreen jobs={jobs} error={processing.error} selectedClient={selectedClient} setActiveTab={setActiveTab} setQuestion={setQuestion} /> : null}
            {activeTab === "clients" ? <ClientsScreen clients={clientRows} error={clients.error} setClientId={setClientId} setActiveTab={setActiveTab} createClient={createClient} creatingClient={creatingClient} notice={chatNotice} /> : null}
            {activeTab === "sources" ? <SourcesScreen sources={dataSources} error={sources.error} clientId={clientId} selectedClient={selectedClient} connectSource={connectSource} uploadDocument={uploadDocument} syncSource={syncSource} requestingSource={requestingSource} uploadingDocument={uploadingDocument} syncingSource={syncingSource} notice={sourceNotice} setActiveTab={setActiveTab} /> : null}
            {activeTab === "collection" ? <CollectionScreen pending={submissions.data?.data?.pending ?? []} health={submissions.data?.data?.health} error={submissions.error} selectedClient={selectedClient} createMonthlyCycle={createMonthlyCycle} sendReminder={sendReminder} escalateSubmission={escalateSubmission} notice={sourceNotice} /> : null}
            {activeTab === "validation" ? <ValidationScreen issues={openIssues} error={issues.error} /> : null}
            {activeTab === "memory" ? <MemoryScreen clientId={clientId} isReady={isReady} readiness={readiness.data} /> : null}
            {activeTab === "reports" ? <ReportsScreen reports={reportRows} error={reports.error} isReady={isReady} /> : null}
            {activeTab === "exports" ? <ExportsScreen exports={exportRows} error={exports.error} isReady={isReady} generateExport={generateClientExport} generating={exports.loading} /> : null}
            {activeTab === "advisory" ? <SimpleScreen icon="auto_graph" title={clientId ? (isReady ? "Advisory engine can discover opportunities." : "Advisory waits for Intelligence Ready.") : "Choose a client"} body="Opportunities are generated from verified records, reconciliation state, and financial memory. Fynny will not fabricate recommendations." /> : null}
            {activeTab === "portal" ? <SimpleScreen icon="approval_delegation" title={clientId ? `${selectedClient?.name ?? "Selected client"} portal context` : "Choose a client"} body="Client visibility, report publishing, and client controls are backed by live services." /> : null}
            {activeTab === "settings" ? <SettingsScreen providers={providerRows} status={status.data} session={session.data} /> : null}
          </WorkbenchShell>
        )}
      </div>
      <FirstReportGuideDialog
        open={showFlowGuide}
        onClose={() => closeFlowGuide(false)}
        onDismiss={() => closeFlowGuide(true)}
        onAction={runGuideAction}
        hasClient={clientRows.length > 0}
        hasActiveClient={Boolean(clientId)}
        hasSource={dataSources.length > 0}
        hasJobs={jobs.length > 0}
        isReady={isReady}
        hasOutput={reportRows.length > 0 || exportRows.length > 0}
      />
    </main>
  );
}

function LiveBanner() {
  return (
    <div className="h-8 border-b border-[#e8dedb] bg-white/70 px-4 text-center backdrop-blur-xl">
      <span className="inline-flex h-full items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c615d]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#7A1F2B] shadow-[0_0_16px_rgba(122,31,43,0.65)]" />
        Fynny cockpit - collect, process, validate, remember, and deliver client-ready intelligence.
      </span>
    </div>
  );
}

function SideNav({ activeTab, setActiveTab, authenticated, openGuide }: { activeTab: TabId; setActiveTab: (tab: TabId) => void; authenticated: boolean; openGuide: () => void }) {
  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-[#e7ddda] bg-white/78 px-3 py-4 shadow-[18px_0_60px_rgba(48,30,24,0.06)] backdrop-blur-xl md:flex">
      <div className="mb-5 rounded-[28px] border border-[#eee4e0] bg-[linear-gradient(135deg,#ffffff_0%,#fbf5f3_100%)] px-5 py-5 shadow-[0_20px_55px_rgba(122,31,43,0.08)]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111111] text-white shadow-[0_14px_34px_rgba(17,17,17,0.18)]">
            <Icon name="auto_awesome" className="text-[23px]" filled />
          </div>
          <div>
            <h1 className="text-[27px] font-black leading-none tracking-[-0.05em] text-[#111111]">Fynny</h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A1F2B]">Financial OS</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#6d6460]">A premium command center for CA collection, processing, and advisory output.</p>
      </div>
      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.09em] transition-all duration-300 active:scale-[0.98] ${active ? "bg-[#111111] text-white shadow-[0_18px_42px_rgba(17,17,17,0.16)]" : "text-[#655f5b] hover:bg-[#f3efec] hover:text-[#111111]"}`}>
              {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#b98b76]" /> : null}
              <span className={`grid h-8 w-8 place-items-center rounded-xl transition ${active ? "bg-white/12 text-white" : "bg-white text-[#7A1F2B] ring-1 ring-[#eee4e0] group-hover:ring-[#d8c3bb]"}`}>
                <Icon name={item.icon} className="text-[20px]" filled={active} />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-[#e2e2e2] pt-4">
        <button onClick={() => setActiveTab("sources")} className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#7A1F2B] px-3 text-[12px] font-black uppercase tracking-[0.08em] text-white shadow-[0_18px_38px_rgba(122,31,43,0.22)] transition hover:-translate-y-0.5 hover:bg-[#5b0617]">
          <Icon name="add_link" className="text-[18px]" />
          Connect Sources
        </button>
        <button onClick={openGuide} className="mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-[10px] text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-[#5b0617] hover:bg-[#e8e8e8]">
          <Icon name="route" className="text-[22px]" />
          First Report Guide
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-4 py-[10px] text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-[#5f5e5e] hover:bg-[#e8e8e8]">
          <Icon name="headset_mic" className="text-[22px]" />
          Support
        </button>
        {authenticated ? (
          <a href="/api/auth/logout" className="flex w-full items-center gap-3 rounded-lg px-4 py-[10px] text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-[#5f5e5e] hover:bg-[#e8e8e8]">
            <Icon name="logout" className="text-[22px]" />
            Sign Out
          </a>
        ) : null}
      </div>
    </aside>
  );
}

function MobileNav({ activeTab, setActiveTab }: { activeTab: TabId; setActiveTab: (tab: TabId) => void }) {
  return (
    <nav className="flex h-[52px] gap-2 overflow-x-auto border-b border-[#e2e2e2] bg-white/88 px-3 py-2 backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const active = activeTab === item.id;
        return (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.08em] transition sm:px-4 sm:text-[11px] ${active ? "bg-[#111111] text-white" : "bg-[#f4f3f3] text-[#5f5e5e]"}`}>
            <Icon name={item.icon} className="text-[18px]" filled={active} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function FirstReportGuideDialog({
  open,
  onClose,
  onDismiss,
  onAction,
  hasClient,
  hasActiveClient,
  hasSource,
  hasJobs,
  isReady,
  hasOutput
}: {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onAction: (tab: TabId, prompt?: string) => void;
  hasClient: boolean;
  hasActiveClient: boolean;
  hasSource: boolean;
  hasJobs: boolean;
  isReady: boolean;
  hasOutput: boolean;
}) {
  if (!open) return null;

  const steps = [
    {
      title: "Add your first client",
      body: "Create or select the client that will own every upload, sync, report, and export.",
      done: hasClient && hasActiveClient,
      tab: "clients" as TabId,
      action: hasClient ? "Choose Client" : "Add Client"
    },
    {
      title: "Connect or upload source data",
      body: "Connect Gmail, Drive, or Zoho, or upload solid CSV files for bank, sales, GST, purchase, payroll, and contracts.",
      done: hasSource || hasJobs,
      tab: "sources" as TabId,
      action: "Open Sources"
    },
    {
      title: "Run processing and review blockers",
      body: "Fynny classifies, validates, normalizes, builds memory, and scores readiness before client-facing output.",
      done: hasJobs && isReady,
      tab: hasJobs ? "processing" as TabId : "sources" as TabId,
      action: hasJobs ? "Open Processing" : "Upload Files"
    },
    {
      title: "Ask Fynny for the first output",
      body: "Use a prompt that can fetch connected sources and generate the requested format when readiness is true.",
      done: hasOutput,
      tab: "ask" as TabId,
      prompt: "Fetch Gmail attachments, process them, and generate an MIS workbook in Excel.",
      action: "Load Prompt"
    }
  ];
  const nextIndex = Math.max(0, steps.findIndex((step) => !step.done));
  const activeIndex = nextIndex === -1 ? steps.length - 1 : nextIndex;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#111111]/42 px-3 py-4 backdrop-blur-sm sm:px-5">
      <section className="custom-scrollbar max-h-[calc(100dvh-32px)] w-full max-w-[680px] overflow-y-auto rounded-[24px] border border-[#eadada] bg-white shadow-[0_30px_120px_rgba(17,17,17,0.24)]">
        <div className="grid gap-0 md:grid-cols-[0.78fr_1.22fr]">
          <div className="bg-[#111111] p-5 text-white sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6b7bf]">Guided setup</p>
            <h2 className="mt-3 text-[26px] font-black leading-[1.02] tracking-[-0.05em] sm:text-[32px]">From signup to first report.</h2>
            <p className="mt-4 text-xs leading-6 text-white/68 sm:text-[13px]">Follow this path once. Every client then follows the same clean operating model: collect, process, validate, remember, ask, report.</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Current next step</p>
              <p className="mt-2 text-[16px] font-bold leading-6">{steps[activeIndex]?.title}</p>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#700018]">Fynny flow</p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#111111]">Complete the path in order.</h3>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4f3f3] text-[#5f5e5e] hover:text-[#5b0617]" aria-label="Close guide">
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <div className="space-y-2.5">
              {steps.map((step, index) => {
                const active = index === activeIndex;
                return (
                  <div key={step.title} className={`rounded-2xl border p-3 transition ${step.done ? "border-emerald-200 bg-emerald-50/60" : active ? "border-[#7a1f2b] bg-[#fff8f8]" : "border-[#ececec] bg-[#f9f9f9]"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-black ${step.done ? "bg-emerald-600 text-white" : active ? "bg-[#700018] text-white" : "bg-[#e8e8e8] text-[#5f5e5e]"}`}>{step.done ? "OK" : index + 1}</span>
                          <p className="text-[13px] font-black leading-5 text-[#111111] sm:text-[14px]">{step.title}</p>
                        </div>
                        <p className="mt-1.5 pl-10 text-xs leading-5 text-[#5f5e5e]">{step.body}</p>
                      </div>
                      <button onClick={() => onAction(step.tab, step.prompt)} className={`shrink-0 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] transition ${active ? "bg-[#111111] text-white hover:bg-[#5b0617]" : "border border-[#dcc0c0] bg-white text-[#5b0617] hover:border-[#5b0617]"}`}>
                        {step.action}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[#ececec] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-5 text-[#5f5e5e]">Tip: use the Aster Foods pack for a complete collection-to-report demo.</p>
              <button onClick={onDismiss} className="shrink-0 rounded-xl border border-[#e2e2e2] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#5f5e5e] hover:border-[#5b0617] hover:text-[#5b0617]">Do not show again</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AskWorkspace(props: {
  clientId: string;
  setClientId: (id: string) => void;
  selectedClient?: Client;
  clientRows: Client[];
  readinessScore: number;
  isReady: boolean;
  openIssues: Issue[];
  dataSources: DataSource[];
  messages: AskMessage[];
  question: string;
  setQuestion: (value: string) => void;
  submitAsk: (event: FormEvent<HTMLFormElement>) => void;
  asking: boolean;
  openClients: () => void;
  openSources: () => void;
  uploadDocument: (files: File[]) => Promise<void>;
  uploadingDocument: boolean;
  generateExport: (exportType: string, fileFormat: "csv" | "xlsx" | "pdf") => Promise<void>;
  exporting: string | null;
}) {
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const hasUserQuestion = props.messages.some((message) => message.role === "user");
  const latestFynny = [...props.messages].reverse().find((message) => message.role === "fynny");
  const visibleMessages = hasUserQuestion ? props.messages : [];
  const contextLabel = props.clientId
    ? `${props.dataSources.length} source${props.dataSources.length === 1 ? "" : "s"} connected`
    : "Choose a client";

  function handleChatFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void props.uploadDocument(files);
  }

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-[#ffffff]">
      <ClientRail clients={props.clientRows} clientId={props.clientId} setClientId={props.setClientId} openClients={props.openClients} />
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e2e2e2] px-5 md:px-7">
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${props.isReady ? "bg-[#00875a]" : "bg-[#ba1a1a]"}`} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5f5e5e]">{props.isReady ? "Verified context" : "Processing context required"}</span>
          </div>
          <div className="hidden rounded-full border border-[#ececec] bg-[#f9f9f9] px-4 py-2 text-[11px] font-semibold text-[#5b0617] md:block">Only uploads and connected sources become context.</div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-36 pt-8 md:px-8">
          <div className="mx-auto w-full max-w-[820px]">
            {!hasUserQuestion ? (
              <section className="flex min-h-[calc(100dvh-230px)] flex-col items-center justify-center space-y-7">
                <div className="relative grid h-28 w-28 place-items-center md:h-36 md:w-36">
                  <div className="absolute inset-0 rounded-full border border-[#ececec] bg-[radial-gradient(circle_at_center,rgba(122,31,43,0.08),transparent_62%)]" />
                  <div className="absolute h-20 w-20 rounded-full bg-[#7a1f2b]/10 blur-2xl" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-[24px] bg-[#5b0617] text-white shadow-[0_18px_48px_rgba(122,31,43,0.2)]">
                    <Icon name="psychology" className="text-[30px]" filled />
                  </div>
                  {["article", "analytics", "memory"].map((icon, index) => (
                    <div key={icon} className="absolute grid h-9 w-9 place-items-center rounded-xl border border-[#ececec] bg-white text-[#5b0617] shadow-[0_8px_30px_rgba(0,0,0,0.04)]" style={{ transform: `rotate(${index * 120}deg) translateY(-58px) rotate(-${index * 120}deg)` }}>
                      <Icon name={icon} className="text-[17px]" />
                    </div>
                  ))}
                </div>
                <div className="space-y-3 text-center">
                  <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-[#1a1c1c] md:text-[48px]">Ask Fynny</h1>
                  <p className="mx-auto max-w-xl text-[15px] leading-7 text-[#5f5e5e]">
                    Ask short questions. The CA team connects sources and uploads files, and Fynny answers only from processed financial context.
                  </p>
                </div>
                {latestFynny ? (
                  <div className="max-w-2xl rounded-2xl border border-[#ececec] bg-[#f9f9f9] p-5 text-center text-sm leading-6 text-[#5f5e5e]">
                    {latestFynny.text}
                  </div>
                ) : null}
                {!props.clientRows.length ? (
                  <div className="w-full max-w-xl rounded-2xl border border-[#ececec] bg-white p-5 text-center shadow-[0_18px_60px_rgba(17,17,17,0.06)]">
                    <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#700018]">Client needed</p>
                    <p className="mt-2 text-sm leading-6 text-[#5f5e5e]">Add or choose a client from the Clients tab. The CA team operates the integrations, and Fynny keeps each client's records separate.</p>
                    <button type="button" onClick={props.openClients} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617]">
                      <Icon name="groups" className="text-[18px]" />
                      Open Clients
                    </button>
                  </div>
                ) : null}
                <div className="grid w-full grid-cols-1 gap-3 pt-2 md:grid-cols-3">
                  {askSuggestions.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion.title}
                      type="button"
                      onClick={() => props.setQuestion(suggestion.prompt)}
                      className="rounded-2xl border border-[#ececec] bg-white p-4 text-left shadow-[0_4px_20px_rgba(0,0,0,0.035)] transition hover:-translate-y-0.5 hover:border-[#5b0617]"
                    >
                      <Icon name={suggestion.icon} className="mb-3 text-[22px] text-[#5b0617]" />
                      <h3 className="text-[16px] font-semibold leading-snug text-[#1a1c1c]">{suggestion.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#5f5e5e]">{suggestion.body}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="space-y-5 pb-8">
                {visibleMessages.map((message, index) =>
                  message.role === "user" ? (
                    <div key={`${message.role}-${index}`} className="flex justify-end">
                      <div className="max-w-[620px] rounded-2xl rounded-tr-md border border-[#dcc0c0] bg-[#f4f3f3] px-5 py-3 text-[15px] leading-7 text-[#1a1c1c] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">{message.text}</div>
                    </div>
                  ) : (
                    <article key={`${message.role}-${index}`} className="rounded-3xl border border-[#ececec] bg-white p-5 shadow-[0_8px_34px_rgba(0,0,0,0.04)]">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5b0617]">{message.blocked ? "Action needed" : "Fynny"}</span>
                        <span className="rounded-full bg-[#f9f9f9] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5f5e5e]">{props.selectedClient?.name ?? "No client"}</span>
                      </div>
                      <p className="text-[16px] leading-8 text-[#1a1c1c]">{message.text}</p>
                      {message.intelligence ? <CompactModelPanel intelligence={message.intelligence} isReady={props.isReady} generateExport={props.generateExport} exporting={props.exporting} /> : null}
                    </article>
                  )
                )}
                {props.asking ? <AgenticLoading variant="thinking" /> : null}
              </section>
            )}
          </div>
        </div>
        <form onSubmit={props.submitAsk} className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent p-4 md:p-5">
          <div className="pointer-events-auto mx-auto mb-2 flex max-w-[720px] flex-wrap items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5f5e5e]">
            <span className="rounded-full border border-[#ececec] bg-white px-3 py-1">{contextLabel}</span>
            <span className="rounded-full border border-[#ececec] bg-white px-3 py-1">{props.isReady ? "Intelligence ready" : `Readiness ${props.readinessScore}%`}</span>
          </div>
          <input ref={chatFileInputRef} type="file" className="hidden" accept=".csv,.txt,.pdf,.xlsx,.xls,.json" multiple onChange={handleChatFile} />
          <div className="pointer-events-auto mx-auto flex w-full max-w-[720px] items-center gap-2 rounded-2xl border border-[#e8e0e0] bg-white p-2 shadow-[0_16px_50px_rgba(0,0,0,0.1)]">
            <div className="min-w-0 flex-1 px-3">
              <input value={props.question} onChange={(event) => props.setQuestion(event.target.value)} placeholder="Ask from processed records or attach a file..." className="w-full border-0 bg-transparent py-3 text-[15px] text-[#1a1c1c] outline-none placeholder:text-[#5f5e5e]/50 focus:ring-0" />
            </div>
            <button type="button" onClick={() => chatFileInputRef.current?.click()} disabled={props.uploadingDocument} className="grid h-10 w-10 place-items-center rounded-xl text-[#5f5e5e] transition hover:bg-[#f4f3f3] hover:text-[#5b0617] disabled:cursor-wait disabled:opacity-60" aria-label="Attach financial file">{props.uploadingDocument ? <AgenticGlyph variant="validation" /> : <Icon name="attach_file" className="text-[21px]" />}</button>
            <button type="button" onClick={props.openSources} className="hidden h-10 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-[#5f5e5e] transition hover:bg-[#f4f3f3] hover:text-[#5b0617] sm:flex"><Icon name="add_link" className="text-[18px]" /> Sources</button>
            <button type="submit" disabled={props.asking} className="grid h-11 w-11 place-items-center rounded-xl bg-[#5b0617] text-white transition active:scale-95 disabled:opacity-60">{props.asking ? <AgenticGlyph variant="thinking" /> : <Icon name="arrow_upward" className="text-[22px]" />}</button>
          </div>
        </form>
      </section>
      <ClientContextRail selectedClient={props.selectedClient} clientId={props.clientId} readinessScore={props.readinessScore} sources={props.dataSources} issues={props.openIssues} />
    </main>
  );
}

function ClientRail({ clients, clientId, setClientId, openClients }: { clients: Client[]; clientId: string; setClientId: (id: string) => void; openClients: () => void }) {
  const [query, setQuery] = useState("");
  const filteredClients = clients.filter((client) => {
    const haystack = `${client.name} ${client.business_type ?? ""} ${client.contact_email ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-[#e2e2e2] bg-white lg:flex">
      <div className="border-b border-[#e2e2e2] p-5">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f5e5e]"><Icon name="search" className="text-[20px]" /></span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients..." className="h-12 w-full rounded-xl border-0 bg-[#f4f3f3] pl-12 pr-4 text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#667085] focus:ring-1 focus:ring-[#7a1f2b]" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#a0a0a0]">Clients</p>
          <button onClick={openClients} className="rounded-full bg-[#f4f3f3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5b0617] hover:bg-[#eeeeee]">Manage</button>
        </div>
        {filteredClients.length ? filteredClients.map((client) => {
          const active = client.id === clientId;
          return (
            <button key={client.id} onClick={() => setClientId(client.id)} className={`mb-2 w-full rounded-xl border p-4 text-left transition ${active ? "border-[#dcc0c0] bg-[#eeeeee]" : "border-transparent hover:bg-[#f4f3f3]"}`}>
              <p className={`truncate text-[18px] font-semibold ${active ? "text-[#5b0617]" : "text-[#111111]"}`}>{client.name}</p>
              <p className="mt-1 truncate text-[13px] text-[#5f5e5e]">{client.business_type || client.contact_email || "Client record"}</p>
            </button>
          );
        }) : (
          <div className="rounded-xl border border-dashed border-[#dcc0c0] bg-[#f9f9f9] p-5 text-sm leading-6 text-[#5f5e5e]">
            {clients.length ? "No clients match that search." : "No clients yet. Add your first one from the Clients tab."}
            {!clients.length ? <button onClick={openClients} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617]"><Icon name="groups" className="text-[18px]" /> Open Clients</button> : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function FinancialModelPanel({ intelligence }: { intelligence: IntelligencePayload }) {
  const layout = intelligence.exportLayout;
  const formulas = intelligence.formulas ?? [];
  const checks = intelligence.processChecks ?? [];
  const evidence = intelligence.requiredEvidence ?? [];
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-xl border border-[#ececec] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b0617]">Financial Model</span>
            <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#111111]">{layout?.label ?? "Evidence Model"}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5e5e]">{layout?.description ?? "Fynny maps the answer to standard financial processes and validated evidence."}</p>
          </div>
          <span className="rounded-full border border-[#dcc0c0] bg-[#f9f9f9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b0617]">{titleCase(intelligence.confidence)} Confidence</span>
        </div>
        {layout ? (
          <div className="overflow-x-auto rounded-xl border border-[#e2e2e2]">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-[#f8f8f8]">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Column</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Formula or Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f3f3]">
                {layout.columns.slice(0, 8).map((column) => (
                  <tr key={column.key}>
                    <td className="px-4 py-4 text-sm font-semibold text-[#1a1c1c]">{column.label}</td>
                    <td className="px-4 py-4 text-sm uppercase tracking-[0.08em] text-[#5f5e5e]">{column.type}</td>
                    <td className="px-4 py-4 font-[var(--font-platform-mono)] text-xs leading-5 text-[#5b0617]">{column.formula ?? column.source ?? "verified record"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="space-y-4">
        <ModelList title="Standard Process" icon="rule_settings" items={layout?.standardProcess ?? checks} />
        <ModelList title="Formulas Used" icon="function" items={formulas.map((formula) => `${formula.label}: ${formula.formula}`)} />
        <ModelList title="Evidence Required" icon="fact_check" items={evidence} />
      </div>
    </section>
  );
}

function CompactModelPanel({ intelligence, isReady, generateExport, exporting }: { intelligence: IntelligencePayload; isReady: boolean; generateExport: (exportType: string, fileFormat: "csv" | "xlsx" | "pdf") => Promise<void>; exporting: string | null }) {
  const layout = intelligence.exportLayout;
  const formulas = intelligence.formulas ?? [];
  const checks = intelligence.processChecks ?? [];
  const exportType = layout?.id ?? "client_summary";
  const exportActions = [
    { format: "csv" as const, label: "CSV", icon: "table_rows" },
    { format: "xlsx" as const, label: "Excel", icon: "table_chart" },
    { format: "pdf" as const, label: "PDF", icon: "picture_as_pdf" }
  ];
  return (
    <div className="mt-4 rounded-2xl border border-[#f0e6e6] bg-[#fbfaf9] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#5b0617]">{layout?.label ?? "Evidence model"}</span>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] text-[#5f5e5e]">{titleCase(intelligence.confidence)} confidence</span>
        {layout ? <span className="rounded-full bg-white px-3 py-1 text-[11px] text-[#5f5e5e]">{layout.columns.length} export columns</span> : null}
      </div>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-[#5f5e5e] md:grid-cols-2">
        <p><span className="font-semibold text-[#1a1c1c]">Formula:</span> {formulas[0] ? `${formulas[0].label} = ${formulas[0].formula}` : "No formula required for this response."}</p>
        <p><span className="font-semibold text-[#1a1c1c]">Check:</span> {checks[0] ?? "Uses processed uploads and connected sources only."}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#eee1e1] pt-4">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b0617]">Export</span>
        {exportActions.map((action) => {
          const key = `${exportType}-${action.format}`;
          const busy = exporting === key;
          return (
            <button
              key={action.format}
              type="button"
              disabled={!isReady || Boolean(exporting)}
              onClick={() => void generateExport(exportType, action.format)}
              className="inline-flex items-center gap-2 rounded-full border border-[#dcc0c0] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617] hover:bg-[#fff7f7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <AgenticGlyph variant="validation" /> : <Icon name={action.icon} className="text-[16px]" />}
              {busy ? "Generating" : action.label}
            </button>
          );
        })}
        {!isReady ? <span className="text-xs text-[#5f5e5e]">Exports unlock after Intelligence Ready.</span> : null}
      </div>
    </div>
  );
}

function ModelList({ title, icon, items }: { title: string; icon: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[#ececec] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center gap-2 text-[#5b0617]">
        <Icon name={icon} className="text-[20px]" />
        <h4 className="text-[13px] font-semibold uppercase tracking-[0.14em]">{title}</h4>
      </div>
      <div className="space-y-3">
        {(items.length ? items.slice(0, 5) : ["No additional model detail returned."]).map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border border-[#f0e6e6] bg-[#f9f9f9] px-4 py-3 text-sm leading-6 text-[#1a1c1c]">{item}</div>
        ))}
      </div>
    </div>
  );
}

function CreateClientMiniForm({ createClient, creatingClient, notice, onDone }: { createClient: (input: ClientCreateInput) => Promise<boolean>; creatingClient: boolean; notice: ActionNotice; onDone?: () => void }) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createClient({ name, businessType, contactEmail });
    if (created) {
      setName("");
      setBusinessType("");
      setContactEmail("");
      onDone?.();
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-[#ececec] bg-[#f9f9f9] p-4">
      <div className="mb-3 flex items-center gap-2 text-[#5b0617]">
        <Icon name="add_business" className="text-[20px]" />
        <span className="text-[12px] font-bold uppercase tracking-[0.12em]">New client</span>
      </div>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Client name" className="mb-2 h-10 w-full rounded-xl border border-[#e2e2e2] bg-white px-3 text-sm outline-none focus:border-[#7a1f2b]" />
      <input value={businessType} onChange={(event) => setBusinessType(event.target.value)} placeholder="Business type" className="mb-2 h-10 w-full rounded-xl border border-[#e2e2e2] bg-white px-3 text-sm outline-none focus:border-[#7a1f2b]" />
      <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="Client email optional" className="mb-3 h-10 w-full rounded-xl border border-[#e2e2e2] bg-white px-3 text-sm outline-none focus:border-[#7a1f2b]" />
      {notice ? <p className={`mb-3 text-xs leading-5 ${notice.tone === "error" ? "text-[#93000a]" : notice.tone === "success" ? "text-emerald-700" : "text-amber-700"}`}>{notice.body}</p> : null}
      <button disabled={creatingClient} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617] disabled:cursor-wait disabled:opacity-70">
        {creatingClient ? <AgenticGlyph variant="validation" /> : <Icon name="arrow_forward" className="text-[18px]" />}
        Add Client
      </button>
    </form>
  );
}

function ClientContextRail({ selectedClient, clientId, readinessScore, sources, issues }: { selectedClient?: Client; clientId: string; readinessScore: number; sources: DataSource[]; issues: Issue[] }) {
  const confidence = readinessScore >= 80 ? "High" : readinessScore >= 50 ? "Medium" : "Low";
  const circumference = 251.2;
  const offset = circumference - (circumference * Math.min(100, readinessScore)) / 100;

  return (
    <aside className="custom-scrollbar hidden h-full w-[320px] shrink-0 flex-col space-y-10 overflow-y-auto border-l border-[#e2e2e2] bg-[#f4f3f3] p-6 xl:flex">
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Icon name="verified" className="text-[24px] text-[#5b0617]" />
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Trust Layer</h3>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-[#ececec] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="relative h-24 w-24">
            <svg className="h-full w-full -rotate-90">
              <circle className="text-[#e2e2e2]" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6" />
              <circle className="text-[#5b0617]" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="6" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[20px] font-semibold text-[#1a1c1c]">{readinessScore}%</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Data Completeness</span>
            <span className="text-sm text-[#5f5e5e]">{readinessScore > 0 ? "Calculated from live readiness factors." : "Waiting for processed client data."}</span>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[#ececec] bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5f5e5e]">Confidence</span>
          <span className={`rounded-full px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${confidence === "High" ? "bg-[#d1fae5] text-[#065f46]" : confidence === "Medium" ? "bg-[#fef3c7] text-[#854d0e]" : "bg-[#ffdad6] text-[#93000a]"}`}>{confidence}</span>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f5e5e]/60">Client Referenced</h3>
        <div className="flex items-center gap-3 rounded-lg border border-[#ececec] bg-white p-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8e8e8] text-[18px] font-semibold text-[#5f5e5e]">{initials(selectedClient?.name)}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1a1c1c]">{selectedClient?.name || (clientId ? "Selected Client" : "No client selected")}</p>
            <p className="truncate text-xs text-[#5f5e5e]">{selectedClient?.business_type || selectedClient?.contact_email || (clientId ? "Selected client" : "Choose a client to begin")}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f5e5e]/60">Sources Used</h3>
        <div className="space-y-2">
          {sources.length ? sources.slice(0, 5).map((source) => (
            <div key={source.id} className="flex items-center gap-2 rounded-lg border border-transparent p-2 text-[#5f5e5e] transition hover:border-[#ececec] hover:bg-white hover:text-[#5b0617]">
              <SourceLogo source={source.source_type || source.provider} className="h-6 w-6 shrink-0" />
              <span className="truncate text-sm">{titleCase(source.provider || source.source_type)}</span>
            </div>
          )) : <p className="rounded-lg border border-dashed border-[#dcc0c0] bg-white p-4 text-sm leading-6 text-[#5f5e5e]">No sources connected yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f5e5e]/60">Missing Data</h3>
        {issues.length ? issues.slice(0, 3).map((issue) => (
          <div key={issue.id} className="rounded-xl border border-[#efb8b8] bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[#1a1c1c]"><Icon name="error" className="text-[18px] text-[#ba1a1a]" /> {titleCase(issue.category)}</p>
            <p className="mt-2 text-xs leading-5 text-[#5f5e5e]">{issue.message}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#700018]">Request from client</p>
          </div>
        )) : <div className="rounded-xl border border-[#ececec] bg-white p-4 text-sm leading-6 text-[#5f5e5e]">No open missing-data issues.</div>}
      </section>
    </aside>
  );
}

function WorkbenchShell({ title, subtitle, clientId, setClientId, selectedClient, clientRows, refresh, refreshing, children }: { title: string; subtitle: string; clientId: string; setClientId: (id: string) => void; selectedClient?: Client; clientRows: Client[]; refresh: () => Promise<void>; refreshing: boolean; children: ReactNode }) {
  return (
    <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
      <header className="sticky top-0 z-40 border-b border-[#e7ddda] bg-white/76 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[76px] w-full max-w-[1480px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-7">
          <div className="flex min-w-0 items-center gap-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#111111] text-white shadow-[0_16px_36px_rgba(17,17,17,0.15)]">
              <Icon name={navItems.find((item) => item.label === title)?.icon ?? "dashboard"} className="text-[24px]" filled />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7A1F2B]">Fynny workspace</p>
              <h1 className="truncate text-[28px] font-black leading-tight tracking-[-0.05em] text-[#111111] lg:text-[34px]">{title}</h1>
              <p className="hidden truncate text-[14px] leading-6 text-[#706763] md:block">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="client-select">Choose client</label>
            <select id="client-select" value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[#dfccc6] bg-white/80 px-4 text-sm font-semibold text-[#322b29] outline-none shadow-[0_10px_28px_rgba(17,17,17,0.04)] transition focus:border-[#7a1f2b] lg:w-72 lg:flex-none">
              <option value="">{clientRows.length ? "Choose client" : "No clients connected"}</option>
              {clientRows.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            {selectedClient ? <span className="hidden max-w-48 truncate rounded-full border border-[#eadbd6] bg-[#fff8f5] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7A1F2B] xl:inline">{selectedClient.name}</span> : null}
            <button onClick={() => void refresh()} className="grid h-11 w-11 place-items-center rounded-2xl border border-[#eadbd6] bg-white text-[#655f5b] shadow-[0_10px_28px_rgba(17,17,17,0.04)] transition hover:-translate-y-0.5 hover:text-[#7A1F2B]">{refreshing ? <AgenticGlyph variant="portfolio" /> : <Icon name="refresh" className="text-[22px]" />}</button>
            <button className="grid h-11 w-11 place-items-center rounded-2xl border border-[#eadbd6] bg-white text-[#655f5b] shadow-[0_10px_28px_rgba(17,17,17,0.04)] transition hover:-translate-y-0.5 hover:text-[#7A1F2B]"><Icon name="notifications" className="text-[24px]" /></button>
            <button className="grid h-11 w-11 place-items-center rounded-2xl border border-[#eadbd6] bg-white text-[#655f5b] shadow-[0_10px_28px_rgba(17,17,17,0.04)] transition hover:-translate-y-0.5 hover:text-[#7A1F2B]"><Icon name="help_outline" className="text-[24px]" /></button>
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#e8dedb] bg-[#111111] text-white shadow-[0_15px_34px_rgba(17,17,17,0.14)]"><Icon name="account_circle" className="text-[25px]" /></div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1480px] space-y-7 p-4 sm:p-5 md:space-y-10 md:p-7">{children}</div>
    </main>
  );
}

function ProcessingScreen({ jobs, error, selectedClient, setActiveTab, setQuestion }: { jobs: ProcessingJob[]; error: string | null; selectedClient?: Client; setActiveTab: (tab: TabId) => void; setQuestion: (value: string) => void }) {
  const active = jobs.filter((job) => ["queued", "processing"].includes(job.status)).length;
  const blockedJobs = jobs.filter((job) => ["failed", "blocked", "needs_review"].includes(job.status));
  const blocked = blockedJobs.length;
  const ready = jobs.filter((job) => job.intelligence_ready).length;
  const blockedClients = new Set(blockedJobs.map((job) => job.client_id).filter(Boolean)).size;
  const latestJob = jobs[0];
  const nextAction = !selectedClient
    ? { title: "Choose the demo client", body: "Pick `Aster Foods Pvt Ltd` first so the demo runs through one complete client story.", label: "Open Clients", tab: "clients" as TabId }
    : blocked
      ? { title: "Resolve blockers first", body: "The current client has review items. Open Validation and clear blockers before relying on AI outputs.", label: "Open Validation", tab: "validation" as TabId }
      : !jobs.length
        ? { title: "Start collection", body: "No files are in the pipeline yet. Connect Gmail or upload the Aster Foods pack to start processing.", label: "Open Sources", tab: "sources" as TabId }
        : ready
          ? { title: "Use intelligence outputs", body: "The pipeline has ready evidence. Move to Ask Fynny, Reports, or Exports to show the product value.", label: "Open Ask", tab: "ask" as TabId }
          : { title: "Keep processing moving", body: "The pipeline has active jobs. Monitor progress here and switch to Validation if anything needs review.", label: "Refresh Context", tab: "processing" as TabId };

  function goToPrompt(prompt: string) {
    setQuestion(prompt);
    setActiveTab("ask");
  }

  return (
    <section className="space-y-16">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <HeroMetric label="Files Collected" value={String(jobs.length)} accent="maroon" progress={jobs.length ? 75 : 0} />
        <HeroMetric label="Processing" value={String(active)} detail={active ? "Active" : "Idle" } accent="gray" progress={active ? 40 : 0} />
        <HeroMetric label="Needs Review" value={String(blocked)} detail={blocked ? "Blocked" : "Clear"} accent="red" progress={blocked ? 24 : 0} urgent={blocked > 0} />
        <HeroMetric label="Clients Blocked" value={String(blockedClients).padStart(2, "0")} detail="Manual intervention" accent="maroon" progress={blockedClients ? 18 : 0} />
        <HeroMetric label="Reports Ready" value={String(ready)} detail="Finalized" accent="maroon" progress={ready ? 88 : 0} />
      </div>
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Operational Next Step">
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#ececec] bg-[#f9f9f9] p-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#700018]">{selectedClient?.name ?? "No active client"}</p>
              <h4 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">{nextAction.title}</h4>
              <p className="mt-2 text-sm leading-6 text-[#5f5e5e]">{nextAction.body}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => setActiveTab(nextAction.tab)} className="rounded-xl bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5b0617]">{nextAction.label}</button>
              <button onClick={() => goToPrompt("Give me one client-specific demo using Aster Foods and show all product use cases from Gmail sync to reports.")} className="rounded-xl border border-[#dcc0c0] bg-white px-5 py-3 text-sm font-bold text-[#5b0617] transition hover:border-[#5b0617]">Load Demo Flow</button>
            </div>
            {latestJob ? <p className="text-xs leading-5 text-[#5f5e5e]">Latest job status: {titleCase(latestJob.status)} at {titleCase(latestJob.current_stage)} on {formatDate(latestJob.created_at)}.</p> : <p className="text-xs leading-5 text-[#5f5e5e]">No pipeline jobs yet. Start with the Aster Foods Gmail attachments or the correlated pack.</p>}
          </div>
        </Card>
        <Card title="Aster Foods Demo Flow">
          <div className="space-y-4">
            {clientDemoFlow.map((step, index) => (
              <div key={step.title} className="flex flex-col gap-3 rounded-2xl border border-[#ececec] bg-[#fcfbfb] p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#700018]">Step {index + 1}</p>
                  <p className="mt-1 text-[17px] font-semibold text-[#111111]">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#5f5e5e]">{step.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setActiveTab(step.tab)} className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">{step.actionLabel}</button>
                  {step.prompt ? <button onClick={() => goToPrompt(step.prompt ?? "")} className="rounded-full bg-[#700018] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617]">Run Prompt</button> : null}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <a href="/samples/aster-foods/client-demo-playbook.md" target="_blank" rel="noreferrer" className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Open Full Guide</a>
              <a href="/samples/aster-foods/test_scenarios.md" target="_blank" rel="noreferrer" className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Open Scenario Checks</a>
              <a href="/samples/fynny-aster-foods-correlated-test-pack.zip" download className="rounded-full bg-[#700018] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617]">Download Demo Pack</a>
            </div>
          </div>
        </Card>
      </section>
      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><h2 className="text-[26px] font-semibold tracking-[-0.01em] text-[#5b0617]">Pipeline Health</h2><p className="mt-1 text-[16px] text-[#5f5e5e]">Visual representation of data flow and throughput bottlenecks.</p></div>
          <button onClick={() => setActiveTab(blocked ? "validation" : jobs.length ? "ask" : "sources")} className="hidden rounded-lg bg-[#7a1f2b] px-8 py-3 text-[16px] font-bold text-white md:inline-flex"><Icon name={blocked ? "warning" : jobs.length ? "psychology" : "upload_file"} className="mr-2 text-[22px]" /> {blocked ? "Review Blocked Files" : jobs.length ? "Open Ask Fynny" : "Start Collection"}</button>
        </div>
        <PipelineHealth jobs={jobs} />
      </section>
      <section>
        <div className="mb-7 flex items-center justify-between gap-4">
          <h2 className="text-[26px] font-semibold tracking-[-0.01em] text-[#5b0617]">Recent Pipeline Activity</h2>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full border border-[#e2e2e2] bg-white px-4 py-2 text-xs font-semibold text-[#5f5e5e]">Queued {active}</span>
            <span className="rounded-full border border-[#efb8b8] bg-[#fff5f5] px-4 py-2 text-xs font-semibold text-[#93000a]">Blocked {blocked}</span>
            <span className="rounded-full border border-[#d6eadf] bg-[#f3fbf6] px-4 py-2 text-xs font-semibold text-[#0b6b43]">Ready {ready}</span>
          </div>
        </div>
        <DataTable headers={["Client", "Source", "File", "Recorded", "Stage", "Status", "Issue", "Action"]} empty={error ?? "No processing jobs found. Upload client documents to begin the pipeline."} rows={jobs.map((job) => [shortId(job.client_id), titleCase(job.source_type), shortId(job.document_id), formatDate(job.created_at), titleCase(job.current_stage), titleCase(job.status), ["failed", "blocked", "needs_review"].includes(job.status) ? "Review needed" : job.intelligence_ready ? "Ready" : "-", ["failed", "blocked", "needs_review"].includes(job.status) ? "Open Validation" : job.intelligence_ready ? "Open Ask" : "Monitor"])} onRowClick={(index) => setActiveTab(["failed", "blocked", "needs_review"].includes(jobs[index]?.status) ? "validation" : jobs[index]?.intelligence_ready ? "ask" : "processing")} />
      </section>
    </section>
  );
}

function HeroMetric({ label, value, detail, accent, progress, urgent }: { label: string; value: string; detail?: string; accent: "maroon" | "gray" | "red"; progress: number; urgent?: boolean }) {
  const color = accent === "red" ? "#ba1a1a" : accent === "gray" ? "#5f5e5e" : "#700018";
  return (
    <div className={`group relative overflow-hidden rounded-[28px] border bg-white/86 p-5 shadow-[0_24px_70px_rgba(47,35,31,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(47,35,31,0.12)] ${accent === "red" ? "border-[#efb8b8]" : "border-[#eee2de]"}`}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-35" style={{ backgroundColor: color }} />
      {urgent ? <div className="absolute right-4 top-4 rounded-full bg-[#ba1a1a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">Urgent</div> : null}
      <p className="mb-5 text-[12px] font-black uppercase tracking-[0.18em] text-[#766b67]" style={{ color: accent === "red" ? color : undefined }}>{label}</p>
      <div className="flex items-end justify-between gap-3">
        <span className="font-[var(--font-platform-mono)] text-[38px] font-black tracking-[-0.06em]" style={{ color }}>{value}</span>
        <span className="rounded-full bg-[#f6f1ee] px-3 py-1 text-[12px] font-bold text-[#655f5b]">{detail ?? "Live"}</span>
      </div>
      <div className="mt-7 h-2 overflow-hidden rounded-full bg-[#eee7e3]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function PipelineHealth({ jobs }: { jobs: ProcessingJob[] }) {
  return (
    <div className="overflow-x-auto rounded-[30px] border border-[#eee2de] bg-white/78 p-8 shadow-[0_24px_80px_rgba(47,35,31,0.08)] backdrop-blur-xl">
      <div className="relative flex min-w-[1040px] items-start justify-between">
        <div className="absolute left-8 right-8 top-8 h-px bg-gradient-to-r from-transparent via-[#c9aaa2] to-transparent" />
        {processingStages.map((stage) => {
          const count = jobs.filter((job) => job.current_stage === stage).length;
          const complete = stage === "intelligence_ready" ? jobs.filter((job) => job.intelligence_ready).length : count;
          return (
            <div key={stage} className="relative z-10 flex w-36 flex-col items-center gap-3 text-center">
              <div className={`grid h-16 w-16 place-items-center rounded-2xl border bg-white shadow-[0_18px_38px_rgba(17,17,17,0.08)] transition hover:-translate-y-1 ${count ? "border-[#efb8b8] text-[#ba1a1a]" : "border-[#e7d6d0] text-[#700018]"}`}><Icon name={iconForStage(stage)} className="text-[28px]" /></div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#655f5b]">{titleCase(stage)}</p>
              <p className="font-[var(--font-platform-mono)] text-[18px] font-bold text-[#700018]">{complete || "-"} {stage === "intelligence_ready" ? "Ready" : "units"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourcesScreen(props: {
  sources: DataSource[];
  error: string | null;
  clientId: string;
  selectedClient?: Client;
  connectSource: (source: SourceOption) => Promise<void>;
  uploadDocument: (file: File, sourceType?: string) => Promise<boolean>;
  syncSource: (dataSourceId: string) => Promise<void>;
  requestingSource: string | null;
  uploadingDocument: boolean;
  syncingSource: string | null;
  notice: ActionNotice;
  setActiveTab: (tab: TabId) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<SourceCategory>("all");
  const [selectedSource, setSelectedSource] = useState<SourceOption>(sourceOptions[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSourceRef = useRef<SourceOption>(sourceOptions[0]);
  const visibleSources = sourceOptions.filter((source) => activeCategory === "all" || source.category === activeCategory);
  const busy = props.uploadingDocument || props.requestingSource === selectedSource.id;
  const sourceCounts = {
    connected: props.sources.length,
    integrations: sourceOptions.filter((source) => source.category === "integration").length,
    uploads: sourceOptions.filter((source) => source.category === "upload").length
  };

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const source = uploadSourceRef.current ?? selectedSource;
    void (async () => {
      for (const file of files) {
        await props.uploadDocument(file, source.sourceType ?? (source.id === "manual_upload" ? "manual_upload" : source.id));
      }
    })();
  }

  function runPrimaryAction(source = selectedSource) {
    setSelectedSource(source);
    if (source.locked) {
      props.setActiveTab("sources");
      return;
    }
    if (source.action === "upload") {
      uploadSourceRef.current = source;
      fileInputRef.current?.click();
      return;
    }
    if (source.action === "connect") {
      void props.connectSource(source);
      return;
    }
    props.setActiveTab("sources");
  }

  return (
    <section className="space-y-6">
      <input ref={fileInputRef} onChange={handleFileChange} className="hidden" type="file" accept={selectedSource.id === "spreadsheet" ? ".csv,.txt,.json,.md" : ".pdf,.csv,.png,.jpg,.jpeg,.txt,.json,.md"} multiple />
      <div className="overflow-hidden rounded-[32px] border border-[#ececec] bg-[#111111] text-white shadow-[0_24px_80px_rgba(17,17,17,0.12)]">
        <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="flex min-h-[320px] flex-col justify-between gap-8">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#cfa0a6]">Data command center</p>
              <h2 className="mt-4 max-w-xl text-[38px] font-semibold tracking-[-0.04em] text-white md:text-[54px]">Connect the CA stack in minutes.</h2>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/68">The CA team connects Gmail, Drive, Zoho, or uploads files. Then you route data into the right client for processing and reporting.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Connected" value={String(sourceCounts.connected)} tone="maroon" detail="Live sources" />
              <MiniMetric label="Integrations" value={String(sourceCounts.integrations)} tone="dark" detail="Ready to connect" />
              <MiniMetric label="Uploads" value={String(sourceCounts.uploads)} tone="dark" detail="CSV, PDF, TXT" />
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white p-5 text-[#111111] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 border-b border-[#eeeeee] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f6eeee] text-[#700018]">
                  <Icon name="business_center" className="text-[24px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#777]">Active client</p>
                  <p className="truncate text-[19px] font-semibold">{props.selectedClient?.name ?? "No client selected"}</p>
                  <p className="mt-1 text-sm text-[#666]">{props.selectedClient?.business_type || props.selectedClient?.contact_email || "Choose the client you want this data routed into."}</p>
                </div>
              </div>
              <button onClick={() => props.setActiveTab("clients")} className="shrink-0 rounded-full border border-[#dcc0c0] bg-white px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Choose Client</button>
            </div>
            <div className="mt-5 flex items-start gap-4 rounded-3xl bg-[#f7f6f5] p-5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-[#700018] shadow-sm">
                {busy ? <AgenticGlyph variant="validation" /> : <SourceLogo source={selectedSource.id} className="h-7 w-7" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#777]">{selectedSource.provider}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#700018]">{selectedSource.category}</span>
                </div>
                <h3 className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-[#111111]">{selectedSource.label}</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#666]">{selectedSource.description}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <FieldBox label="Access" value="Read-only" />
              <FieldBox label="Setup" value={selectedSource.action === "connect" ? "Direct connect" : "Upload file"} />
              <FieldBox label="Routing" value="Auto process" />
            </div>
            <button onClick={() => runPrimaryAction()} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#111111] px-6 py-4 text-[15px] font-bold text-white shadow-[0_16px_36px_rgba(17,17,17,0.16)] transition hover:bg-[#5b0617] disabled:cursor-wait disabled:opacity-70">
              {busy ? <AgenticGlyph variant="validation" /> : <Icon name={selectedSource.action === "connect" ? "add_link" : selectedSource.action === "upload" ? "upload_file" : "ios_share"} className="text-[22px]" />}
              {selectedSource.action === "connect" ? `Connect ${selectedSource.label}` : selectedSource.action === "upload" ? "Upload File" : "Use Upload Link"}
            </button>
            {selectedSource.category === "upload" || selectedSource.id === "gmail" ? (
              <div className="mt-4 rounded-2xl border border-[#eadada] bg-white/70 p-3">
                <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f5e5e]">{selectedSource.id === "gmail" ? "Email demo attachments" : "Sample data for testing"}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <a href="/samples/fynny-aster-foods-correlated-test-pack.zip" download className="rounded-full bg-[#700018] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617]">Aster Foods Pack</a>
                  <a href="/samples/aster-foods/test_scenarios.md" target="_blank" rel="noreferrer" className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Scenario Guide</a>
                  <a href="/samples/fynny-sample-bank-statement.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Bank CSV</a>
                  <a href="/samples/fynny-sample-sales-register.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Sales CSV</a>
                  <a href="/samples/fynny-sample-gst-summary.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">GST CSV</a>
                  <a href="/samples/email-demo/fynny-email-sales-invoice-solid.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Email Invoice</a>
                  <a href="/samples/email-demo/fynny-email-contract-renewal.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Email Contract</a>
                  <a href="/samples/email-demo/fynny-email-gst-summary.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Email GST</a>
                  <a href="/samples/email-demo/test-playbook.md" target="_blank" rel="noreferrer" className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Email Demo Guide</a>
                  <a href="/samples/aster-foods/client-demo-playbook.md" target="_blank" rel="noreferrer" className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Full Client Guide</a>
                </div>
                {selectedSource.id === "gmail" ? <p className="mt-3 text-center text-xs leading-5 text-[#5f5e5e]">Use one client, send these three Aster Foods files as Gmail attachments, then continue with the full Aster Foods pack to show all product use cases cleanly.</p> : null}
              </div>
            ) : null}
            {selectedSource.action === "manual" ? <p className="mt-3 text-center text-xs leading-5 text-[#5f5e5e]">For MVP, WhatsApp uses upload links, mobile portal, or forwarded files. Fynny does not need full WhatsApp access.</p> : null}
            {props.notice ? <div className="mt-4"><ActionNoticeCard notice={props.notice} /></div> : null}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-[#e2e2e2] bg-white p-1.5 shadow-sm">
        {[
          { id: "all", label: "All Sources" },
          { id: "upload", label: "Uploads" },
          { id: "integration", label: "Integrations" },
          { id: "manual", label: "WhatsApp / Manual" }
        ].map((item) => (
          <button key={item.id} onClick={() => setActiveCategory(item.id as SourceCategory)} className={`shrink-0 rounded-full px-5 py-3 text-[12px] font-bold uppercase tracking-[0.1em] transition ${activeCategory === item.id ? "bg-[#111111] text-white" : "text-[#5f5e5e] hover:bg-[#f4f3f3]"}`}>{item.label}</button>
        ))}
      </div>

      <Card title="Connect Sources">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibleSources.map((source) => {
            const active = selectedSource.id === source.id;
            const loading = props.requestingSource === source.id || (props.uploadingDocument && active);
            return (
              <button key={source.id} onClick={() => runPrimaryAction(source)} className={`group rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#7a1f2b] hover:shadow-[0_18px_40px_rgba(17,17,17,0.06)] ${source.locked ? "opacity-65" : ""} ${active ? "border-[#7a1f2b] shadow-[0_18px_40px_rgba(17,17,17,0.06)]" : "border-[#e2e2e2]"}`}>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl ring-1 ${sourceLogoTileClass(source.id, active)}`}>{loading ? <AgenticGlyph variant="validation" /> : <SourceLogo source={source.id} className="h-8 w-8" />}</div>
                  <span className="rounded-full bg-[#f4f3f3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5f5e5e]">{source.locked ? "locked" : source.action === "connect" ? "direct" : source.category}</span>
                </div>
                <p className="text-[17px] font-semibold text-[#111111]">{source.label}</p>
                <p className="mt-2 text-[13px] leading-6 text-[#5f5e5e]">{source.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#700018]">
                  {source.locked ? "Locked" : source.action === "connect" ? "Connect" : "Select"} <Icon name={source.locked ? "lock" : "arrow_forward"} className="text-[16px]" />
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Connected Sources">
        {props.sources.length ? (
          <div className="grid gap-3">
            {props.sources.map((source) => (
              <div key={source.id} className="flex flex-col gap-4 rounded-2xl border border-[#e2e2e2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`grid h-12 w-12 place-items-center rounded-xl ring-1 ${sourceLogoTileClass(source.source_type || source.provider)}`}><SourceLogo source={source.source_type || source.provider} className="h-7 w-7" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-[#111111]">{titleCase(source.source_type)}</p>
                    <p className="text-sm text-[#5f5e5e]">{source.provider} / {titleCase(source.connection_status)} / {source.last_sync_at ? `Last sync ${formatDate(source.last_sync_at)}` : "Ready to sync"}</p>
                  </div>
                </div>
                <button onClick={() => void props.syncSource(source.id)} disabled={props.syncingSource === source.id} className="rounded-full border border-[#dcc0c0] px-5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617] disabled:cursor-wait disabled:opacity-60">
                  {props.syncingSource === source.id ? "Syncing" : "Sync"}
                </button>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="hub" title="No connected sources yet" body={props.error ?? "Choose a client, then connect an integration or upload financial files to begin."} />}
      </Card>
    </section>
  );
}

function ClientsScreen({
  clients,
  error,
  setClientId,
  setActiveTab,
  createClient,
  creatingClient,
  notice
}: {
  clients: Client[];
  error: string | null;
  setClientId: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
  createClient: (input: ClientCreateInput) => Promise<boolean>;
  creatingClient: boolean;
  notice: ActionNotice;
}) {
  return (
    <section className="space-y-6">
      <Card title="Add New Client">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-2xl border border-[#ececec] bg-[#f9f9f9] p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#700018]">Start here</p>
            <h3 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#111111]">Create the client first.</h3>
            <p className="mt-3 text-sm leading-6 text-[#5f5e5e]">Every upload, Gmail sync, Drive file, Zoho record, report, export, and Ask Fynny answer is routed to the selected client. Clients are scoped to your signed-in firm account.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Step 1" value="Add" tone="maroon" detail="Client" />
              <MiniMetric label="Step 2" value="Sync" tone="dark" detail="Sources" />
              <MiniMetric label="Step 3" value="Ask" tone="dark" detail="Reports" />
            </div>
          </div>
          <CreateClientMiniForm createClient={createClient} creatingClient={creatingClient} notice={notice} />
        </div>
      </Card>
      <Card title="Clients">
        <DataTable
          headers={["Client", "Business Type", "Contact", "Created", "Action"]}
          empty={error ?? "No clients yet. Add your first client here, then open Ask Fynny or connect sources."}
          rows={clients.map((client) => [client.name, client.business_type ?? "-", client.contact_email ?? "-", formatDate(client.created_at), "Open Ask"])}
          onRowClick={(index) => {
            const client = clients[index];
            if (client) {
              setClientId(client.id);
              setActiveTab("ask");
            }
          }}
        />
      </Card>
    </section>
  );
}
function CollectionScreen({
  pending,
  health,
  error,
  selectedClient,
  createMonthlyCycle,
  sendReminder,
  escalateSubmission,
  notice
}: {
  pending: SubmissionRequest[];
  health?: SubmissionHealth;
  error: string | null;
  selectedClient?: Client;
  createMonthlyCycle: () => Promise<void>;
  sendReminder: (requestId: string, channel?: "email" | "whatsapp") => Promise<void>;
  escalateSubmission: (requestId: string) => Promise<void>;
  notice: ActionNotice;
}) {
  const overdueCount = health?.overdueClients ?? pending.filter((row) => (row.days_overdue ?? 0) > 0).length;
  const queueState = pending.length
    ? overdueCount
      ? "Follow up on overdue clients first."
      : "Everything pending is still inside the expected window."
    : "Create a reporting cycle to activate reminders.";
  return (
    <section className="space-y-7">
      <div className="relative overflow-hidden rounded-[34px] border border-[#eee2de] bg-[#111111] p-7 text-white shadow-[0_28px_90px_rgba(17,17,17,0.18)] md:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#7A1F2B]/45 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#cba39b] to-transparent" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#e6c4bd]">Client collection engine</p>
            <h2 className="mt-3 max-w-3xl text-[34px] font-black leading-[0.98] tracking-[-0.06em] md:text-[52px]">Stop chasing files manually.</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/70">Create a reporting cycle, track every required document, prepare professional reminders, and route client uploads straight into processing.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Queue state</p>
            <p className="mt-2 max-w-xs text-[18px] font-bold leading-6">{queueState}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <HeroMetric label="Pending Uploads" value={String(health?.pendingUploads ?? pending.length)} accent="maroon" progress={Math.min(100, (health?.pendingUploads ?? pending.length) * 12)} />
        <HeroMetric label="Overdue Clients" value={String(health?.overdueClients ?? pending.filter((row) => (row.days_overdue ?? 0) > 0).length)} accent={(health?.overdueClients ?? 0) ? "red" : "gray"} progress={(health?.overdueClients ?? 0) ? 70 : 5} urgent={Boolean(health?.overdueClients)} />
        <HeroMetric label="Due Today" value={String(health?.dueToday ?? 0)} accent="gray" progress={(health?.dueToday ?? 0) ? 45 : 5} />
        <HeroMetric label="Reports Blocked" value={String(health?.reportsBlocked ?? 0)} accent={(health?.reportsBlocked ?? 0) ? "red" : "gray"} progress={(health?.reportsBlocked ?? 0) ? 60 : 5} />
        <HeroMetric label="Completion" value={`${health?.submissionCompletionRate ?? 0}%`} accent="maroon" progress={health?.submissionCompletionRate ?? 0} />
      </div>
      <Card title="Create Reporting Cycle">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7A1F2B]">Monthly operating rhythm</p>
            <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-[#111111]">{selectedClient ? `Monthly MIS for ${selectedClient.name}` : "Choose a client first"}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#655f5b]">Required by default: Bank Statement, Sales Register, Purchase Register, and GST Data. Due date is set to the 5th of the current month.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Bank Statement", "Sales Register", "Purchase Register", "GST Data"].map((item) => <span key={item} className="rounded-full border border-[#eadbd6] bg-[#fff8f5] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B]">{item}</span>)}
            </div>
          </div>
          <button onClick={() => void createMonthlyCycle()} className="rounded-2xl bg-[#111111] px-7 py-5 text-[13px] font-black uppercase tracking-[0.1em] text-white shadow-[0_18px_44px_rgba(17,17,17,0.18)] transition hover:-translate-y-0.5 hover:bg-[#5b0617]">Create Monthly MIS Cycle</button>
        </div>
        {notice ? <div className="mt-5"><ActionNoticeCard notice={notice} /></div> : null}
      </Card>
      <Card title="Collection Queue">
        {error ? <ActionNoticeCard notice={{ tone: "error", title: "Collection setup needed", body: error }} /> : null}
        {pending.length ? (
          <div className="overflow-hidden rounded-[24px] border border-[#eee2de] bg-white shadow-[0_18px_60px_rgba(47,35,31,0.06)]">
            <div className="flex flex-col gap-3 border-b border-[#f0e6e2] bg-[#faf6f3] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#766b67]">Pending client submissions</p>
                <p className="mt-1 text-sm text-[#655f5b]">Review the highest-risk missing inputs first, then send reminders or escalate.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B]">{pending.length} open</span>
                <span className="rounded-full bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#ba1a1a]">{overdueCount} overdue</span>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-white"><tr>{["Client", "Required Item", "Due Date", "Days Overdue", "Reminder Status", "Last Contacted", "Owner", "Action"].map((header) => <th key={header} className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#766b67]">{header}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#f3ebe7]">
                {pending.map((row) => (
                  <tr key={row.id} className="transition hover:bg-[#fff8f5]">
                    <td className="px-5 py-5 text-[15px] font-semibold text-[#1a1c1c]">{row.client_name ?? shortId(row.client_id)}</td>
                    <td className="px-5 py-5 text-[15px] text-[#1a1c1c]">{row.required_item ?? titleCase(row.document_category)}</td>
                    <td className="px-5 py-5 text-[15px] text-[#5f5e5e]">{row.due_date ?? "-"}</td>
                    <td className={`px-5 py-5 text-[15px] font-black ${(row.days_overdue ?? 0) > 0 ? "text-[#93000a]" : "text-[#655f5b]"}`}>{row.days_overdue ?? 0}</td>
                    <td className="px-5 py-5"><span className="rounded-full bg-[#fff8f5] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617]">{titleCase(row.computed_reminder_status ?? row.reminder_status)}</span></td>
                    <td className="px-5 py-5 text-[15px] text-[#5f5e5e]">{formatDate(row.last_contacted_at)}</td>
                    <td className="px-5 py-5 text-[15px] text-[#5f5e5e]">{row.owner || "CA Team"}</td>
                    <td className="px-5 py-5">
                      <div className="flex gap-2">
                        <button onClick={() => void sendReminder(row.id, "email")} className="rounded-xl border border-[#dcc0c0] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617] hover:bg-[#fff8f5]">Email</button>
                        <button onClick={() => void sendReminder(row.id, "whatsapp")} className="rounded-xl border border-[#dcc0c0] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617] hover:bg-[#fff8f5]">WhatsApp</button>
                        <button onClick={() => void escalateSubmission(row.id)} className="rounded-xl bg-[#700018] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(112,0,24,0.16)] transition hover:-translate-y-0.5 hover:bg-[#5b0617]">Escalate</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : <EmptyState icon="assignment_late" title="No Pending Submissions" body={error ?? "Create a reporting cycle to start tracking required client documents and reminders."} />}
      </Card>
    </section>
  );
}
function ValidationScreen({ issues, error }: { issues: Issue[]; error: string | null }) {
  return <Card title="Validation Center"><DataTable headers={["Severity", "Category", "Issue", "Status", "Suggested Fix"]} empty={error ?? "No open validation issues for this client."} rows={issues.map((issue) => [titleCase(issue.severity), titleCase(issue.category), issue.message, titleCase(issue.status), issue.suggested_fix ?? "Review source document"])} /></Card>;
}
function MemoryScreen({ clientId, isReady, readiness }: { clientId: string; isReady: boolean; readiness: ReadinessResponse | null }) {
  return <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Card title="Financial Memory Graph"><EmptyState icon="memory" title={clientId ? (isReady ? "Financial memory is ready to show client events." : "Memory builds after validation and normalization.") : "Choose a client"} body="Financial memory contains events, entities, and relationships generated from connected client data." /></Card><Card title="Readiness Factors"><div className="space-y-4">{Object.entries(readiness?.data?.factors ?? {}).map(([name, score]) => <FactorBar key={name} label={titleCase(name)} value={score} />)}{!readiness?.data ? <p className="text-sm text-[#5f5e5e]">No readiness profile loaded yet.</p> : null}</div></Card></section>;
}
function ReportsScreen({ reports, error, isReady }: { reports: Report[]; error: string | null; isReady: boolean }) {
  return <Card title="Reports"><DataTable headers={["Report", "Status", "Published", "Created"]} empty={error ?? (isReady ? "No reports generated yet." : "Reports are blocked until Intelligence Ready is true.")} rows={reports.map((report) => [titleCase(report.report_type), titleCase(report.status), report.published_to_client ? "Yes" : "No", formatDate(report.created_at)])} /></Card>;
}
function ExportsScreen({ exports, error, isReady, generateExport, generating }: { exports: ExportRow[]; error: string | null; isReady: boolean; generateExport: (exportType: string, fileFormat: "csv" | "xlsx" | "pdf") => void; generating: boolean }) {
  const exportActions = [
    { type: "mis_report", format: "xlsx" as const, title: "MIS Workbook", body: "Revenue, margin, variance, formulas, and audit sheets." },
    { type: "cleaned_sales_register", format: "csv" as const, title: "Sales Register CSV", body: "Invoice cleanup, receivables aging, and collection risk." },
    { type: "cleaned_purchase_register", format: "csv" as const, title: "Purchase Register CSV", body: "Vendor bills, payables aging, and payment priority." },
    { type: "gst_ready_data", format: "csv" as const, title: "GST Ready CSV", body: "Output GST, ITC, payable estimate, and mismatch status." }
  ];
  return (
    <section className="space-y-6">
      <Card title="Generate Exports">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {exportActions.map((action) => (
            <button
              key={action.type}
              type="button"
              disabled={!isReady || generating}
              onClick={() => generateExport(action.type, action.format)}
              className="rounded-2xl border border-[#ececec] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#5b0617] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#5b0617] text-white"><Icon name="download" className="text-[22px]" /></div>
              <h3 className="text-[18px] font-semibold text-[#111111]">{action.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5f5e5e]">{action.body}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b0617]">{generating ? "Generating" : `Create ${action.format.toUpperCase()}`} <Icon name="arrow_forward" className="text-[16px]" /></span>
            </button>
          ))}
        </div>
        {!isReady ? <p className="mt-5 rounded-xl border border-[#dcc0c0] bg-[#f9f9f9] p-4 text-sm leading-6 text-[#5f5e5e]">Exports are locked until Intelligence Ready is true, so client-facing files are never generated from incomplete data.</p> : null}
      </Card>
      <Card title="Generated Files">
        {error ? <ActionNoticeCard notice={{ tone: "error", title: "Exports unavailable", body: error }} /> : null}
        {exports.length ? (
          <div className="overflow-x-auto rounded-xl border border-[#e2e2e2] bg-white">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead className="bg-[#f8f8f8]"><tr>{["Export", "Format", "File", "Created"].map((header) => <th key={header} className="px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">{header}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#f8f8f8]">
                {exports.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8f8f8]">
                    <td className="px-5 py-5 text-[15px] font-semibold text-[#1a1c1c]">{titleCase(row.export_type)}</td>
                    <td className="px-5 py-5 text-[15px] uppercase text-[#5f5e5e]">{row.file_format}</td>
                    <td className="px-5 py-5 text-[15px]">
                      {row.storage_url ? <a href={row.storage_url} download={`fynny-${row.export_type}.${row.file_format === "xlsx" ? "xls" : row.file_format}`} className="inline-flex items-center gap-2 rounded-lg bg-[#5b0617] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white"><Icon name="download" className="text-[16px]" /> Download</a> : <span className="text-[#5f5e5e]">Pending</span>}
                    </td>
                    <td className="px-5 py-5 text-[15px] text-[#5f5e5e]">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="file_download" title="No Exports Yet" body={isReady ? "Generate MIS, GST, sales, or purchase files from verified intelligence." : "Exports are blocked until Intelligence Ready is true."} />}
      </Card>
    </section>
  );
}
function SimpleScreen({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <Card title={titleForIcon(icon)}><EmptyState icon={icon} title={title} body={body} /></Card>;
}

function InsightGrid({ readinessScore, issueCount, sourceCount }: { readinessScore: number; issueCount: number; sourceCount: number }) {
  return <div className="grid gap-4 md:grid-cols-3"><MiniMetric label="Readiness" value={`${readinessScore}%`} tone="maroon" detail="Live score" /><MiniMetric label="Open Issues" value={String(issueCount)} tone={issueCount ? "red" : "dark"} detail={issueCount ? "Needs review" : "Clear"} /><MiniMetric label="Sources" value={String(sourceCount)} tone="dark" detail="Connected" /></div>;
}
function MiniMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "maroon" | "red" | "dark" }) {
  const color = tone === "red" ? "#ba1a1a" : tone === "maroon" ? "#700018" : "#111111";
  return <div className="rounded-[24px] border border-[#eee2de] bg-white/86 p-5 shadow-[0_16px_45px_rgba(47,35,31,0.06)] transition hover:-translate-y-0.5"><p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#766b67]">{label}</p><p className="font-[var(--font-platform-mono)] text-[24px] font-black tracking-[-0.04em]" style={{ color }}>{value}</p><p className="mt-2 text-[13px] leading-5 text-[#655f5b]">{detail}</p></div>;
}
function VerifiedSources({ sources }: { sources: DataSource[] }) {
  return <div className="rounded-2xl border border-[#e2e2e2] bg-white p-6"><div className="mb-5 flex items-center justify-between"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Connected Sources</p><div className="flex items-center gap-3">{["gmail", "google_drive", "zoho_books"].map((source) => <span key={source} className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${sourceLogoTileClass(source)}`}><SourceLogo source={source} className="h-5 w-5" /></span>)}</div></div><div className="space-y-3">{sources.length ? sources.slice(0, 3).map((source) => <SourceCard key={source.id} source={source} />) : <p className="rounded-lg border border-[#e2e2e2] p-4 text-sm text-[#5f5e5e]">No sources yet. Connect read-only data sources first.</p>}</div></div>;
}
function SourceCard({ source }: { source: DataSource }) {
  return <div className="flex items-center justify-between rounded-lg border border-[#e2e2e2] bg-white px-4 py-3"><div className="flex items-center gap-4"><span className={`grid h-10 w-10 place-items-center rounded-lg ring-1 ${sourceLogoTileClass(source.source_type || source.provider)}`}><SourceLogo source={source.source_type || source.provider} className="h-6 w-6" /></span><span className="text-[16px] text-[#111111]">{titleCase(source.source_type)}</span></div><span className="font-[var(--font-platform-mono)] text-[13px] text-[#5f5e5e]">{titleCase(source.connection_status)}</span></div>;
}
function SourceLine({ source }: { source: DataSource }) {
  return <div className="flex items-center gap-3"><div className={`grid h-10 w-10 place-items-center rounded-lg ring-1 ${sourceLogoTileClass(source.source_type || source.provider)}`}><SourceLogo source={source.source_type || source.provider} className="h-6 w-6" /></div><span className="flex-1 text-[16px] text-[#111111]">{titleCase(source.source_type)}</span><span className="h-2 w-2 rounded-full bg-[#00875a]" /></div>;
}
function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-[24px] border border-[#eee2de] bg-white/88 shadow-[0_20px_60px_rgba(47,35,31,0.07)] backdrop-blur-xl sm:rounded-[30px] sm:shadow-[0_26px_80px_rgba(47,35,31,0.08)]"><div className="border-b border-[#efe4e0] bg-[linear-gradient(180deg,#ffffff_0%,#fbf7f5_100%)] px-4 py-4 sm:px-6 sm:py-5"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#7A1F2B]" /><h3 className="text-[18px] font-black tracking-[-0.03em] text-[#111111] sm:text-[21px]">{title}</h3></div></div><div className="p-4 sm:p-6">{children}</div></section>;
}
function DataTable({ headers, rows, empty, onRowClick }: { headers: string[]; rows: string[][]; empty: string; onRowClick?: (index: number) => void }) {
  if (!rows.length) return <EmptyState icon="upload_file" title="No Data Connected" body={empty} />;
  return <div className="overflow-x-auto rounded-[24px] border border-[#eee2de] bg-white shadow-[0_18px_55px_rgba(47,35,31,0.06)]"><table className="w-full min-w-[780px] border-collapse text-left"><thead className="bg-[#faf6f3]"><tr>{headers.map((header) => <th key={header} className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#766b67]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#f3ebe7]">{rows.map((row, rowIndex) => <tr key={rowIndex} onClick={() => onRowClick?.(rowIndex)} className={`transition ${onRowClick ? "cursor-pointer hover:bg-[#fff8f5]" : "hover:bg-[#fff8f5]"}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className={`px-5 py-5 text-[15px] text-[#1a1c1c] ${cellIndex === 2 ? "font-[var(--font-platform-mono)] font-semibold text-[#700018]" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-[24px] border border-dashed border-[#d8c3bb] bg-[radial-gradient(circle_at_center,rgba(122,31,43,0.08),transparent_52%),#fffaf8] p-5 text-center sm:min-h-64 sm:rounded-[28px] sm:p-8"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#700018] shadow-[0_18px_40px_rgba(122,31,43,0.10)] sm:h-14 sm:w-14"><Icon name={icon} className="text-[26px] sm:text-[28px]" /></div><h4 className="mt-4 text-[19px] font-black tracking-[-0.03em] text-[#111111] sm:mt-5 sm:text-[22px]">{title}</h4><p className="mt-2 max-w-xl text-[14px] leading-6 text-[#655f5b] sm:text-[15px] sm:leading-7">{body}</p></div>;
}
function FieldBox({ label, value }: { label: string; value: string }) {
  return <div><p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#766b67]">{label}</p><div className="rounded-2xl border border-[#dcc0c0] bg-[#fbf7f5] p-4 text-sm text-[#1a1c1c]">{value}</div></div>;
}
function FactorBar({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-2 flex justify-between text-sm"><span className="text-[#5f5e5e]">{label}</span><span className="font-semibold text-[#700018]">{value}%</span></div><div className="h-2 rounded-full bg-[#eeeeee]"><div className="h-full rounded-full bg-[#700018]" style={{ width: `${Math.min(100, value)}%` }} /></div></div>;
}
function ActionNoticeCard({ notice }: { notice: NonNullable<ActionNotice> }) {
  const tone = notice.tone === "success"
    ? { icon: "check_circle", border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" }
    : notice.tone === "warning"
      ? { icon: "info", border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700" }
      : { icon: "error", border: "border-[#efb8b8]", bg: "bg-[#fff5f5]", text: "text-[#93000a]" };
  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex gap-3">
        <Icon name={tone.icon} className={`mt-0.5 text-[22px] ${tone.text}`} />
        <div>
          <p className="text-[15px] font-semibold text-[#111111]">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 text-[#5f5e5e]">{notice.body}</p>
        </div>
      </div>
    </div>
  );
}
function SystemNotice({ title, body }: { title: string; body: string }) {
  return <section className="rounded-xl border border-[#ba1a1a] bg-[#ffdad6]/40 p-5"><div className="flex gap-3"><span className="text-[#ba1a1a]"><Icon name="warning" className="text-[24px]" /></span><div><h3 className="text-[16px] font-bold text-[#1a1c1c]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#564242]">{body}</p></div></div></section>;
}
function SettingsScreen({ providers, status, session }: { providers: Array<[string, boolean]>; status: StatusResponse | null; session: SessionResponse | null }) {
  return <section className="grid gap-6 lg:grid-cols-2"><Card title="API Integrations"><div className="divide-y divide-[#f4f3f3]">{providers.map(([name, ready]) => <div key={name} className="flex items-center justify-between py-4"><span className="text-[15px] font-semibold capitalize text-[#1a1c1c]">{name}</span><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-50 text-emerald-700" : "bg-[#ffdad6] text-[#93000a]"}`}><Icon name={ready ? "check_circle" : "error"} className="text-[16px]" />{ready ? "Ready" : "Missing"}</span></div>)}</div></Card><Card title="Authentication"><div className="space-y-4"><FieldBox label="ScaleKit Session" value={session?.authenticated ? session.user?.email ?? session.user?.name ?? "Authenticated" : "Not signed in"} /><FieldBox label="Environment" value={status?.mode ?? "Unknown"} /></div></Card></section>;
}
function iconForSource(source: string) {
  if (source.includes("gmail") || source.includes("email")) return "mail";
  if (source.includes("drive")) return "cloud";
  if (source.includes("zoho") || source.includes("bank")) return "account_balance";
  if (source.includes("gst") || source.includes("tax")) return "receipt_long";
  if (source.includes("spreadsheet")) return "table_chart";
  if (source.includes("pdf")) return "picture_as_pdf";
  if (source.includes("whatsapp")) return "chat";
  return "database";
}
function iconForStage(stage: string) {
  const icons: Record<string, string> = { collection: "check", classification: "category", extraction: "description", validation: "verified_user", normalization: "schema", memory_build: "memory", intelligence_ready: "auto_awesome" };
  return icons[stage] ?? "radio_button_unchecked";
}
function titleForTab(tab: TabId) {
  return navItems.find((item) => item.id === tab)?.label ?? "Fynny";
}
function subtitleForTab(tab: TabId) {
  const subtitles: Record<TabId, string> = {
    ask: "Financial intelligence command console",
    processing: "Real-time data pipeline integrity",
    clients: "Client visibility and firm workload",
    sources: "Direct read-only source connections",
    collection: "Client submissions, reminders, and secure upload queue",
    validation: "Missing data and reconciliation issues",
    memory: "Financial events, entities, and relationships",
    reports: "Client-ready intelligence outputs",
    exports: "Cleaned datasets and report files",
    advisory: "Opportunity discovery and risk review",
    portal: "Client approvals, visibility, and publishing",
    settings: "Authentication and integration health"
  };
  return subtitles[tab];
}
function titleForIcon(icon: string) {
  return icon === "auto_graph" ? "Advisory Engine" : "Client Portal";
}
