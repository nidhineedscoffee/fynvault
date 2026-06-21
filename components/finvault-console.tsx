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
type AskMessage = { role: "user" | "fynny"; text: string; blocked?: boolean; intelligence?: IntelligencePayload };
type ClientCreateInput = { name: string; businessType?: string; contactEmail?: string };
type TabId = "ask" | "processing" | "clients" | "sources" | "validation" | "memory" | "reports" | "exports" | "advisory" | "portal" | "settings";
type ActionNotice = { tone: "success" | "warning" | "error"; title: string; body: string } | null;
type SourceCategory = "all" | "upload" | "integration" | "manual";
type SourceOption = {
  id: string;
  label: string;
  provider: string;
  icon: string;
  category: SourceCategory;
  description: string;
  action: "upload" | "connect" | "manual";
};

const navItems: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "ask", label: "Ask Fynny", icon: "psychology" },
  { id: "processing", label: "Processing Center", icon: "tune" },
  { id: "clients", label: "Clients", icon: "groups" },
  { id: "sources", label: "Data Sources", icon: "database" },
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
  { id: "tally_export", label: "Tally", provider: "Tally", icon: "receipt_long", category: "integration", action: "connect", description: "Connect Tally exports and ledgers for processing, validation, and MIS intelligence." },
  { id: "slack", label: "Slack", provider: "Slack", icon: "tag", category: "integration", action: "connect", description: "Collect approved finance files from client workflow channels." },
  { id: "bank_statement", label: "Bank Statements", provider: "Manual upload", icon: "assured_workload", category: "upload", action: "upload", description: "Process statement files through validation and financial memory." },
  { id: "gst_file", label: "GST Files", provider: "Manual upload", icon: "receipt_long", category: "upload", action: "upload", description: "Validate GST inputs, filing periods, and missing compliance records." },
  { id: "spreadsheet", label: "Spreadsheets", provider: "Excel / CSV", icon: "table_chart", category: "upload", action: "upload", description: "Normalize trackers, reconciliations, ledgers, and exported reports." },
  { id: "whatsapp", label: "WhatsApp Files", provider: "Manual collection", icon: "forum", category: "manual", action: "upload", description: "Use safe upload links or forwarded files. No full WhatsApp access requested." }
];
const askSuggestions = [
  { icon: "warning", title: "Client Risks", prompt: "Identify the top client risks from validated data.", body: "Find attention areas once a client is intelligence ready." },
  { icon: "account_balance_wallet", title: "Cash Flow", prompt: "Explain cash-flow pressure and runway using verified records.", body: "Use receivables, payables, and bank records." },
  { icon: "verified_user", title: "Compliance", prompt: "List compliance gaps and missing filing inputs.", body: "Check GST, TDS, and missing validation blockers." },
  { icon: "trending_up", title: "Advisory", prompt: "Find advisory opportunities from financial memory.", body: "Surface tax, working capital, and risk opportunities." },
  { icon: "table_chart", title: "Export Layout", prompt: "Give me the standard CSV and Excel export layout with formulas for this client.", body: "Return model columns, sheets, and evidence checks." },
  { icon: "dashboard_customize", title: "Portfolio Intelligence", prompt: "Compare this client against readiness, issues, and source coverage.", body: "Summarize what is ready and what still blocks reports.", wide: true }
];

