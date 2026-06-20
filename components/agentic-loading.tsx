"use client";

import type { CSSProperties, ReactNode } from "react";
import { Check, FileText, Landmark, Network, Table2 } from "lucide-react";

export type AgenticLoadingVariant =
  | "thinking"
  | "processing"
  | "report"
  | "memory"
  | "portfolio"
  | "validation"
  | "missing-data"
  | "advisory"
  | "publishing"
  | "ready";

const copy: Record<AgenticLoadingVariant, { headline: string; subtext: string }> = {
  thinking: {
    headline: "Reviewing financial memory...",
    subtext: "Finding supporting evidence."
  },
  processing: {
    headline: "Structuring financial information...",
    subtext: "Turning documents into validated records."
  },
  report: {
    headline: "Preparing client-ready report...",
    subtext: "Assembling sections from verified evidence."
  },
  memory: {
    headline: "Updating financial memory...",
    subtext: "Connecting documents, transactions, and events."
  },
  portfolio: {
    headline: "Refreshing portfolio intelligence...",
    subtext: "Organizing clients by readiness and attention."
  },
  validation: {
    headline: "Validating financial records...",
    subtext: "Checking dates, amounts, periods, GST, and client links."
  },
  "missing-data": {
    headline: "Checking data completeness...",
    subtext: "Looking for gaps before intelligence is unlocked."
  },
  advisory: {
    headline: "Identifying advisory opportunities...",
    subtext: "Connecting metrics into evidence-backed insight."
  },
  publishing: {
    headline: "Publishing to client workspace...",
    subtext: "Moving approved outputs into client visibility."
  },
  ready: {
    headline: "Intelligence Ready",
    subtext: "Processing, memory, and intelligence are aligned."
  }
};

export function AgenticGlyph({ variant = "thinking", label }: { variant?: AgenticLoadingVariant; label?: string }) {
  return (
    <span className="fynny-agent-glyph" aria-label={label ?? copy[variant].headline} role="img">
      <span />
      <span />
      <span />
    </span>
  );
}

export function AgenticLoading({
  variant,
  compact = false,
  className = ""
}: {
  variant: AgenticLoadingVariant;
  compact?: boolean;
  className?: string;
}) {
  const text = copy[variant];

  return (
    <div className={`fynny-agentic ${compact ? "fynny-agentic--compact" : ""} ${className}`} role="status" aria-live="polite">
      <div className="fynny-agentic__stage">{renderVisual(variant)}</div>
      <div className="min-w-0">
        <p className="fynny-agentic__headline">{text.headline}</p>
        <p className="fynny-agentic__subtext">{text.subtext}</p>
      </div>
    </div>
  );
}

function renderVisual(variant: AgenticLoadingVariant) {
  switch (variant) {
    case "thinking":
      return <ThinkingVisual />;
    case "processing":
      return <ProcessingVisual />;
    case "report":
      return <ReportVisual />;
    case "memory":
      return <MemoryVisual />;
    case "portfolio":
      return <PortfolioVisual />;
    case "validation":
      return <ValidationVisual />;
    case "missing-data":
      return <MissingDataVisual />;
    case "advisory":
      return <AdvisoryVisual />;
    case "publishing":
      return <PublishingVisual />;
    case "ready":
      return <ReadyVisual />;
  }
}

function ThinkingVisual() {
  return (
    <div className="agent-visual agent-thinking">
      <ConnectionLine className="line-a" />
      <ConnectionLine className="line-b" />
      <ConnectionLine className="line-c" />
      <Node className="node-a" icon={<FileText />} label="Documents" />
      <Node className="node-b" icon={<Table2 />} label="Calculations" />
      <Node className="node-c" icon={<Network />} label="Memory" />
      <div className="agent-orb" />
      <div className="answer-card" />
    </div>
  );
}

function ProcessingVisual() {
  return (
    <div className="agent-visual agent-processing">
      <div className="doc-card doc-a" />
      <div className="doc-card doc-b" />
      <div className="process-node" />
      <div className="record-block record-a" />
      <div className="record-block record-b" />
      <div className="memory-chip" />
    </div>
  );
}

function ReportVisual() {
  const sections = ["Executive Summary", "Financial Health", "Risks", "Recommendations"];
  return (
    <div className="agent-visual agent-report">
      <div className="report-page">
        {sections.map((section, index) => (
          <div key={section} className="report-section" style={{ "--i": index } as CSSProperties}>
            <Check className="size-3" />
            <span>{section}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoryVisual() {
  return (
    <div className="agent-visual agent-memory">
      <div className="timeline-line" />
      {["doc", "txn", "event", "memory"].map((item, index) => (
        <div key={item} className={`timeline-dot dot-${index}`} style={{ "--i": index } as CSSProperties} />
      ))}
    </div>
  );
}

function PortfolioVisual() {
  return (
    <div className="agent-visual agent-portfolio">
      {["healthy", "watchlist", "attention", "healthy", "watchlist"].map((state, index) => (
        <div key={`${state}-${index}`} className={`client-node ${state}`} style={{ "--i": index } as CSSProperties} />
      ))}
    </div>
  );
}

function ValidationVisual() {
  return (
    <div className="agent-visual agent-validation">
      {["Date", "Amount", "Period", "GST", "Client"].map((field, index) => (
        <div key={field} className="field-row" style={{ "--i": index } as CSSProperties}>
          <span>{field}</span>
          <Check className="size-3" />
        </div>
      ))}
    </div>
  );
}

function MissingDataVisual() {
  return (
    <div className="agent-visual agent-missing">
      {Array.from({ length: 12 }, (_, index) => (
        <span key={index} className={index === 5 || index === 10 ? "missing-cell gap-cell" : "missing-cell"} style={{ "--i": index } as CSSProperties} />
      ))}
    </div>
  );
}

function AdvisoryVisual() {
  return (
    <div className="agent-visual agent-advisory">
      <ConnectionLine className="metric-line-a" />
      <ConnectionLine className="metric-line-b" />
      <Node className="metric-a" icon={<Landmark />} />
      <Node className="metric-b" icon={<Table2 />} />
      <Node className="metric-c" icon={<FileText />} />
      <div className="insight-card" />
    </div>
  );
}

function PublishingVisual() {
  return (
    <div className="agent-visual agent-publishing">
      <div className="workspace ca">CA</div>
      <div className="publish-card" />
      <div className="workspace client">Client</div>
    </div>
  );
}

function ReadyVisual() {
  return (
    <div className="agent-visual agent-ready">
      {["Collect", "Validate", "Structure", "Memory", "Intelligence"].map((stage, index) => (
        <div key={stage} className="ready-step" style={{ "--i": index } as CSSProperties}>
          <Check className="size-3" />
          <span>{stage}</span>
        </div>
      ))}
    </div>
  );
}

function Node({ className, icon, label }: { className: string; icon: ReactNode; label?: string }) {
  return (
    <div className={`agent-node ${className}`} aria-label={label}>
      {icon}
    </div>
  );
}

function ConnectionLine({ className }: { className: string }) {
  return <span className={`connection-line ${className}`} />;
}
