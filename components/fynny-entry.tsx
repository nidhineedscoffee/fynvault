"use client";

import { useEffect, useMemo, useState } from "react";
import { FinvaultConsole } from "@/components/finvault-console";
import { AgenticLoading } from "@/components/agentic-loading";
import { FynnyReferenceLanding } from "@/components/fynny-reference-landing";

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

const workflowSources: Choice[] = [
  { label: "Email", description: "Financial attachments and accountant threads.", icon: "mail" },
  { label: "WhatsApp", description: "Forwarded client documents and collection links.", icon: "forum" },
  { label: "Excel", description: "Spreadsheets, trackers, and reconciliations.", icon: "table_chart" },
  { label: "Tally", description: "Accounting exports and ledgers.", icon: "account_balance_wallet" },
  { label: "Zoho Books", description: "Books, invoices, and accounting exports.", icon: "account_balance" },
  { label: "GST Files", description: "Returns, filings, and compliance documents.", icon: "receipt_long" },
  { label: "Bank Statements", description: "Statements and transaction histories.", icon: "assured_workload" },
  { label: "Google Drive", description: "Approved folders and shared client files.", icon: "add_to_drive" },
  { label: "Other", description: "Any other finance source your firm uses.", icon: "hub" }
];

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
  { label: "Connect Google Drive", description: "Select folders from Drive.", icon: "add_to_drive" },
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
    return <FynnyReferenceLanding />;
  }

  if (!complete) {
    return <OnboardingFlow userLabel={session.user?.name ?? session.user?.email ?? "your firm"} onComplete={() => setComplete(true)} />;
  }

  return <FinvaultConsole />;
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
      return <ChipStep title="Where does client information usually come from?" subtitle="Most firms use multiple sources. Pick every source your team handles." items={workflowSources} selected={(selected.sources as string[]) ?? []} onChange={(value) => setSelected((current) => ({ ...current, sources: value }))} />;
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

function ChipStep({ title, subtitle, items, selected, onChange }: { title: string; subtitle: string; items: Choice[]; selected: string[]; onChange: (value: string[]) => void }) {
  function toggle(item: string) {
    onChange(selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item]);
  }
  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[1200px] flex-col items-center justify-center px-5 pb-32 pt-8 sm:px-6 md:px-16">
      <div className="mb-12 max-w-2xl text-center md:mb-16">
        <h1 className="font-[var(--font-source-serif)] text-[32px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#111111] md:text-[48px]">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-[#564242]">{subtitle}</p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const active = selected.includes(item.label);
          return (
            <button key={item.label} onClick={() => toggle(item.label)} className={`group flex min-h-[118px] items-start gap-4 rounded-2xl bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#111111] hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)] ${active ? "border-2 border-[#111111] shadow-[0_14px_40px_rgba(0,0,0,0.06)]" : "border border-[#e2e2e2]"}`}>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${active ? "bg-[#111111] text-white" : "bg-[#f4f3f3] text-[#5b0617] group-hover:bg-[#f0e7e9]"}`}>
                <Icon name={item.icon} className="text-[25px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#111111]">{item.label}</span>
                  <Icon name="check_circle" className={`text-xl ${active ? "text-[#111111]" : "text-transparent"}`} />
                </span>
                <span className="mt-2 block text-sm leading-6 text-[#5f5e5e]">{item.description}</span>
              </span>
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