function emptyState<T>(): ApiState<T> {
  return { loading: true, data: null, error: null };
}
async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return (await response.json().catch(() => ({}))) as T;
}
async function readFilePreview(file: File) {
  if (!/\.(csv|txt)$/i.test(file.name) && !["text/csv", "text/plain", "application/vnd.ms-excel"].includes(file.type)) {
    return undefined;
  }
  return file.text().then((text) => text.slice(0, 40_000)).catch(() => undefined);
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

  async function refresh() {
    setStatus((current) => ({ ...current, loading: true, error: null }));
    setSession((current) => ({ ...current, loading: true, error: null }));
    setClients((current) => ({ ...current, loading: true, error: null }));
    setProcessing((current) => ({ ...current, loading: true, error: null }));
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
      return;
    }
    await refreshClient(clientId);
  }

  async function refreshClient(id: string) {
    setReadiness((current) => ({ ...current, loading: true, error: null }));
    setIssues((current) => ({ ...current, loading: true, error: null }));
    setSources((current) => ({ ...current, loading: true, error: null }));
    setReports((current) => ({ ...current, loading: true, error: null }));
    setExports((current) => ({ ...current, loading: true, error: null }));
    const [nextReadiness, nextIssues, nextSources, nextReports, nextExports] = await Promise.all([
      readJson<ReadinessResponse>(`/api/intelligence-ready/${id}`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Readiness unavailable" })),
      readJson<ListResponse<Issue>>(`/api/clients/${id}/validation-issues`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Issues unavailable" })),
      readJson<ListResponse<DataSource>>(`/api/clients/${id}/data-sources`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Data sources unavailable" })),
      readJson<ListResponse<Report>>(`/api/clients/${id}/reports`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Reports unavailable" })),
      readJson<ListResponse<ExportRow>>(`/api/clients/${id}/exports`).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Exports unavailable" }))
    ]);
    setReadiness({ loading: false, data: nextReadiness, error: apiError(nextReadiness, "Readiness unavailable") });
    setIssues({ loading: false, data: nextIssues, error: apiError(nextIssues, "Issues unavailable") });
    setSources({ loading: false, data: nextSources, error: apiError(nextSources, "Data sources unavailable") });
    setReports({ loading: false, data: nextReports, error: apiError(nextReports, "Reports unavailable") });
    setExports({ loading: false, data: nextExports, error: apiError(nextExports, "Exports unavailable") });
  }

  useEffect(() => {
    void refresh();
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
  const refreshing = status.loading || processing.loading || clients.loading || readiness.loading || issues.loading || sources.loading || reports.loading || exports.loading;
  const hasMigrationBlocker = processing.error?.includes("processing_jobs") || readiness.error?.includes("processing_jobs");

  async function submitAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    setMessages((current) => [...current, { role: "user", text: cleanQuestion }]);
    if (!clientId) {
      setMessages((current) => [...current, { role: "fynny", text: clientRows.length ? "Choose a client from the portfolio first. Fynny answers only from that client's verified financial memory." : "Create your first client, connect data sources, and Fynny will answer from that client's financial memory.", blocked: true }]);
      return;
    }
    setAsking(true);
    const payload = await readJson<{ ok?: boolean; data?: { answer?: string; intelligence?: IntelligencePayload; exportModel?: ExportLayout }; error?: string; trainingGuidance?: string[] }>(`/api/clients/${clientId}/ask`, {
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
    setMessages((current) => [...current, { role: "fynny", text: answer ?? "I found intelligence-ready evidence, but no answer text was returned.", intelligence }]);
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
      setChatNotice({ tone: "warning", title: "Client name needed", body: "Add a client name so Fynny can create a dedicated workspace." });
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
      setChatNotice({ tone: "success", title: "Client workspace created", body: `${createdClient.name} is ready for secure data collection and processing.` });
      setMessages((current) => [...current, { role: "fynny", text: `${createdClient.name} has been created. Next, connect tools or upload files so I can build financial memory.`, blocked: true }]);
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
    setSourceNotice({ tone: "warning", title: "Choose a client first", body: "Every connection is attached to one client workspace so files, syncs, and processing stay cleanly separated." });
  }

  async function connectSource(source: SourceOption) {
    if (!clientId) {
      guideToClient();
      return;
    }
    setRequestingSource(source.id);
    setSourceNotice(null);
    try {
      const payload = await readJson<{ ok?: boolean; data?: { dataSource?: DataSource }; error?: string }>(`/api/clients/${clientId}/data-sources/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceType: source.id, provider: source.provider })
      });
      if (payload.ok === false) {
        setSourceNotice({ tone: "error", title: "Connection could not be created", body: payload.error ?? "Please check the source setup and try again." });
      } else {
        setSourceNotice({ tone: "success", title: `${source.label} connected`, body: "Fynny created a read-only connection and can now sync financial records for this client." });
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
      const payload = await readJson<{ ok?: boolean; data?: { id?: string }; error?: string }>(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          type: file.type || "document",
          sourceType,
          documentCategory: sourceType === "bank_statement" ? "bank_statement" : sourceType === "gst_file" ? "gst_data" : "other",
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

  async function attachFileToChat(file: File) {
    if (!clientId) {
      setMessages((current) => [...current, { role: "fynny", text: "Choose a client first, then attach a financial file. I will process it before using it as chat context.", blocked: true }]);
      guideToClient();
      return;
    }
    setMessages((current) => [...current, { role: "user", text: `Attached ${file.name}` }]);
    const uploaded = await uploadDocument(file, "chat_upload");
    setMessages((current) => [
      ...current,
      {
        role: "fynny",
        text: uploaded
          ? `${file.name} is queued. I will use it only after Fynny finishes collection, validation, normalization, memory build, and Intelligence Ready checks.`
          : `I could not queue ${file.name}. Please try another CSV, PDF, spreadsheet, bank statement, GST file, or accounting export.`,
        blocked: !uploaded
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
      const payload = await readJson<{ ok?: boolean; error?: string }>(`/api/clients/${clientId}/data-sources/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataSourceId })
      });
      if (payload.ok === false) {
        setSourceNotice({ tone: "error", title: "Sync could not start", body: payload.error ?? "Please reconnect the source and try again." });
      } else {
        setSourceNotice({ tone: "success", title: "Sync started", body: "Fynny will collect financial records for this client and send them into processing." });
        await refreshClient(clientId);
      }
    } catch (error) {
      setSourceNotice({ tone: "error", title: "Sync failed", body: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSyncingSource(null);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f9f9f9] text-[#1a1c1c]">
      <LiveBanner />
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex h-[calc(100vh-84px)] overflow-hidden md:h-[calc(100vh-32px)]">
        <SideNav activeTab={activeTab} setActiveTab={setActiveTab} authenticated={Boolean(session.data?.authenticated)} />
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
            creatingClient={creatingClient}
            createClient={createClient}
            notice={chatNotice}
            openSources={() => setActiveTab("sources")}
            uploadDocument={attachFileToChat}
            uploadingDocument={uploadingDocument}
            generateExport={generateClientExport}
            exporting={chatExporting}
          />
        ) : (
          <WorkbenchShell title={titleForTab(activeTab)} subtitle={subtitleForTab(activeTab)} clientId={clientId} setClientId={setClientId} selectedClient={selectedClient} clientRows={clientRows} refresh={refresh} refreshing={refreshing}>
            {refreshing ? <AgenticLoading variant="portfolio" compact className="mb-6" /> : null}
            {hasMigrationBlocker ? <SystemNotice title="Workspace setup needed" body="Some processing services are not fully configured yet. Finish setup to activate readiness, reports, and Ask Fynny." /> : null}
            {activeTab === "processing" ? <ProcessingScreen jobs={jobs} error={processing.error} /> : null}
            {activeTab === "clients" ? <ClientsScreen clients={clientRows} error={clients.error} setClientId={setClientId} setActiveTab={setActiveTab} /> : null}
            {activeTab === "sources" ? <SourcesScreen sources={dataSources} error={sources.error} clientId={clientId} selectedClient={selectedClient} connectSource={connectSource} uploadDocument={uploadDocument} syncSource={syncSource} requestingSource={requestingSource} uploadingDocument={uploadingDocument} syncingSource={syncingSource} notice={sourceNotice} setActiveTab={setActiveTab} /> : null}
            {activeTab === "validation" ? <ValidationScreen issues={openIssues} error={issues.error} /> : null}
            {activeTab === "memory" ? <MemoryScreen clientId={clientId} isReady={isReady} readiness={readiness.data} /> : null}
            {activeTab === "reports" ? <ReportsScreen reports={reportRows} error={reports.error} isReady={isReady} /> : null}
            {activeTab === "exports" ? <ExportsScreen exports={exportRows} error={exports.error} isReady={isReady} generateExport={generateClientExport} generating={exports.loading} /> : null}
            {activeTab === "advisory" ? <SimpleScreen icon="auto_graph" title={clientId ? (isReady ? "Advisory engine can discover opportunities." : "Advisory waits for Intelligence Ready.") : "Choose a client"} body="Opportunities are generated from verified records, reconciliation state, and financial memory. Fynny will not fabricate recommendations." /> : null}
            {activeTab === "portal" ? <SimpleScreen icon="approval_delegation" title={clientId ? `${selectedClient?.name ?? "Selected client"} portal context` : "Choose a client"} body="Client visibility, report publishing, and workspace controls are backed by live services." /> : null}
            {activeTab === "settings" ? <SettingsScreen providers={providerRows} status={status.data} session={session.data} /> : null}
          </WorkbenchShell>
        )}
      </div>
    </main>
  );
}

function LiveBanner() {
  return (
    <div className="h-8 border-b border-[#e2e2e2] bg-[#f4f3f3] px-4 text-center">
      <span className="inline-flex h-full items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f5e5e]">
        Live workspace - connect tools, upload files, and generate client intelligence.
      </span>
    </div>
  );
}

function SideNav({ activeTab, setActiveTab, authenticated }: { activeTab: TabId; setActiveTab: (tab: TabId) => void; authenticated: boolean }) {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[#e2e2e2] bg-[#f4f3f3] px-2 py-4 md:flex">
      <div className="mb-6 px-4 py-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#5b0617]">Fynny</h1>
        <p className="mt-1 text-sm text-[#5f5e5e]">Intelligence Platform</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-4 py-[10px] text-left text-[13px] font-semibold uppercase tracking-[0.08em] transition-all active:scale-[0.98] ${active ? "bg-[#e5e2e1] text-[#5b0617]" : "text-[#5f5e5e] hover:bg-[#e8e8e8]"}`}>
              <Icon name={item.icon} className="text-[22px]" filled={active} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-[#e2e2e2] pt-4">
        <button onClick={() => setActiveTab("sources")} className="mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#700018] px-3 text-[12px] font-bold text-white shadow-[0_10px_24px_rgba(112,0,24,0.16)] transition hover:bg-[#5b0617]">
          <Icon name="add_link" className="text-[18px]" />
          Connect Sources
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
    <nav className="flex h-[52px] gap-2 overflow-x-auto border-b border-[#e2e2e2] bg-white px-3 py-2 md:hidden">
      {navItems.map((item) => {
        const active = activeTab === item.id;
        return (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.08em] transition ${active ? "bg-[#111111] text-white" : "bg-[#f4f3f3] text-[#5f5e5e]"}`}>
            <Icon name={item.icon} className="text-[18px]" filled={active} />
            {item.label}
          </button>
        );
      })}
    </nav>
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
  creatingClient: boolean;
  createClient: (input: ClientCreateInput) => Promise<boolean>;
  notice: ActionNotice;
  openSources: () => void;
  uploadDocument: (file: File) => Promise<void>;
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
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void props.uploadDocument(file);
  }

  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-[#ffffff]">
      <ClientRail clients={props.clientRows} clientId={props.clientId} setClientId={props.setClientId} createClient={props.createClient} creatingClient={props.creatingClient} notice={props.notice} />
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
              <section className="flex min-h-[calc(100vh-230px)] flex-col items-center justify-center space-y-7">
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
                    Ask short questions. Attach files or connect sources. Fynny answers only from processed financial context.
                  </p>
                </div>
                {latestFynny ? (
                  <div className="max-w-2xl rounded-2xl border border-[#ececec] bg-[#f9f9f9] p-5 text-center text-sm leading-6 text-[#5f5e5e]">
                    {latestFynny.text}
                  </div>
                ) : null}
                {!props.clientRows.length ? <FirstClientSetup createClient={props.createClient} creatingClient={props.creatingClient} notice={props.notice} /> : null}
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
          <input ref={chatFileInputRef} type="file" className="hidden" accept=".csv,.txt,.pdf,.xlsx,.xls,.json" onChange={handleChatFile} />
          <div className="pointer-events-auto mx-auto flex w-full max-w-[720px] items-center gap-2 rounded-2xl border border-[#e8e0e0] bg-white p-2 shadow-[0_16px_50px_rgba(0,0,0,0.1)]">
            <div className="min-w-0 flex-1 px-3">
              <input value={props.question} onChange={(event) => props.setQuestion(event.target.value)} placeholder="Ask from connected sources or attach a file..." className="w-full border-0 bg-transparent py-3 text-[15px] text-[#1a1c1c] outline-none placeholder:text-[#5f5e5e]/50 focus:ring-0" />
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

function ClientRail({ clients, clientId, setClientId, createClient, creatingClient, notice }: { clients: Client[]; clientId: string; setClientId: (id: string) => void; createClient: (input: ClientCreateInput) => Promise<boolean>; creatingClient: boolean; notice: ActionNotice }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(!clients.length);
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
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#a0a0a0]">Client Portfolio</p>
          <button onClick={() => setShowCreate((value) => !value)} className="rounded-full bg-[#f4f3f3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5b0617] hover:bg-[#eeeeee]">{showCreate ? "Close" : "Add"}</button>
        </div>
        {showCreate ? <CreateClientMiniForm createClient={createClient} creatingClient={creatingClient} notice={notice} onDone={() => setShowCreate(false)} /> : null}
        {filteredClients.length ? filteredClients.map((client) => {
          const active = client.id === clientId;
          return (
            <button key={client.id} onClick={() => setClientId(client.id)} className={`mb-2 w-full rounded-xl border p-4 text-left transition ${active ? "border-[#dcc0c0] bg-[#eeeeee]" : "border-transparent hover:bg-[#f4f3f3]"}`}>
              <p className={`truncate text-[18px] font-semibold ${active ? "text-[#5b0617]" : "text-[#111111]"}`}>{client.name}</p>
              <p className="mt-1 truncate text-[13px] text-[#5f5e5e]">{client.business_type || client.contact_email || "Client workspace"}</p>
            </button>
          );
        }) : <div className="rounded-xl border border-dashed border-[#dcc0c0] bg-[#f9f9f9] p-5 text-sm leading-6 text-[#5f5e5e]">{clients.length ? "No clients match that search." : "No clients connected yet. Add or invite your first client to begin."}</div>}
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
        Create Workspace
      </button>
    </form>
  );
}

