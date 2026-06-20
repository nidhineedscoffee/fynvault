"use client";

import { useEffect, useMemo, useState } from "react";
import { FinvaultConsole } from "@/components/finvault-console";
import { AgenticLoading } from "@/components/agentic-loading";

type SessionResponse = {
  authenticated: boolean;
  user?: { email?: string; name?: string };
};

type OnboardingStep = "firm" | "volume" | "sources" | "bottleneck" | "connect" | "creating" | "ready";

type Choice = {
  label: string;
  description: string;
  icon: string;
};

const steps: OnboardingStep[] = ["firm", "volume", "sources", "bottleneck", "connect", "creating", "ready"];
const storageKey = "fynny:onboarding-complete";

const firmTypes: Choice[] = [
  { label: "CA Firm", description: "Chartered Accountancy practice.", icon: "domain" },
  { label: "Accounting Firm", description: "General accounting services.", icon: "account_balance" },
  { label: "Bookkeeping Firm", description: "Daily financial record management.", icon: "library_books" },
  { label: "Virtual CFO Firm", description: "Strategic financial advisory.", icon: "insights" },
  { label: "Tax Advisory Firm", description: "Specialized tax planning and compliance.", icon: "request_quote" },
  { label: "Other", description: "Different firm structure or focus.", icon: "more_horiz" }
];

const clientVolumes: Choice[] = [
  { label: "1-25", description: "Boutique and focused.", icon: "person" },
  { label: "26-100", description: "Growing practice.", icon: "group" },
  { label: "101-250", description: "Established firm.", icon: "groups" },
  { label: "250+", description: "Multi-team operation.", icon: "apartment" }
];

const workflowSources = ["Email", "WhatsApp", "Excel", "Tally", "Zoho Books", "GST Files", "Bank Statements", "Google Drive", "Other"];

const bottlenecks: Choice[] = [
  { label: "Collecting Documents", description: "Gathering files, chasing signatures, and organizing uploads.", icon: "folder_open" },
  { label: "Following Up With Clients", description: "Sending reminders and managing communications.", icon: "quick_reference_all" },
  { label: "Preparing Reports", description: "Formatting data and finalizing client-ready outputs.", icon: "bar_chart" },
  { label: "Validating Data", description: "Checking accuracy and correcting source issues.", icon: "fact_check" },
  { label: "Reconciling Information", description: "Matching records across systems.", icon: "compare_arrows" },
  { label: "Finding Insights", description: "Extracting advisory opportunities from clean data.", icon: "lightbulb" }
];

const dataStarts: Choice[] = [
  { label: "Upload Files", description: "Drag and drop PDFs, CSVs, or Excel files directly.", icon: "upload_file" },
  { label: "Request Documents", description: "Send an automated secure link to your client.", icon: "mail" },
  { label: "Connect Email", description: "Sync relevant financial attachments from Gmail or Outlook.", icon: "sync" },
  { label: "Connect Google Drive", description: "Select approved folders from Drive.", icon: "add_to_drive" },
  { label: "Import Tally Export", description: "Upload standard Tally ERP exports.", icon: "account_balance" },
  { label: "Import Zoho Export", description: "Connect via API or upload Zoho exports.", icon: "dataset" }
];

function Icon({ name, className = "text-2xl" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  );
}

export function FynnyEntry() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setComplete(window.localStorage.getItem(storageKey) === "true");
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((payload: SessionResponse) => setSession(payload))
      .catch(() => setSession({ authenticated: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f9f9f9] px-6">
        <AgenticLoading variant="portfolio" />
      </main>
    );
  }

  if (!session?.authenticated) {
    return <FynnyLandingPage />;
  }

  if (!complete) {
    return <OnboardingFlow userLabel={session.user?.name ?? session.user?.email ?? "your firm"} onComplete={() => setComplete(true)} />;
  }

  return <FinvaultConsole />;
}

