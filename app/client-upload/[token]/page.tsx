"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type UploadLinkResponse = {
  ok: boolean;
  data?: {
    request?: {
      id?: string;
      required_item?: string;
      document_category?: string;
      due_date?: string;
      clients?: { name?: string; contact_email?: string };
    };
  };
  error?: string;
};

type Notice = { tone: "success" | "error" | "warning"; title: string; body: string } | null;

const readableTypes = ["text/csv", "text/plain", "application/json"];

function categoryLabel(value?: string) {
  return (value ?? "financial_document").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fileTypeFor(file: File) {
  if (file.type.includes("pdf")) return "pdf";
  if (file.name.toLowerCase().endsWith(".csv")) return "csv";
  if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) return "spreadsheet";
  return file.type || "document";
}

export default function ClientUploadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [link, setLink] = useState<UploadLinkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const request = link?.data?.request;
  const requiredItem = request?.required_item ?? categoryLabel(request?.document_category);
  const clientName = request?.clients?.name ?? "your CA team";

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/client-upload/${token}`);
      const payload = (await response.json().catch(() => ({ ok: false, error: "Unable to read upload link." }))) as UploadLinkResponse;
      if (active) {
        setLink(payload);
        setLoading(false);
      }
    }
    if (token) void load();
    return () => {
      active = false;
    };
  }, [token]);

  const helperText = useMemo(() => {
    if (!file) return "Attach the requested file. CSV and TXT files are read directly so Fynny can process them immediately.";
    if (extractedText) return "Readable content captured. Fynny will start validation, normalization, and memory updates after upload.";
    return "File selected. For PDFs/XLSX, Fynny will store the submission metadata and queue it for processing.";
  }, [file, extractedText]);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setExtractedText("");
    setNotice(null);
    if (!selected) return;
    const canReadText = readableTypes.includes(selected.type) || /\.(csv|txt|json)$/i.test(selected.name);
    if (canReadText) {
      setExtractedText(await selected.text());
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setNotice({ tone: "warning", title: "Attach a file first", body: "Choose the requested financial document before submitting." });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const response = await fetch(`/api/client-upload/${token}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        type: fileTypeFor(file),
        sourceType: "client_upload_link",
        documentCategory: request?.document_category ?? "other",
        extractedText: extractedText || undefined,
        metadata: {
          originalFileName: file.name,
          mimeType: file.type || "unknown",
          sizeBytes: file.size,
          uploadedFrom: "client_upload_portal"
        }
      })
    });
    const payload = await response.json().catch(() => ({ ok: false, error: "Upload failed." }));
    setSubmitting(false);
    if (!response.ok || !payload.ok) {
      setNotice({ tone: "error", title: "Upload could not be completed", body: payload.error ?? "Please try again or ask your CA team for a fresh upload link." });
      return;
    }
    setNotice({ tone: "success", title: "Submitted securely", body: "Fynny has queued the document for validation, processing, and intelligence readiness checks." });
    setFile(null);
    setExtractedText("");
  }

  return (
    <main className="min-h-screen bg-[#f7f5f2] px-5 py-8 text-[#111111] sm:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[36px] border border-[#e8dfdc] bg-white p-8 shadow-[0_30px_90px_rgba(17,17,17,0.08)] sm:p-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">Fynny secure collection</p>
          <h1 className="mt-5 max-w-xl text-[42px] font-black leading-[0.95] tracking-[-0.05em] sm:text-[64px]">Upload one approved financial file.</h1>
          <p className="mt-6 max-w-lg text-[16px] leading-7 text-[#615d5a]">Fynny only collects the document requested by your CA team. This link does not grant access to your email, Drive, WhatsApp, or other files.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Read-only", "Client-approved", "Processing-ready"].map((item) => <div key={item} className="rounded-2xl border border-[#eee6e2] bg-[#faf8f6] p-4 text-[12px] font-bold uppercase tracking-[0.14em] text-[#322b29]">{item}</div>)}
          </div>
        </div>

        <div className="rounded-[36px] border border-[#e5ddda] bg-white p-6 shadow-[0_20px_80px_rgba(122,31,43,0.10)] sm:p-8">
          {loading ? (
            <div className="py-20 text-center">
              <div className="mx-auto h-16 w-16 rounded-[24px] bg-[#7A1F2B] shadow-[0_0_0_18px_rgba(122,31,43,0.08)]" />
              <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-[#7A1F2B]">Verifying secure link</p>
            </div>
          ) : !link?.ok ? (
            <div className="rounded-[28px] border border-[#f0c8c8] bg-[#fff7f6] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#93000a]">Link unavailable</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em]">This upload link is not active.</h2>
              <p className="mt-3 text-sm leading-6 text-[#6a5552]">{link?.error ?? "Please request a fresh secure upload link from your CA team."}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="rounded-[28px] border border-[#efe6e2] bg-[#fbfaf9] p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7A1F2B]">Requested by {clientName}</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{requiredItem}</h2>
                <p className="mt-3 text-sm text-[#6a6460]">Due date: {request?.due_date ? new Date(request.due_date).toLocaleDateString() : "As requested"}</p>
              </div>

              <label className="block cursor-pointer rounded-[28px] border border-dashed border-[#cdbdba] bg-white p-8 text-center transition hover:border-[#7A1F2B] hover:bg-[#fffafa]">
                <input className="sr-only" type="file" onChange={onFileChange} accept=".csv,.xlsx,.xls,.pdf,.txt,.json" />
                <span className="material-symbols-outlined text-[42px] text-[#7A1F2B]">upload_file</span>
                <span className="mt-4 block text-lg font-black tracking-[-0.02em]">{file ? file.name : "Choose financial file"}</span>
                <span className="mt-2 block text-sm leading-6 text-[#6a6460]">{helperText}</span>
              </label>

              {notice ? <div className={`rounded-2xl border p-4 text-sm leading-6 ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : notice.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800"}`}><strong>{notice.title}</strong><br />{notice.body}</div> : null}

              <button disabled={submitting || !file} className="w-full rounded-2xl bg-[#111111] px-6 py-5 text-[13px] font-black uppercase tracking-[0.14em] text-white shadow-[0_20px_50px_rgba(17,17,17,0.18)] transition hover:bg-[#7A1F2B] disabled:cursor-not-allowed disabled:bg-[#d8d4d1] disabled:text-[#77706c]" type="submit">
                {submitting ? "Submitting to Fynny..." : "Submit Securely"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