function FirstClientSetup({ createClient, creatingClient, notice }: { createClient: (input: ClientCreateInput) => Promise<boolean>; creatingClient: boolean; notice: ActionNotice }) {
  return (
    <div className="w-full max-w-2xl rounded-[28px] border border-[#ececec] bg-white p-5 text-left shadow-[0_18px_60px_rgba(17,17,17,0.06)]">
      <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#700018]">Start here</p>
          <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#111111]">Create your first client workspace.</h3>
          <p className="mt-3 text-sm leading-6 text-[#5f5e5e]">Ask Fynny works client by client. Once a client exists, connect tools or upload files to build financial memory.</p>
        </div>
        <CreateClientMiniForm createClient={createClient} creatingClient={creatingClient} notice={notice} />
      </div>
    </div>
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
            <p className="truncate text-xs text-[#5f5e5e]">{selectedClient?.business_type || selectedClient?.contact_email || (clientId ? "Selected workspace" : "Choose a client to begin")}</p>
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
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#f9f9f9]">
      <header className="sticky top-0 z-40 border-b border-[#e2e2e2] bg-white">
        <div className="mx-auto flex h-[60px] w-full max-w-[1440px] items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-5">
            <h1 className="truncate text-[24px] font-bold tracking-[-0.01em] text-[#5b0617]">{title}</h1>
            <span className="h-5 w-px bg-[#dcc0c0]" />
            <p className="hidden truncate text-[16px] text-[#5f5e5e] md:block">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="workspace-client-select">Choose client</label>
            <select id="workspace-client-select" value={clientId} onChange={(event) => setClientId(event.target.value)} className="hidden h-9 w-72 rounded-full border border-[#dcc0c0] bg-[#f4f3f3] px-4 text-sm outline-none focus:border-[#7a1f2b] lg:block">
              <option value="">{clientRows.length ? "Choose client" : "No clients connected"}</option>
              {clientRows.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            {selectedClient ? <span className="hidden max-w-40 truncate text-xs font-semibold uppercase tracking-[0.12em] text-[#5f5e5e] xl:inline">{selectedClient.name}</span> : null}
            <button onClick={() => void refresh()} className="grid h-9 w-9 place-items-center rounded-full text-[#5f5e5e] hover:bg-[#f4f3f3] hover:text-[#5b0617]">{refreshing ? <AgenticGlyph variant="portfolio" /> : <Icon name="refresh" className="text-[22px]" />}</button>
            <button className="grid h-9 w-9 place-items-center rounded-full text-[#5f5e5e] hover:text-[#5b0617]"><Icon name="notifications" className="text-[24px]" /></button>
            <button className="grid h-9 w-9 place-items-center rounded-full text-[#5f5e5e] hover:text-[#5b0617]"><Icon name="help_outline" className="text-[24px]" /></button>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-[#e2e2e2] bg-[#eeeeee] text-[#5f5e5e]"><Icon name="account_circle" className="text-[24px]" /></div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] space-y-10 p-6">{children}</div>
    </main>
  );
}

function ProcessingScreen({ jobs, error }: { jobs: ProcessingJob[]; error: string | null }) {
  const active = jobs.filter((job) => ["queued", "processing"].includes(job.status)).length;
  const blocked = jobs.filter((job) => ["failed", "blocked", "needs_review"].includes(job.status)).length;
  const ready = jobs.filter((job) => job.intelligence_ready).length;
  return (
    <section className="space-y-16">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <HeroMetric label="Files Collected" value={String(jobs.length)} accent="maroon" progress={jobs.length ? 75 : 0} />
        <HeroMetric label="Processing" value={String(active)} detail={active ? "Active" : "Idle" } accent="gray" progress={active ? 40 : 0} />
        <HeroMetric label="Needs Review" value={String(blocked)} detail={blocked ? "Blocked" : "Clear"} accent="red" progress={blocked ? 24 : 0} urgent={blocked > 0} />
        <HeroMetric label="Clients Blocked" value={String(blocked ? 1 : 0).padStart(2, "0")} detail="Manual intervention" accent="maroon" progress={blocked ? 18 : 0} />
        <HeroMetric label="Reports Ready" value={String(ready)} detail="Finalized" accent="maroon" progress={ready ? 88 : 0} />
      </div>
      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><h2 className="text-[26px] font-semibold tracking-[-0.01em] text-[#5b0617]">Pipeline Health</h2><p className="mt-1 text-[16px] text-[#5f5e5e]">Visual representation of data flow and throughput bottlenecks.</p></div>
          <button className="hidden rounded-lg bg-[#7a1f2b] px-8 py-3 text-[16px] font-bold text-white md:inline-flex"><Icon name="warning" className="mr-2 text-[22px]" /> Review Blocked Files</button>
        </div>
        <PipelineHealth jobs={jobs} />
      </section>
      <section>
        <div className="mb-7 flex items-center justify-between gap-4">
          <h2 className="text-[26px] font-semibold tracking-[-0.01em] text-[#5b0617]">Recent Pipeline Activity</h2>
          <div className="hidden items-center gap-3 md:flex"><div className="flex h-12 w-80 items-center rounded-lg border border-[#dcc0c0] bg-white px-4 text-[#5f5e5e]"><Icon name="search" className="mr-3 text-[22px]" /> Search files or clients...</div><button className="h-12 rounded-lg border border-[#dcc0c0] bg-white px-5 text-[#1a1c1c]"><Icon name="filter_list" className="mr-2 text-[20px]" /> Filter</button></div>
        </div>
        <DataTable headers={["Client", "Source", "File Name", "Type", "Month", "Stage", "Issue", "Action"]} empty={error ?? "No processing jobs found. Upload client documents to begin the pipeline."} rows={jobs.map((job) => [shortId(job.client_id), titleCase(job.source_type), shortId(job.document_id), "Financial Document", formatDate(job.created_at), titleCase(job.current_stage), job.status === "failed" ? "Needs review" : "-", job.intelligence_ready ? "View" : "Wait"])} />
      </section>
    </section>
  );
}

function HeroMetric({ label, value, detail, accent, progress, urgent }: { label: string; value: string; detail?: string; accent: "maroon" | "gray" | "red"; progress: number; urgent?: boolean }) {
  const color = accent === "red" ? "#ba1a1a" : accent === "gray" ? "#5f5e5e" : "#700018";
  return (
    <div className={`relative overflow-hidden rounded border bg-white p-5 shadow-sm ${accent === "red" ? "border-[#ba1a1a]" : "border-[#ececec]"}`}>
      {urgent ? <div className="absolute right-0 top-0 bg-[#ba1a1a] px-3 py-1 text-[10px] font-bold text-white">URGENT</div> : null}
      <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]" style={{ color: accent === "red" ? color : undefined }}>{label}</p>
      <div className="flex items-end justify-between gap-3"><span className="font-[var(--font-platform-mono)] text-[34px] font-semibold tracking-[-0.04em]" style={{ color }}>{value}</span><span className="pb-2 text-[13px] font-semibold text-[#5f5e5e]">{detail ?? "+ live"}</span></div>
      <div className="mt-6 h-1 overflow-hidden rounded-full bg-[#eeeeee]"><div className="h-full" style={{ width: `${progress}%`, backgroundColor: color }} /></div>
    </div>
  );
}

function PipelineHealth({ jobs }: { jobs: ProcessingJob[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e2e2e2] bg-[#f4f3f3] p-8">
      <div className="relative flex min-w-[1040px] items-start justify-between">
        <div className="absolute left-8 right-8 top-8 h-px bg-[#dcc0c0]" />
        {processingStages.map((stage) => {
          const count = jobs.filter((job) => job.current_stage === stage).length;
          const complete = stage === "intelligence_ready" ? jobs.filter((job) => job.intelligence_ready).length : count;
          return (
            <div key={stage} className="relative z-10 flex w-36 flex-col items-center gap-3 text-center">
              <div className={`grid h-16 w-16 place-items-center rounded-full border-2 bg-white ${count ? "border-[#ba1a1a] text-[#ba1a1a]" : "border-[#700018] text-[#700018]"}`}><Icon name={iconForStage(stage)} className="text-[28px]" /></div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">{titleCase(stage)}</p>
              <p className="font-[var(--font-platform-mono)] text-[18px] text-[#700018]">{complete || "-"} {stage === "intelligence_ready" ? "Ready" : "units"}</p>
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
  const visibleSources = sourceOptions.filter((source) => activeCategory === "all" || source.category === activeCategory);
  const busy = props.uploadingDocument || props.requestingSource === selectedSource.id;
  const sourceCounts = {
    connected: props.sources.length,
    integrations: sourceOptions.filter((source) => source.category === "integration").length,
    uploads: sourceOptions.filter((source) => source.category === "upload").length
  };

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void props.uploadDocument(file, selectedSource.id === "manual_upload" ? "manual_upload" : selectedSource.id);
  }

  function runPrimaryAction(source = selectedSource) {
    setSelectedSource(source);
    if (source.action === "upload") {
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
      <input ref={fileInputRef} onChange={handleFileChange} className="hidden" type="file" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.txt" />
      <div className="overflow-hidden rounded-[32px] border border-[#ececec] bg-[#111111] text-white shadow-[0_24px_80px_rgba(17,17,17,0.12)]">
        <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="flex min-h-[320px] flex-col justify-between gap-8">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#cfa0a6]">Data command center</p>
              <h2 className="mt-4 max-w-xl text-[38px] font-semibold tracking-[-0.04em] text-white md:text-[54px]">Connect the client stack in minutes.</h2>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/68">Pick a client, connect Gmail, Drive, Zoho, or upload files. Fynny keeps access read-only and routes every record into processing automatically.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Connected" value={String(sourceCounts.connected)} tone="maroon" detail="Live sources" />
              <MiniMetric label="Integrations" value={String(sourceCounts.integrations)} tone="dark" detail="Ready to connect" />
              <MiniMetric label="Uploads" value={String(sourceCounts.uploads)} tone="dark" detail="CSV, PDF, XLSX" />
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white p-5 text-[#111111] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 border-b border-[#eeeeee] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f6eeee] text-[#700018]">
                  <Icon name="business_center" className="text-[24px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#777]">Active workspace</p>
                  <p className="truncate text-[19px] font-semibold">{props.selectedClient?.name ?? "No client selected"}</p>
                  <p className="mt-1 text-sm text-[#666]">{props.selectedClient?.business_type || props.selectedClient?.contact_email || "Choose a client before connecting tools."}</p>
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
            {selectedSource.category === "upload" ? (
              <div className="mt-4 rounded-2xl border border-[#eadada] bg-white/70 p-3">
                <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f5e5e]">Sample data for testing</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <a href="/samples/fynny-aster-foods-correlated-test-pack.zip" download className="rounded-full bg-[#700018] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#5b0617]">Aster Foods Pack</a>
                  <a href="/samples/aster-foods/test_scenarios.md" target="_blank" rel="noreferrer" className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Scenario Guide</a>
                  <a href="/samples/fynny-sample-bank-statement.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Bank CSV</a>
                  <a href="/samples/fynny-sample-sales-register.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">Sales CSV</a>
                  <a href="/samples/fynny-sample-gst-summary.csv" download className="rounded-full border border-[#dcc0c0] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b0617] transition hover:border-[#5b0617]">GST CSV</a>
                </div>
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
              <button key={source.id} onClick={() => setSelectedSource(source)} className={`group rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#7a1f2b] hover:shadow-[0_18px_40px_rgba(17,17,17,0.06)] ${active ? "border-[#7a1f2b] shadow-[0_18px_40px_rgba(17,17,17,0.06)]" : "border-[#e2e2e2]"}`}>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl ring-1 ${sourceLogoTileClass(source.id, active)}`}>{loading ? <AgenticGlyph variant="validation" /> : <SourceLogo source={source.id} className="h-8 w-8" />}</div>
                  <span className="rounded-full bg-[#f4f3f3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5f5e5e]">{source.action === "connect" ? "direct" : source.category}</span>
                </div>
                <p className="text-[17px] font-semibold text-[#111111]">{source.label}</p>
                <p className="mt-2 text-[13px] leading-6 text-[#5f5e5e]">{source.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#700018]">
                  {source.action === "connect" ? "Connect" : "Select"} <Icon name="arrow_forward" className="text-[16px]" />
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
        ) : <EmptyState icon="hub" title="No connected sources yet" body={props.error ?? "Choose a client, connect an integration, or upload financial files to begin."} />}
      </Card>
    </section>
  );
}

function ClientsScreen({ clients, error, setClientId, setActiveTab }: { clients: Client[]; error: string | null; setClientId: (id: string) => void; setActiveTab: (tab: TabId) => void }) {
  return <Card title="Client Workspace"><DataTable headers={["Client", "Business Type", "Contact", "Created", "Action"]} empty={error ?? "No clients connected yet. Add your first client to begin processing."} rows={clients.map((client) => [client.name, client.business_type ?? "-", client.contact_email ?? "-", formatDate(client.created_at), "Open"])} onRowClick={(index) => { const client = clients[index]; if (client) { setClientId(client.id); setActiveTab("ask"); } }} /></Card>;
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
  return <div className="rounded-xl border border-[#e2e2e2] bg-white p-5"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f5e5e]">{label}</p><p className="font-[var(--font-platform-mono)] text-[22px] font-semibold" style={{ color }}>{value}</p><p className="mt-2 text-[13px] text-[#5f5e5e]">{detail}</p></div>;
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
  return <section className="rounded-xl border border-[#ececec] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]"><div className="border-b border-[#e2e2e2] px-6 py-4"><h3 className="text-[20px] font-semibold tracking-[-0.01em] text-[#5b0617]">{title}</h3></div><div className="p-6">{children}</div></section>;
}
function DataTable({ headers, rows, empty, onRowClick }: { headers: string[]; rows: string[][]; empty: string; onRowClick?: (index: number) => void }) {
  if (!rows.length) return <EmptyState icon="upload_file" title="No Data Connected" body={empty} />;
  return <div className="overflow-x-auto rounded-xl border border-[#e2e2e2] bg-white"><table className="w-full min-w-[780px] border-collapse text-left"><thead className="bg-[#f8f8f8]"><tr>{headers.map((header) => <th key={header} className="px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#f8f8f8]">{rows.map((row, rowIndex) => <tr key={rowIndex} onClick={() => onRowClick?.(rowIndex)} className={onRowClick ? "cursor-pointer hover:bg-[#f8f8f8]" : "hover:bg-[#f8f8f8]"}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className={`px-5 py-5 text-[15px] text-[#1a1c1c] ${cellIndex === 2 ? "font-[var(--font-platform-mono)] text-[#700018]" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#dcc0c0] bg-[#f9f9f9] p-8 text-center"><div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#700018]"><Icon name={icon} className="text-[26px]" /></div><h4 className="mt-5 text-[20px] font-semibold text-[#111111]">{title}</h4><p className="mt-2 max-w-xl text-[15px] leading-7 text-[#5f5e5e]">{body}</p></div>;
}
function FieldBox({ label, value }: { label: string; value: string }) {
  return <div><p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5f5e5e]">{label}</p><div className="rounded border border-[#dcc0c0] bg-[#f4f3f3] p-4 text-sm text-[#1a1c1c]">{value}</div></div>;
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
  return icon === "auto_graph" ? "Advisory Workspace" : "Client Portal";
}