function FynnyLandingPage() {
  const intelligenceCards = [
    { label: "Collection", value: "Consent first", detail: "Read-only source access, client approved, revocable anytime." },
    { label: "Processing", value: "6 stages", detail: "Collect, classify, validate, normalize, build memory, prepare intelligence." },
    { label: "Readiness", value: "Score gated", detail: "Reports only unlock when data is complete, validated, and reconciled." },
    { label: "Memory", value: "Persistent", detail: "Documents become financial events, relationships, and client context." }
  ];

  const sources = ["Gmail", "Google Drive", "Zoho Books", "Tally exports", "Bank statements", "GST files", "Spreadsheets", "PDFs"];

  const timeline = [
    { before: "Manual collection", after: "Approved data sources sync into one secure intake layer." },
    { before: "Format cleanup", after: "Documents are classified and normalized into financial records." },
    { before: "Missing-data chase", after: "Validation issues and readiness blockers are tracked per client." },
    { before: "Report prep", after: "Ask Fynny and reports use only intelligence-ready datasets." }
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-[#e0e2e8] selection:bg-[#7a1f2b]/40">
      <header className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/5 bg-[#0a0a0a]/85 px-5 backdrop-blur-xl md:px-10">
        <a href="#top" className="text-[22px] font-extrabold tracking-[-0.04em] text-white">
          Fynny
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {["Platform", "Intelligence", "Integrations", "Security"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50 transition hover:text-white">
              {item}
            </a>
          ))}
        </nav>
        <a href="/api/auth/scalekit" className="rounded-full border border-white/10 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0a0a0a] transition hover:bg-[#f2d8dc]">
          Sign in
        </a>
      </header>

      <section id="top" className="relative flex min-h-screen items-center justify-center px-6 pb-20 pt-28 text-center md:px-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(122,31,43,0.22),transparent_48%)]" />
          <div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
          <div className="absolute left-[12%] top-[20%] h-40 w-40 rounded-full bg-[#7a1f2b]/10 blur-3xl" />
          <div className="absolute bottom-[10%] right-[8%] h-52 w-52 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mx-auto mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-[#7a1f2b] shadow-[0_0_0_6px_rgba(122,31,43,0.18)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/60">Operating layer for modern finance</span>
          </div>
          <h1 className="mx-auto max-w-5xl text-[52px] font-extrabold leading-[0.95] tracking-[-0.065em] text-white md:text-[96px] lg:text-[118px]">
            Turn scattered client data into financial intelligence.
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/62 md:text-xl">
            Fynny collects approved financial documents, validates incomplete records, builds financial memory, and unlocks reports only when intelligence readiness is true.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href="/api/auth/scalekit" className="w-full rounded-2xl border border-white/10 bg-[#7a1f2b] px-8 py-5 text-base font-bold text-white shadow-[0_24px_80px_rgba(122,31,43,0.3)] transition hover:-translate-y-0.5 hover:bg-[#661825] md:w-auto">
              Get Started with ScaleKit
            </a>
            <a href="#platform" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-5 text-base font-semibold text-white backdrop-blur-xl transition hover:bg-white/[0.08] md:w-auto">
              <Icon name="play_circle" className="text-xl text-[#f2d8dc]" />
              See how Fynny works
            </a>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-3 rounded-[32px] border border-white/10 bg-black/50 p-3 shadow-2xl backdrop-blur-xl md:grid-cols-3">
            {["Processing Layer", "Financial Memory", "Intelligence Ready"].map((stage, index) => (
              <div key={stage} className="rounded-3xl border border-white/5 bg-white/[0.03] p-5 text-left">
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">0{index + 1}</span>
                  <span className="h-2 w-2 rounded-full bg-[#7a1f2b]" />
                </div>
                <p className="text-sm font-bold text-white">{stage}</p>
                <p className="mt-2 text-sm leading-6 text-white/45">{index === 0 ? "Validate every upload." : index === 1 ? "Persist client context." : "Gate reports safely."}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-white/5 bg-black/45 px-6 py-24 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f2d8dc]/70">Ready for intelligence</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-white md:text-6xl">One backbone for CA firm operations.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {intelligenceCards.map((card) => (
              <article key={card.label} className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 transition hover:-translate-y-1 hover:border-[#7a1f2b]/70 hover:bg-white/[0.055]">
                <div className="mb-10 flex items-start justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/42">{card.label}</span>
                  <span className="rounded bg-[#7a1f2b]/25 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#f2d8dc]">{card.value}</span>
                </div>
                <p className="text-base leading-7 text-white/68">{card.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="intelligence" className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 py-28 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f2d8dc]/70">Collapse the timeline</p>
          <h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.045em] text-white md:text-6xl">
            From messy inputs to client-ready decisions.
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/58">
            The product moat is the pipeline: processing to memory to intelligence. Reports, advisory, client visibility, and Ask Fynny all depend on the same readiness score.
          </p>
        </div>
        <div className="rounded-[44px] border border-white/10 bg-[#080808] p-4 shadow-2xl">
          {timeline.map((item, index) => (
            <div key={item.before} className="grid gap-4 border-b border-white/5 p-5 last:border-b-0 md:grid-cols-[0.8fr_1.2fr]">
              <div className="flex items-center gap-4 text-white/42">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xs font-bold">0{index + 1}</span>
                <span className="text-sm line-through">{item.before}</span>
              </div>
              <div className="rounded-2xl border border-[#7a1f2b]/25 bg-[#7a1f2b]/10 p-4 text-sm leading-6 text-white/78">{item.after}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="integrations" className="border-y border-white/5 bg-[#111] px-6 py-24 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f2d8dc]/70">Secure collection</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-white md:text-6xl">Read-only by default. Consent at every source.</h2>
              <p className="mt-6 text-lg leading-8 text-white/58">
                Fynny only collects financial documents clients approve. It does not request unrelated mailbox or WhatsApp access for the MVP.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {sources.map((source) => (
                <div key={source} className="rounded-3xl border border-white/10 bg-black/40 p-5 text-center">
                  <Icon name={source.includes("Drive") ? "add_to_drive" : source.includes("Gmail") ? "mail" : source.includes("Bank") ? "account_balance" : source.includes("PDF") ? "picture_as_pdf" : "dataset"} className="text-3xl text-[#f2d8dc]" />
                  <p className="mt-4 text-sm font-semibold text-white/78">{source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="px-6 py-28 md:px-10">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[48px] border border-white/10 bg-[#7a1f2b] p-10 text-center text-white shadow-[0_40px_120px_rgba(0,0,0,0.65)] md:p-20">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/55">ScaleKit only signup</p>
          <h2 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.045em] md:text-6xl">
            Start with a secure workspace, then connect approved client data.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/72">
            Fynny only collects financial documents you approve. Access is read-only and can be revoked anytime.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href="/api/auth/scalekit" className="w-full rounded-2xl bg-white px-8 py-5 text-base font-bold text-[#7a1f2b] transition hover:scale-[1.02] md:w-auto">
              Create Workspace
            </a>
            <a href="#top" className="w-full rounded-2xl border border-white/15 bg-white/10 px-8 py-5 text-base font-bold text-white transition hover:bg-white/15 md:w-auto">
              Back to top
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-white/35 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm md:flex-row md:items-center md:justify-between">
          <p>Fynny. The operating layer for modern financial intelligence.</p>
          <p>Built for CA firms. Scaled for client visibility.</p>
        </div>
      </footer>
    </main>
  );
}

function ScaleKitSignupScreen() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f9f9f9] text-[#1a1c1c]">
      <div className="fixed left-0 top-0 z-50 h-1 w-full bg-[#e8e8e8]" />
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-8 md:px-16">
        <div className="text-2xl font-semibold text-[#5b0617]">Fynny</div>
        <a href="/api/auth/scalekit" className="text-sm font-semibold uppercase tracking-[0.05em] text-[#5f5e5e] hover:text-[#5b0617]">
          Sign in
        </a>
      </header>
      <section className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-16 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:px-16">
        <div>
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#5f5e5e]">Secure financial intelligence for CA firms</p>
          <h1 className="font-[var(--font-source-serif)] text-[42px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#111111] md:text-[64px]">
            Transform scattered client data into intelligence-ready records.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#564242]">
            Fynny collects approved financial documents, validates them, builds memory, and powers reports without taking unnecessary write access.
          </p>
        </div>
        <div className="rounded-xl border border-[#e2e2e2] bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#5f5e5e]">Get Started</p>
          <h2 className="mt-4 font-[var(--font-source-serif)] text-4xl font-semibold text-[#111111]">Create your workspace</h2>
          <p className="mt-3 text-base leading-7 text-[#564242]">Sign up using ScaleKit. This is the only sign-up method enabled for Fynny.</p>
          <a href="/api/auth/scalekit" className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded bg-[#111111] px-6 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-[#5b0617]">
            <Icon name="shield_lock" className="text-xl" />
            Continue with ScaleKit
          </a>
          <div className="mt-6 rounded-lg border border-[#ececec] bg-[#f9f9f9] p-4 text-sm leading-6 text-[#5f5e5e]">
            Fynny only collects financial documents you approve. Access is read-only and can be revoked anytime.
          </div>
        </div>
      </section>
    </main>
  );
}

function OnboardingFlow({ userLabel, onComplete }: { userLabel: string; onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string | string[]>>({});
  const step = steps[index];
  const progress = ((index + 1) / steps.length) * 100;

  function next() {
    if (step === "creating") {
      setIndex(index + 1);
      return;
    }
    if (step === "ready") {
      window.localStorage.setItem(storageKey, "true");
      onComplete();
      return;
    }
    setIndex(Math.min(index + 1, steps.length - 1));
  }

  function back() {
    setIndex(Math.max(index - 1, 0));
  }

  const content = useMemo(() => {
    if (step === "firm") {
      return <ChoiceGrid title="What kind of firm are you?" subtitle="This helps us tailor your workspace." choices={firmTypes} selected={selected.firm as string} onSelect={(value) => setSelected((current) => ({ ...current, firm: value }))} />;
    }
    if (step === "volume") {
      return <SplitChoice title="How many active clients do you manage?" subtitle="This helps us configure your portfolio workspace perfectly to scale with your business." choices={clientVolumes} selected={selected.volume as string} onSelect={(value) => setSelected((current) => ({ ...current, volume: value }))} />;
    }
    if (step === "sources") {
      return <ChipStep title="Where does client information usually come from?" subtitle="Most firms use multiple sources." items={workflowSources} selected={(selected.sources as string[]) ?? []} onChange={(value) => setSelected((current) => ({ ...current, sources: value }))} />;
    }
    if (step === "bottleneck") {
      return <ChoiceGrid title="What consumes the most time today?" subtitle="Identify your primary bottleneck to tailor workflow optimization." choices={bottlenecks} selected={selected.bottleneck as string} onSelect={(value) => setSelected((current) => ({ ...current, bottleneck: value }))} wide />;
    }
    if (step === "connect") {
      return <ChoiceGrid title="How would you like to start?" subtitle="Connect data sources to populate your first client profile securely." choices={dataStarts} selected={selected.connect as string} onSelect={(value) => setSelected((current) => ({ ...current, connect: value }))} wide />;
    }
    if (step === "creating") {
      return <CreatingWorkspace userLabel={userLabel} />;
    }
    return <WorkspaceReady onComplete={next} />;
  }, [step, selected, userLabel]);

  return (
    <main className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c]">
      <div className="fixed left-0 top-0 z-50 h-1 w-full bg-[#e8e8e8]">
        <div className="h-full bg-[#7a1f2b] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      {step !== "ready" ? (
        <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-8 md:px-16">
          <div className="font-[var(--font-source-serif)] text-2xl font-semibold text-[#5b0617]">Fynny</div>
          <button onClick={next} className="text-sm font-semibold uppercase tracking-[0.05em] text-[#5f5e5e] hover:text-[#5b0617]">
            Save & Exit
          </button>
        </header>
      ) : null}
      {content}
      {step !== "ready" ? <OnboardingNav canBack={index > 0} onBack={back} onNext={next} nextLabel={step === "creating" ? "Continue" : "Continue"} /> : null}
    </main>
  );
}

function ChoiceGrid({ title, subtitle, choices, selected, onSelect, wide = false }: { title: string; subtitle: string; choices: Choice[]; selected?: string; onSelect: (value: string) => void; wide?: boolean }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[1200px] flex-col items-center justify-center px-6 pb-32 pt-8 md:px-16">
      <div className="mb-12 max-w-3xl text-center">
        <h1 className="font-[var(--font-source-serif)] text-[32px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#111111] md:text-[48px]">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-[#564242]">{subtitle}</p>
      </div>
      <div className={`grid w-full gap-4 ${wide ? "max-w-5xl md:grid-cols-2 lg:grid-cols-3" : "max-w-3xl md:grid-cols-2"}`}>
        {choices.map((choice) => (
          <button key={choice.label} onClick={() => onSelect(choice.label)} className={`flex items-start rounded-lg bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-[#111111] hover:shadow-[0_10px_25px_rgba(0,0,0,0.05)] ${selected === choice.label ? "border-2 border-[#111111]" : "border border-[#e2e2e2]"}`}>
            <Icon name={choice.icon} className="mr-4 mt-1 text-[32px] text-[#5f5e5e]" />
            <div>
              <h3 className="font-[var(--font-source-serif)] text-2xl font-medium text-[#111111]">{choice.label}</h3>
              <p className="mt-1 text-base leading-6 text-[#564242]">{choice.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SplitChoice({ title, subtitle, choices, selected, onSelect }: { title: string; subtitle: string; choices: Choice[]; selected?: string; onSelect: (value: string) => void }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[1200px] items-center px-6 pb-32 pt-8 md:px-16">
      <div className="grid w-full items-center gap-16 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h1 className="font-[var(--font-source-serif)] text-[32px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#111111] md:text-[48px]">{title}</h1>
          <p className="mt-4 text-lg leading-8 text-[#564242]">{subtitle}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {choices.map((choice) => (
            <button key={choice.label} onClick={() => onSelect(choice.label)} className={`flex min-h-44 flex-col rounded-lg bg-white p-6 text-left transition hover:border-[#111111] ${selected === choice.label ? "border-2 border-[#111111]" : "border border-[#e2e2e2]"}`}>
              <div className="mb-8 flex items-start justify-between">
                <Icon name={choice.icon} className="text-3xl text-[#5f5e5e]" />
                <span className={`grid h-6 w-6 place-items-center rounded-full border ${selected === choice.label ? "border-[#111111]" : "border-[#e2e2e2]"}`}>
                  <span className={`h-3 w-3 rounded-full bg-[#111111] ${selected === choice.label ? "opacity-100" : "opacity-0"}`} />
                </span>
              </div>
              <h3 className="mt-auto font-[var(--font-source-serif)] text-2xl font-medium text-[#111111]">{choice.label}</h3>
              <p className="mt-2 text-base text-[#564242]">{choice.description}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChipStep({ title, subtitle, items, selected, onChange }: { title: string; subtitle: string; items: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  function toggle(item: string) {
    onChange(selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item]);
  }
  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[1200px] flex-col items-center justify-center px-6 pb-32 pt-8 md:px-16">
      <div className="mb-20 max-w-2xl text-center">
        <h1 className="font-[var(--font-source-serif)] text-[32px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#111111] md:text-[48px]">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-[#564242]">{subtitle}</p>
      </div>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 md:grid-cols-3">
        {items.map((item) => {
          const active = selected.includes(item);
          return (
            <button key={item} onClick={() => toggle(item)} className={`flex items-center justify-between rounded-lg bg-white p-6 text-left transition ${active ? "border-2 border-[#111111]" : "border border-[#e2e2e2] hover:border-[#111111]"}`}>
              <span className="text-sm font-semibold uppercase tracking-[0.05em] text-[#111111]">{item}</span>
              <Icon name="check_circle" className={`text-xl ${active ? "text-[#111111]" : "text-transparent"}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CreatingWorkspace({ userLabel }: { userLabel: string }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[1200px] items-center justify-center px-6 pb-32 pt-8 md:px-16">
      <div className="grid w-full items-center gap-16 md:grid-cols-[0.8fr_1fr]">
        <div className="relative grid h-72 w-72 place-items-center justify-self-center rounded-full bg-white shadow-[0_0_40px_rgba(91,6,23,0.05)] md:h-96 md:w-96">
          <div className="absolute h-44 w-44 animate-pulse rounded-full bg-[#ffb3b5]/20 blur-3xl" />
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-[#7a1f2b] text-white shadow-[0_0_0_18px_rgba(122,31,43,0.08)]">
            <Icon name="auto_awesome" className="text-4xl" />
          </div>
          {["description", "fact_check", "memory"].map((icon, index) => (
            <div key={icon} className="absolute grid h-12 w-12 place-items-center rounded-full border border-[#e2e2e2] bg-white text-[#5b0617]" style={{ transform: `rotate(${index * 120}deg) translateY(-130px) rotate(-${index * 120}deg)` }}>
              <Icon name={icon} />
            </div>
          ))}
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-[#5f5e5e]">Creating workspace</p>
          <h1 className="font-[var(--font-source-serif)] text-[32px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#111111] md:text-[48px]">Preparing intelligence for {userLabel}.</h1>
          <div className="mt-10 space-y-5 text-lg text-[#564242]">
            <p>Configuring secure collection rules.</p>
            <p>Preparing validation and processing stages.</p>
            <p>Connecting financial memory workspace.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspaceReady({ onComplete }: { onComplete: () => void }) {
  return (
    <section className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-20 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(122,31,43,0.08),transparent_35%)]" />
      <div className="relative z-10 max-w-2xl">
        <Icon name="check_circle" className="mb-4 text-6xl text-[#7a1f2b]" />
        <h1 className="font-[var(--font-source-serif)] text-[36px] font-semibold leading-[1.18] tracking-[-0.01em] text-[#111111] md:text-[56px]">Your intelligence workspace is ready.</h1>
        <p className="mt-5 text-lg leading-8 text-[#5f5e5e]">Let's bring in your first client.</p>
        <div className="mt-16 flex flex-col items-center justify-center gap-4 md:flex-row">
          <button onClick={onComplete} className="flex w-full items-center justify-center gap-2 rounded bg-[#111111] px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-[#5b0617] md:w-auto">
            <Icon name="add" className="text-lg" />
            Add First Client
          </button>
          <button onClick={onComplete} className="flex w-full items-center justify-center gap-2 rounded border border-[#e2e2e2] bg-transparent px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-[#111111] transition hover:border-[#111111] md:w-auto">
            <Icon name="explore" className="text-lg" />
            Open Workspace
          </button>
        </div>
      </div>
    </section>
  );
}

function OnboardingNav({ canBack, onBack, onNext, nextLabel }: { canBack: boolean; onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-between border-t border-[#e5e2e1] bg-[#f9f9f9]/90 px-6 py-6 backdrop-blur-md md:px-16">
      <button disabled={!canBack} onClick={onBack} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-[#5f5e5e] transition hover:text-[#111111] disabled:opacity-30">
        <Icon name="arrow_back" className="text-xl" />
        Back
      </button>
      <button onClick={onNext} className="flex items-center gap-2 rounded bg-[#111111] px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-[#5b0617]">
        {nextLabel}
        <Icon name="arrow_forward" className="text-xl" />
      </button>
    </nav>
  );
}
