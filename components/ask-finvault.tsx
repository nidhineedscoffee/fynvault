"use client";

import { FormEvent, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";

type AskResponse = {
  answer: string;
  confidence?: string;
  sources?: Array<{ label: string; source: string }>;
  calculation_reference?: string[];
  error?: string;
};

export function AskFinVault() {
  const [question, setQuestion] = useState("What is my runway?");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      });
      setResponse(await result.json());
    } catch {
      setResponse({ answer: "Unable to reach Ask Fynny right now.", error: "network_error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Ask Fynny</h2>
          <p className="mt-1 text-sm text-coal/65">Answers are generated only after rules and validation pass.</p>
        </div>
        <ShieldCheck className="size-5 text-fern" aria-hidden />
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="focus-ring min-w-0 flex-1 rounded-md border border-line bg-cloud px-3 py-2 text-sm text-ink"
          aria-label="Financial question"
        />
        <button
          type="submit"
          className="focus-ring grid size-10 shrink-0 place-items-center rounded-md bg-slate text-white transition hover:bg-coal disabled:opacity-60"
          disabled={loading}
          title="Ask"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>

      {response ? (
        <div className="mt-4 rounded-md border border-line bg-cloud p-4">
          <p className="text-sm leading-6 text-ink">{response.answer}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-sm border border-line bg-white px-2 py-1 text-xs font-medium text-fern">
              Confidence: {response.confidence ?? "low"}
            </span>
            <span className="rounded-sm border border-line bg-white px-2 py-1 text-xs font-medium text-coal/70">
              {(response.sources ?? []).length} sources
            </span>
          </div>
          <div className="mt-3 max-h-28 overflow-auto text-xs leading-5 text-coal/65">
            {(response.calculation_reference ?? []).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
