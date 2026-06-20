"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
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
type AskMessage = { role: "user" | "fynny"; text: string; blocked?: boolean };
type TabId = "ask" | "processing" | "clients" | "sources" | "validation" | "memory" | "reports" | "exports" | "advisory" | "portal" | "settings";

const navItems: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "ask", label: "Ask Fynny", icon: "psychology" },
  { id: "processing", label: "Processing Center", icon: "tune" },
  { id: "clients", label: "Clients", icon: "groups" },
  { id: "sources", label: "Data Sources", icon: "database" },
  { id: "reports", label: "Reports", icon: "assessment" },
  { id: "exports", label: "Exports", icon: "file_download" },
  { id: "memory", label: "Financial Memory", icon: "memory" },
  { id: "advisory", label: "Advisory", icon: "auto_graph" },
  { id: "portal", label: "Client Portal", icon: "vpn_key" },
  { id: "settings", label: "Settings", icon: "settings" }
];
const processingStages = ["collection", "classification", "extraction", "validation", "normalization", "memory_build", "intelligence_ready"];
const sourceTypes = ["gmail", "google_drive", "zoho_books", "bank_statement", "gst_file", "spreadsheet", "pdf", "whatsapp"];

function emptyState<T>(): ApiState<T> {
  return { loading: true, data: null, error: null };
}
async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return (await response.json().catch(() => ({}))) as T;
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
      setMessages((current) => [...current, { role: "fynny", text: "Select or paste a client UUID first. I will not answer from global or guessed data.", blocked: true }]);
      return;
    }
    setAsking(true);
    const payload = await readJson<{ ok?: boolean; data?: { answer?: string }; error?: string }>(`/api/clients/${clientId}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: cleanQuestion })
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "Ask Fynny is unavailable." }));
    setAsking(false);
    if (payload.ok === false) {
      setMessages((current) => [...current, { role: "fynny", text: payload.error ?? "Ask Fynny is blocked until processing is complete.", blocked: true }]);
      return;
    }
    const answer = "data" in payload ? payload.data?.answer : undefined;
    setMessages((current) => [...current, { role: "fynny", text: answer ?? "I found intelligence-ready evidence, but no answer text was returned." }]);
  }

  async function requestConsent(sourceType: string) {
    if (!clientId) return;
    setRequestingSource(sourceType);
    try {
      await readJson(`/api/clients/${clientId}/consent/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceType, accessScope: "read_only" })
      });
      await refreshClient(clientId);
    } finally {
      setRequestingSource(null);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f9f9f9] text-[#1a1c1c]">
      <LiveBanner />
      <div className="flex h-[calc(100vh-32px)] overflow-hidden">
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
          />
        ) : (
          <WorkbenchShell title={titleForTab(activeTab)} subtitle={subtitleForTab(activeTab)} clientId={clientId} setClientId={setClientId} refresh={refresh} refreshing={refreshing}>
            {refreshing ? <AgenticLoading variant="portfolio" compact className="mb-6" /> : null}
            {hasMigrationBlocker ? <SystemNotice title="Supabase migration required" body="Production Supabase is missing Processing Layer tables. Run supabase/schema.sql to activate processing, readiness, reports, and Ask Fynny." /> : null}
            {activeTab === "processing" ? <ProcessingScreen jobs={jobs} error={processing.error} /> : null}
            {activeTab === "clients" ? <ClientsScreen clients={clientRows} error={clients.error} setClientId={setClientId} setActiveTab={setActiveTab} /> : null}
            {activeTab === "sources" ? <SourcesScreen sources={dataSources} error={sources.error} clientId={clientId} requestConsent={requestConsent} requestingSource={requestingSource} /> : null}
            {activeTab === "validation" ? <ValidationScreen issues={openIssues} error={issues.error} /> : null}
            {activeTab === "memory" ? <MemoryScreen clientId={clientId} isReady={isReady} readiness={readiness.data} /> : null}
            {activeTab === "reports" ? <ReportsScreen reports={reportRows} error={reports.error} isReady={isReady} /> : null}
            {activeTab === "exports" ? <ExportsScreen exports={exportRows} error={exports.error} isReady={isReady} /> : null}
            {activeTab === "advisory" ? <SimpleScreen icon="auto_graph" title={clientId ? (isReady ? "Advisory engine can discover opportunities." : "Advisory waits for Intelligence Ready.") : "Select a client"} body="Opportunities are generated from verified records, reconciliation state, and financial memory. Fynny will not fabricate recommendations." /> : null}
            {activeTab === "portal" ? <SimpleScreen icon="vpn_key" title={clientId ? `${selectedClient?.name ?? "Selected client"} portal context` : "Select a client"} body="Client visibility, consent approvals, report publishing, and revocation flows are backed by the live client APIs." /> : null}
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
        Live environment - no mock financial data is rendered. Connect practice data to see insights.
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
        <a href="/api/auth/scalekit" className="mb-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#700018] px-3 text-[12px] font-bold text-white">
          <Icon name="cloud_sync" className="text-[18px]" />
          Connect Practice Data
        </a>
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
}) {
  return (
    <main className="flex min-w-0 flex-1 overflow-hidden bg-white">
      <ClientRail clients={props.clientRows} clientId={props.clientId} setClientId={props.setClientId} />
      <section className="relative flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e2e2e2] px-8">
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${props.isReady ? "bg-[#00875a]" : "bg-[#ba1a1a]"}`} />
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5f5e5e]">{props.isReady ? "Fynny IQ: Ready" : "Fynny IQ: Readiness Required"}</span>
          </div>
          <div className="rounded-full bg-[#eeeeee] px-6 py-3 text-[13px] font-medium text-[#5b0617]">Rules calculate. Fynny explains.</div>
        </header>
        <div className="flex-1 overflow-y-auto px-8 pb-36 pt-12">
          <div className="mx-auto max-w-4xl space-y-10">
            {props.messages.map((message, index) =>
              message.role === "user" ? (
                <div key={`${message.role}-${index}`} className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-tr-none border border-[#dcc0c0] bg-[#f4f3f3] p-5 text-[20px] leading-8 text-[#1a1c1c]">{message.text}</div>
                </div>
              ) : (
                <div key={`${message.role}-${index}`} className="flex gap-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#700018] text-white"><Icon name="psychology" className="text-[20px]" filled /></div>
                  <div className="flex-1 space-y-5">
                    <div>
                      <h3 className="text-[26px] font-semibold tracking-[-0.01em] text-[#111111]">{message.blocked ? "Processing Gate Active" : "Ask Fynny Intelligence Console"}</h3>
                      <p className="mt-3 max-w-2xl text-[18px] leading-8 text-[#5f5e5e]">{message.text}</p>
                    </div>
                    <InsightGrid readinessScore={props.readinessScore} issueCount={props.openIssues.length} sourceCount={props.dataSources.length} />
                    <VerifiedSources sources={props.dataSources} />
                  </div>
                </div>
              )
            )}
            {props.asking ? <AgenticLoading variant="thinking" /> : null}
          </div>
        </div>
        <form onSubmit={props.submitAsk} className="absolute bottom-10 left-8 right-8 mx-auto max-w-4xl">
          <div className="flex h-[76px] items-center gap-4 rounded-2xl border border-[#e2e2e2] bg-white px-7 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            <button type="button" className="text-[#5f5e5e]"><Icon name="attach_file" className="text-[24px]" /></button>
            <input value={props.question} onChange={(event) => props.setQuestion(event.target.value)} placeholder="Command Fynny... (e.g., Compare Q1 sales)" className="min-w-0 flex-1 border-0 bg-transparent text-[18px] text-[#1a1c1c] outline-none placeholder:text-[#9a9a9a] focus:ring-0" />
            <button type="submit" disabled={props.asking} className="grid h-12 w-12 place-items-center rounded-xl bg-[#700018] text-white disabled:opacity-60">{props.asking ? <AgenticGlyph variant="thinking" /> : <Icon name="arrow_upward" className="text-[26px]" />}</button>
          </div>
          <div className="mt-5 flex justify-center gap-12 text-[13px] text-[#5f5e5e]">
            <span><Icon name="rocket_launch" className="text-[16px]" /> Project Runway</span>
            <span><Icon name="receipt_long" className="text-[16px]" /> Tax Optimization</span>
            <span><Icon name="warning" className="text-[16px]" /> Alert Detection</span>
          </div>
        </form>
      </section>
      <ClientContextRail selectedClient={props.selectedClient} clientId={props.clientId} readinessScore={props.readinessScore} sources={props.dataSources} issues={props.openIssues} />
    </main>
  );
}

function ClientRail({ clients, clientId, setClientId }: { clients: Client[]; clientId: string; setClientId: (id: string) => void }) {
  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-[#e2e2e2] bg-white lg:flex">
      <div className="border-b border-[#e2e2e2] p-5">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f5e5e]"><Icon name="search" className="text-[20px]" /></span>
          <input value={clientId} onChange={(event) => setClientId(event.target.value.trim())} placeholder="Search clients..." className="h-12 w-full rounded-xl border-0 bg-[#f4f3f3] pl-12 pr-4 text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#667085] focus:ring-1 focus:ring-[#7a1f2b]" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-2 py-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[#a0a0a0]">Recent Insights</p>
        {clients.length ? clients.map((client) => {
          const active = client.id === clientId;
          return (
            <button key={client.id} onClick={() => setClientId(client.id)} className={`mb-2 w-full rounded-xl border p-4 text-left transition ${active ? "border-[#dcc0c0] bg-[#eeeeee]" : "border-transparent hover:bg-[#f4f3f3]"}`}>
              <p className={`truncate text-[18px] font-semibold ${active ? "text-[#5b0617]" : "text-[#111111]"}`}>{client.name}</p>
              <p className="mt-1 truncate text-[13px] text-[#5f5e5e]">{client.business_type || client.contact_email || shortId(client.id)}</p>
            </button>
          );
        }) : <div className="rounded-xl border border-dashed border-[#dcc0c0] bg-[#f9f9f9] p-5 text-sm leading-6 text-[#5f5e5e]">No clients found. Create a client through the API or paste a client UUID above.</div>}
      </div>
    </aside>
  );
}

function ClientContextRail({ selectedClient, clientId, readinessScore, sources, issues }: { selectedClient?: Client; clientId: string; readinessScore: number; sources: DataSource[]; issues: Issue[] }) {
  return (
    <aside className="hidden h-full w-[312px] shrink-0 flex-col border-l border-[#e2e2e2] bg-[#f9f9f9] xl:flex">
      <div className="border-b border-[#e2e2e2] bg-white p-8">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[#111111] text-xl font-bold text-white shadow-[inset_0_0_30px_rgba(255,255,255,0.7)]">{initials(selectedClient?.name)}</div>
        <h2 className="mt-6 text-[22px] font-medium text-[#111111]">{selectedClient?.name || (clientId ? "Selected Client" : "No Client Selected")}</h2>
        <p className="mt-1 text-[18px] leading-7 text-[#5f5e5e]">{selectedClient?.business_type || selectedClient?.contact_email || "Paste or select a client UUID."}</p>
      </div>
      <div className="space-y-8 p-8">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Data Readiness</p>
            <p className="text-[20px] font-bold text-[#700018]">{readinessScore}%</p>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e2e2e2]"><div className="h-full bg-[#700018]" style={{ width: `${Math.min(100, readinessScore)}%` }} /></div>
        </div>
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f5e5e]">Connected Sources</p>
          <div className="space-y-3">{sources.length ? sources.slice(0, 3).map((source) => <SourceLine key={source.id} source={source} />) : <p className="text-sm text-[#5f5e5e]">No approved sources connected.</p>}</div>
        </div>
        <div className="border-t border-[#e2e2e2] pt-6">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ba1a1a]">Missing Data</p>
          {issues.length ? issues.slice(0, 2).map((issue) => (
            <div key={issue.id} className="mb-3 rounded-xl border border-[#efb8b8] bg-[#fff7f7] p-5">
              <p className="flex items-center gap-2 text-[16px] font-bold text-[#111111]"><Icon name="error" className="text-[18px] text-[#ba1a1a]" /> {titleCase(issue.category)}</p>
              <p className="mt-2 text-[13px] leading-5 text-[#5f5e5e]">{issue.message}</p>
              <p className="mt-4 text-[12px] font-medium underline text-[#700018]">Request from Client</p>
            </div>
          )) : <div className="rounded-xl border border-[#e2e2e2] bg-white p-5 text-sm text-[#5f5e5e]">No open missing-data issues.</div>}
        </div>
      </div>
    </aside>
  );
}

function WorkbenchShell({ title, subtitle, clientId, setClientId, refresh, refreshing, children }: { title: string; subtitle: string; clientId: string; setClientId: (id: string) => void; refresh: () => Promise<void>; refreshing: boolean; children: ReactNode }) {
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
            <input value={clientId} onChange={(event) => setClientId(event.target.value.trim())} placeholder="Client UUID" className="hidden h-9 w-72 rounded-full border border-[#dcc0c0] bg-[#f4f3f3] px-4 text-sm outline-none focus:border-[#7a1f2b] lg:block" />
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
        <DataTable headers={["Client", "Source", "File Name", "Type", "Month", "Stage", "Issue", "Action"]} empty={error ?? "No processing jobs found. Upload approved client documents to begin the pipeline."} rows={jobs.map((job) => [shortId(job.client_id), titleCase(job.source_type), shortId(job.document_id), "Financial Document", formatDate(job.created_at), titleCase(job.current_stage), job.status === "failed" ? "Needs review" : "-", job.intelligence_ready ? "View" : "Wait"])} />
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

function SourcesScreen(props: { sources: DataSource[]; error: string | null; clientId: string; requestConsent: (sourceType: string) => Promise<void>; requestingSource: string | null }) {
  return (
    <section className="space-y-10">
      <div className="flex gap-8 overflow-x-auto border-b border-[#e2e2e2]">{["Upload", "Email", "WhatsApp Collection", "Google Drive", "Tally Export", "Zoho Export", "Bank Statement", "GST Data"].map((tab, index) => <button key={tab} className={`whitespace-nowrap px-1 pb-4 text-[12px] font-semibold uppercase tracking-[0.12em] ${index === 0 ? "border-b-2 border-[#7a1f2b] text-[#5b0617]" : "text-[#5f5e5e]"}`}>{tab}</button>)}</div>
      {props.requestingSource ? <AgenticLoading variant="validation" compact /> : null}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6 lg:col-span-4">
          <Card title="Upload Configuration">
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5f5e5e]">Client Selection</label>
            <div className="mb-6 rounded border border-[#dcc0c0] bg-[#f4f3f3] p-4 text-sm text-[#5f5e5e]">{props.clientId || "Select client UUID from top bar"}</div>
            <div className="grid grid-cols-2 gap-4"><FieldBox label="Fiscal Period" value="Current Period" /><FieldBox label="Data Type" value="Financial Docs" /></div>
            <button disabled={!props.clientId} className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-[#7a1f2b] py-4 text-[16px] font-semibold text-white disabled:opacity-50"><Icon name="upload_file" className="text-[22px]" /> Secure Upload</button>
          </Card>
          <Card title="Consent Copy"><p className="text-[15px] leading-7 text-[#564242]">Fynny only collects financial documents you approve. Access is read-only and can be revoked anytime.</p></Card>
        </div>
        <div className="col-span-12 lg:col-span-8">
          <Card title="Consent-Based Collection Sources">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{sourceTypes.map((source) => <button key={source} disabled={!props.clientId} onClick={() => void props.requestConsent(source)} className="rounded-xl border border-[#e2e2e2] bg-white p-5 text-left transition hover:border-[#7a1f2b] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] disabled:opacity-50"><div className="mb-5 grid h-11 w-11 place-items-center rounded-lg bg-[#f4f3f3] text-[#700018]">{props.requestingSource === source ? <AgenticGlyph variant="validation" /> : <Icon name={iconForSource(source)} className="text-[24px]" />}</div><p className="text-[16px] font-semibold text-[#1a1c1c]">{titleCase(source)}</p><p className="mt-2 text-[13px] leading-5 text-[#5f5e5e]">Read-only, consent-based collection.</p></button>)}</div>
          </Card>
        </div>
      </div>
      <Card title="Connected Data Sources"><DataTable headers={["Source", "Provider", "Connection", "Consent", "Last Sync"]} empty={props.error ?? "No data sources connected for this client."} rows={props.sources.map((source) => [titleCase(source.source_type), source.provider, titleCase(source.connection_status), titleCase(source.consent_status ?? "requested"), formatDate(source.last_sync_at)])} /></Card>
    </section>
  );
}

function ClientsScreen({ clients, error, setClientId, setActiveTab }: { clients: Client[]; error: string | null; setClientId: (id: string) => void; setActiveTab: (tab: TabId) => void }) {
  return <Card title="Client Workspace"><DataTable headers={["Client", "Business Type", "Contact", "Created", "Action"]} empty={error ?? "No clients found. Create a client through /api/clients to populate this workspace."} rows={clients.map((client) => [client.name, client.business_type ?? "-", client.contact_email ?? "-", formatDate(client.created_at), "Open"])} onRowClick={(index) => { const client = clients[index]; if (client) { setClientId(client.id); setActiveTab("ask"); } }} /></Card>;
}
function ValidationScreen({ issues, error }: { issues: Issue[]; error: string | null }) {
  return <Card title="Validation Center"><DataTable headers={["Severity", "Category", "Issue", "Status", "Suggested Fix"]} empty={error ?? "No open validation issues for this client."} rows={issues.map((issue) => [titleCase(issue.severity), titleCase(issue.category), issue.message, titleCase(issue.status), issue.suggested_fix ?? "Review source document"])} /></Card>;
}
function MemoryScreen({ clientId, isReady, readiness }: { clientId: string; isReady: boolean; readiness: ReadinessResponse | null }) {
  return <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Card title="Financial Memory Graph"><EmptyState icon="memory" title={clientId ? (isReady ? "Memory API is ready to load client events." : "Memory builds after validation and normalization.") : "Select a client"} body="Financial memory contains events, entities, and relationships generated from approved client data only." /></Card><Card title="Readiness Factors"><div className="space-y-4">{Object.entries(readiness?.data?.factors ?? {}).map(([name, score]) => <FactorBar key={name} label={titleCase(name)} value={score} />)}{!readiness?.data ? <p className="text-sm text-[#5f5e5e]">No client readiness loaded.</p> : null}</div></Card></section>;
}
function ReportsScreen({ reports, error, isReady }: { reports: Report[]; error: string | null; isReady: boolean }) {
  return <Card title="Reports"><DataTable headers={["Report", "Status", "Published", "Created"]} empty={error ?? (isReady ? "No reports generated yet." : "Reports are blocked until Intelligence Ready is true.")} rows={reports.map((report) => [titleCase(report.report_type), titleCase(report.status), report.published_to_client ? "Yes" : "No", formatDate(report.created_at)])} /></Card>;
}
function ExportsScreen({ exports, error, isReady }: { exports: ExportRow[]; error: string | null; isReady: boolean }) {
  return <Card title="Exports"><DataTable headers={["Export", "Format", "File", "Created"]} empty={error ?? (isReady ? "No exports generated yet." : "Exports are blocked until Intelligence Ready is true.")} rows={exports.map((row) => [titleCase(row.export_type), row.file_format.toUpperCase(), row.storage_url ? "Available" : "Pending", formatDate(row.created_at)])} /></Card>;
}
function SimpleScreen({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <Card title={titleForIcon(icon)}><EmptyState icon={icon} title={title} body={body} /></Card>;
}

function InsightGrid({ readinessScore, issueCount, sourceCount }: { readinessScore: number; issueCount: number; sourceCount: number }) {
  return <div className="grid gap-4 md:grid-cols-3"><MiniMetric label="Readiness" value={`${readinessScore}%`} tone="maroon" detail="Live score" /><MiniMetric label="Open Issues" value={String(issueCount)} tone={issueCount ? "red" : "dark"} detail={issueCount ? "Needs review" : "Clear"} /><MiniMetric label="Sources" value={String(sourceCount)} tone="dark" detail="Approved" /></div>;
}
function MiniMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "maroon" | "red" | "dark" }) {
  const color = tone === "red" ? "#ba1a1a" : tone === "maroon" ? "#700018" : "#111111";
  return <div className="rounded-xl border border-[#e2e2e2] bg-white p-5"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f5e5e]">{label}</p><p className="font-[var(--font-platform-mono)] text-[22px] font-semibold" style={{ color }}>{value}</p><p className="mt-2 text-[13px] text-[#5f5e5e]">{detail}</p></div>;
}
function VerifiedSources({ sources }: { sources: DataSource[] }) {
  return <div className="rounded-2xl border border-[#e2e2e2] bg-white p-6"><div className="mb-5 flex items-center justify-between"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5f5e5e]">Verified Sources</p><div className="flex gap-6 text-[#5f5e5e]"><Icon name="picture_as_pdf" /><Icon name="table_chart" /><Icon name="content_copy" /></div></div><div className="space-y-3">{sources.length ? sources.slice(0, 3).map((source) => <SourceCard key={source.id} source={source} />) : <p className="rounded-lg border border-[#e2e2e2] p-4 text-sm text-[#5f5e5e]">No verified sources yet. Connect approved, read-only data sources first.</p>}</div></div>;
}
function SourceCard({ source }: { source: DataSource }) {
  return <div className="flex items-center justify-between rounded-lg border border-[#e2e2e2] bg-white px-4 py-3"><div className="flex items-center gap-4"><span className="text-[#700018]"><Icon name={iconForSource(source.source_type)} className="text-[22px]" /></span><span className="text-[16px] text-[#111111]">{titleCase(source.source_type)}</span></div><span className="font-[var(--font-platform-mono)] text-[13px] text-[#5f5e5e]">{titleCase(source.connection_status)}</span></div>;
}
function SourceLine({ source }: { source: DataSource }) {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg border border-[#e2e2e2] bg-white text-[#700018]"><Icon name={iconForSource(source.source_type)} className="text-[20px]" /></div><span className="flex-1 text-[16px] text-[#111111]">{titleCase(source.source_type)}</span><span className="h-2 w-2 rounded-full bg-[#00875a]" /></div>;
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
    sources: "Consent-based, read-only data collection",
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
