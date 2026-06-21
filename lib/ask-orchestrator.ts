import { buildReadinessTrainingGuidance } from "./financial-intelligence";
import { listDataSources, syncDataSource } from "./consent";
import { answerMvpQuestion, generateExport, generateReport } from "./mvp";
import { getIntelligenceReadiness } from "./processing";
import { listPendingSubmissions } from "./submissions";

type AskInput = {
  question: string;
  firmId?: string;
};

type DataSourceRow = {
  id: string;
  source_type: string;
  provider: string;
  connection_status?: string;
};

type ReadinessRow = {
  intelligenceReady: boolean;
  score: number;
  factors: Record<string, number>;
  blockers?: Record<string, number>;
};

type PromptActions = {
  wantsDemoGuide: boolean;
  wantsSamples: boolean;
  wantsSync: boolean;
  wantsCollection: boolean;
  syncProvider?: "gmail" | "google_drive" | "zoho_books";
  wantsReport: boolean;
  wantsExport: boolean;
  reportType: string;
  exportType: "bank_summary" | "cleaned_sales_register" | "cleaned_purchase_register" | "gst_ready_data" | "mis_report" | "client_summary";
  fileFormat: "csv" | "xlsx" | "pdf";
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function requestedFormat(question: string) {
  const lower = question.toLowerCase();
  if (lower.includes("excel") || lower.includes("xlsx") || lower.includes("workbook")) return "xlsx" as const;
  if (lower.includes("pdf")) return "pdf" as const;
  return "csv" as const;
}

function requestedArtifacts(question: string) {
  const lower = question.toLowerCase();
  if (lower.includes("gst")) {
    return {
      reportType: "gst_compliance_report",
      exportType: "gst_ready_data" as const,
      fileFormat: lower.includes("report") && !lower.includes("csv") ? "pdf" as const : requestedFormat(question)
    };
  }
  if (lower.includes("receivable") || lower.includes("sales register") || lower.includes("invoice aging") || lower.includes("overdue invoice")) {
    return {
      reportType: "receivables_report",
      exportType: "cleaned_sales_register" as const,
      fileFormat: requestedFormat(question)
    };
  }
  if (lower.includes("payable") || lower.includes("purchase register") || lower.includes("vendor")) {
    return {
      reportType: "payables_report",
      exportType: "cleaned_purchase_register" as const,
      fileFormat: requestedFormat(question)
    };
  }
  if (lower.includes("cash flow") || lower.includes("bank summary") || lower.includes("runway")) {
    return {
      reportType: "cash_flow_report",
      exportType: "bank_summary" as const,
      fileFormat: requestedFormat(question)
    };
  }
  if (lower.includes("client summary") || lower.includes("advisory") || lower.includes("board report") || lower.includes("investor")) {
    return {
      reportType: "client_summary_report",
      exportType: "client_summary" as const,
      fileFormat: requestedFormat(question)
    };
  }
  return {
    reportType: "mis_report",
    exportType: "mis_report" as const,
    fileFormat: lower.includes("csv") || lower.includes("pdf") ? requestedFormat(question) : "xlsx" as const
  };
}

function compactIntentText(question: string) {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function detectSyncProvider(text: string) {
  if (hasAny(text, ["zoho", "books", "zoho books"])) return "zoho_books" as const;
  if (hasAny(text, ["google drive", "gdrive", "drive folder", "drive files", "drive"])) return "google_drive" as const;
  if (hasAny(text, ["gmail", "g mail", "email", "mailbox", "inbox", "mail attachments", "email attachments"])) return "gmail" as const;
  return undefined;
}

function parsePromptActions(question: string): PromptActions {
  const lower = compactIntentText(question);
  const demoTerms = ["how to test", "test the use case", "show value", "demo", "email integration", "gmail integration", "sample invoice", "sample contract", "sample gst"];
  const wantsDemoGuide = hasAny(lower, demoTerms);
  const wantsSamples = hasAny(lower, ["sample invoice", "sample contract", "sample gst", "sample file", "sample attachment"]);
  const provider = detectSyncProvider(lower);
  const syncTerms = [
    "sync",
    "fetch",
    "fetching",
    "fetc",
    "fech",
    "feth",
    "fthc",
    "fthcing",
    "pull",
    "collect",
    "refresh",
    "ingest",
    "load",
    "scan",
    "read inbox",
    "read email",
    "get files",
    "get data",
    "bring data",
    "process new",
    "process emails",
    "process attachments"
  ];
  const wantsSync = hasAny(lower, syncTerms)
    || (Boolean(provider) && hasAny(lower, ["report", "export", "process", "ready", "attachments", "files", "invoices", "gst", "contract"]));
  const wantsReport = hasAny(lower, ["report", "summary", "workbook", "mis"]);
  const wantsExport = wantsReport || hasAny(lower, ["export", "csv", "excel", "xlsx", "pdf", "format", "download"]);
  const wantsCollection = hasAny(lower, ["not submitted", "missing document", "missing documents", "pending submission", "pending submissions", "follow up", "followup", "overdue client", "late client", "blocked due to missing", "collection queue", "required documents", "generate reminder", "send reminder"]);
  const syncProvider = provider;
  const artifact = requestedArtifacts(question);

  return {
    wantsDemoGuide,
    wantsSamples,
    wantsSync,
    wantsCollection,
    syncProvider,
    wantsReport,
    wantsExport,
    reportType: artifact.reportType,
    exportType: artifact.exportType,
    fileFormat: artifact.fileFormat
  };
}

function buildEmailDemoAnswer(input: {
  readiness?: ReadinessRow;
  sources: DataSourceRow[];
}) {
  const gmailConnected = input.sources.some((source) => source.source_type === "gmail");
  const connectedSummary = input.sources.length
    ? `Connected sources: ${input.sources.map((source) => `${titleCase(source.source_type)} (${source.connection_status ?? "connected"})`).join(", ")}.`
    : "No source is connected yet.";
  const readinessSummary = input.readiness
    ? `Current readiness is ${input.readiness.score}% and Intelligence Ready is ${input.readiness.intelligenceReady ? "true" : "false"}.`
    : "Readiness will appear after the first sync or upload.";

  return [
    `${connectedSummary} ${readinessSummary}`,
    "Use one named client for the demo: `Aster Foods Pvt Ltd`. Connect Gmail with read-only access as the CA operator, then send three Aster Foods attachments to that mailbox: `fynny-email-sales-invoice-solid.csv`, `fynny-email-contract-renewal.csv`, and `fynny-email-gst-summary.csv`.",
    "After the Gmail sync demo, upload the full Aster Foods correlated pack so you can show the complete product story for one client across cash flow, receivables, payables, GST, TDS, payroll, contracts, validation, financial memory, advisory, reports, and exports.",
    "Run the demo prompts in this order: `sync Gmail and process the new finance emails`, `who are our top customers this quarter`, `which invoices are overdue`, `which vendor bill is oldest unpaid`, `why does April GST not match sales`, `did payroll increase in June`, `which contract needs renewal`, `which bank transactions need review`, `generate a GST CSV from verified records`, `generate an MIS workbook in Excel`, and `what advisory opportunities do you see from verified records?`",
    "Success looks like this: Gmail items sync into processing, the full client pack raises evidence coverage, validation issues become visible, financial memory links customers/vendors/contracts, Ask Fynny answers each use case from verified records, and MIS/GST outputs download in the requested format.",
    `Use these sample assets for the single-client walkthrough: /samples/email-demo/fynny-email-sales-invoice-solid.csv, /samples/email-demo/fynny-email-contract-renewal.csv, /samples/email-demo/fynny-email-gst-summary.csv, /samples/email-demo/test-playbook.md, /samples/fynny-aster-foods-correlated-test-pack.zip, /samples/aster-foods/test_scenarios.md, and /samples/aster-foods/client-demo-playbook.md.${gmailConnected ? " Gmail is already connected, so start with the email attachments and then upload the full Aster Foods pack." : " Connect Gmail first, then start with the email attachments and full Aster Foods pack."}`
  ].join("\n\n");
}

function blockAfterAutomation(error: string, readiness?: ReadinessRow, syncNotes: string[] = []) {
  const guidance = buildReadinessTrainingGuidance(readiness);
  return {
    ok: false as const,
    status: 428,
    error: [error, ...syncNotes].filter(Boolean).join(" "),
    trainingGuidance: guidance
  };
}

export async function handleAskQuestion(clientId: string, input: AskInput) {
  const actions = parsePromptActions(input.question);
  const sourcesResult = await listDataSources(clientId);
  const sources = sourcesResult.ok ? ((sourcesResult.data as { dataSources?: DataSourceRow[] }).dataSources ?? []) : [];
  const readinessResult = await getIntelligenceReadiness(clientId);
  const readiness = readinessResult.ok ? readinessResult.data as ReadinessRow : undefined;

  if (actions.wantsDemoGuide || actions.wantsSamples) {
    return {
      ok: true as const,
      data: {
        answer: buildEmailDemoAnswer({ readiness, sources }),
        question: input.question,
        readiness,
        actions: {
          sampleFiles: [
            "/samples/email-demo/fynny-email-sales-invoice-solid.csv",
            "/samples/email-demo/fynny-email-contract-renewal.csv",
            "/samples/email-demo/fynny-email-gst-summary.csv",
            "/samples/email-demo/test-playbook.md",
            "/samples/fynny-aster-foods-correlated-test-pack.zip",
            "/samples/aster-foods/test_scenarios.md",
            "/samples/aster-foods/client-demo-playbook.md"
          ],
          suggestedPrompts: [
            "sync Gmail and process the new finance emails",
            "who are our top customers this quarter",
            "which invoices are overdue",
            "which vendor bill is oldest unpaid",
            "why does April GST not match sales",
            "did payroll increase in June",
            "which contract needs renewal",
            "which bank transactions need review",
            "generate a GST CSV from verified records",
            "generate an MIS workbook in Excel",
            "what advisory opportunities do you see from verified records?"
          ]
        }
      }
    };
  }

  if (actions.wantsCollection) {
    if (!input.firmId) {
      return {
        ok: false as const,
        status: 403,
        error: "Firm context is required to answer collection queue questions."
      };
    }
    const pendingResult = await listPendingSubmissions(input.firmId);
    if (!pendingResult.ok) return pendingResult;
    const data = pendingResult.data as { pending: Array<Record<string, unknown>>; health: Record<string, unknown> };
    const pending = data.pending ?? [];
    const overdue = pending.filter((row) => Number(row.days_overdue ?? 0) > 0);
    const dueToday = pending.filter((row) => row.computed_reminder_status === "due_today");
    const highPriority = pending.filter((row) => row.priority === "high");
    const topRows = pending.slice(0, 6).map((row) => {
      const client = String(row.client_name ?? "Client");
      const item = String(row.required_item ?? row.document_category ?? "Document");
      const due = String(row.due_date ?? "No due date");
      const days = Number(row.days_overdue ?? 0);
      const status = titleCase(String(row.computed_reminder_status ?? row.reminder_status ?? "awaiting_client"));
      return `${client}: ${item}, due ${due}, ${days} day${days === 1 ? "" : "s"} overdue, status ${status}.`;
    });
    const reminderPrompt = pending.length
      ? `To generate reminder copy, use Collection Queue or ask: generate reminder for ${String(pending[0].client_name ?? "the first overdue client")}.`
      : "No reminder is needed right now.";
    return {
      ok: true as const,
      data: {
        answer: [
          `Collection Health: ${pending.length} pending submissions, ${overdue.length} overdue, ${dueToday.length} due today, ${highPriority.length} high priority, ${Number(data.health?.reportsBlocked ?? overdue.length)} reports blocked.`,
          topRows.length ? `Queue: ${topRows.join(" ")}` : "No clients have pending submission requests.",
          reminderPrompt
        ].join(" "),
        question: input.question,
        actions: {
          collectionHealth: data.health,
          pendingSubmissions: pending.slice(0, 10)
        }
      }
    };
  }

  const syncNotes: string[] = [];
  const syncedSources: Array<{ provider: string; sourceType: string; message: string; fileCount: number }> = [];

  const shouldAutoSyncForOutput = (actions.wantsReport || actions.wantsExport) && !readiness?.intelligenceReady;
  if (actions.wantsSync || shouldAutoSyncForOutput) {
    const matchingSources = sources.filter((source) => {
      if (!actions.syncProvider || shouldAutoSyncForOutput) return ["gmail", "google_drive", "zoho_books"].includes(source.source_type);
      return source.source_type === actions.syncProvider;
    });

    if (!matchingSources.length && actions.wantsSync) {
      const requestedSource = actions.syncProvider ? titleCase(actions.syncProvider) : "an integration";
      const connectHint = actions.syncProvider === "gmail"
        ? "Go to Data Sources, choose the client, connect Gmail, complete Google OAuth, then send/keep financial attachments in that inbox."
        : actions.syncProvider === "google_drive"
          ? "Go to Data Sources, choose the client, connect Google Drive, complete Google OAuth, then place financial files in Drive."
          : actions.syncProvider === "zoho_books"
            ? "Go to Data Sources, choose the client, connect Zoho Books, and complete Zoho OAuth."
            : "Go to Data Sources, choose the client, connect Gmail, Google Drive, or Zoho Books, then run the same prompt again.";
      return {
        ok: false as const,
        status: 409,
        error: `I could not find a connected ${requestedSource} source for this client. ${connectHint}`
      };
    }

    for (const source of matchingSources.slice(0, 2)) {
      const syncResult = await syncDataSource(clientId, source.id);
      if (!syncResult.ok) {
        return {
          ok: false as const,
          status: syncResult.status,
          error: syncResult.error
        };
      }
      const syncData = syncResult.data as { message?: string; collected?: { fileCount?: number } };
      const fileCount = syncData.collected?.fileCount ?? 0;
      const note = syncData.message ?? `Synced ${fileCount} financial items from ${titleCase(source.source_type)}.`;
      syncNotes.push(note);
      syncedSources.push({
        provider: source.provider,
        sourceType: source.source_type,
        message: note,
        fileCount
      });
    }

    if (actions.wantsSync && !actions.wantsReport && !actions.wantsExport) {
      const postSyncReadiness = await getIntelligenceReadiness(clientId);
      const postSyncData = postSyncReadiness.ok ? postSyncReadiness.data as ReadinessRow : readiness;
      const totalFiles = syncedSources.reduce((sum, source) => sum + source.fileCount, 0);
      return {
        ok: true as const,
        data: {
          answer: [
            syncNotes.length ? syncNotes.join(" ") : "Fetch completed for the connected source.",
            totalFiles
              ? "I routed the fetched financial items into the Processing Layer for collection, classification, validation, normalization, memory build, and Intelligence Ready checks."
              : "I did not find matching financial files with the current source filters. Try sending/uploading invoice, GST, bank statement, contract, payment, TDS, tax, bill, or statement files, then run the fetch prompt again.",
            postSyncData
              ? `Current Intelligence Readiness is ${postSyncData.score}%. ${postSyncData.intelligenceReady ? "The client is ready for Ask Fynny reports and exports." : "If it is not ready yet, open Processing or Validation to see missing inputs and blockers."}`
              : "Readiness will update after processing completes."
          ].join(" "),
          question: input.question,
          readiness: postSyncData,
          actions: {
            syncedSources
          }
        }
      };
    }
  }

  if (actions.wantsReport || actions.wantsExport) {
    const postSyncReadiness = await getIntelligenceReadiness(clientId);
    const postSyncData = postSyncReadiness.ok ? postSyncReadiness.data as ReadinessRow : readiness;
    if (!postSyncData?.intelligenceReady) {
      return blockAfterAutomation(
        "I processed the available integration data, but this client is still not Intelligence Ready for report generation.",
        postSyncData,
        syncNotes
      );
    }

    let createdReport: { id: string; reportType: string; status: string } | undefined;
    let createdExport:
      | {
          id: string;
          exportType: string;
          fileFormat: string;
          file?: { filename: string; storageUrl: string };
        }
      | undefined;

    if (actions.wantsReport) {
      const reportResult = await generateReport(clientId, {
        firmId: input.firmId,
        reportType: actions.reportType
      });
      if (!reportResult.ok) {
        return blockAfterAutomation(reportResult.error, postSyncData, syncNotes);
      }
      const reportData = reportResult.data as { id: string; report_type: string; status: string };
      createdReport = {
        id: reportData.id,
        reportType: reportData.report_type,
        status: reportData.status
      };
    }

    if (actions.wantsExport) {
      const exportResult = await generateExport(clientId, {
        firmId: input.firmId,
        exportType: actions.exportType,
        fileFormat: actions.fileFormat
      });
      if (!exportResult.ok) {
        return blockAfterAutomation(exportResult.error, postSyncData, syncNotes);
      }
      const exportData = exportResult.data as { id: string; export_type: string; file_format: string; file?: { filename: string; storageUrl: string } };
      createdExport = {
        id: exportData.id,
        exportType: exportData.export_type,
        fileFormat: exportData.file_format,
        file: exportData.file
      };
    }

    const answerParts = [
      syncNotes.length ? syncNotes.join(" ") : "",
      createdReport ? `I created a ${titleCase(createdReport.reportType)} report for this client.` : "",
      createdExport ? `I also prepared a ${titleCase(createdExport.exportType)} export in ${createdExport.fileFormat.toUpperCase()} format.` : "",
      "The output uses verified records only and stays inside the Intelligence Ready guardrail."
    ].filter(Boolean);

    return {
      ok: true as const,
      data: {
        answer: answerParts.join(" "),
        question: input.question,
        readiness: postSyncData,
        actions: {
          syncedSources,
          report: createdReport,
          export: createdExport
        }
      }
    };
  }

  const answerResult = await answerMvpQuestion(clientId, input);
  if (!answerResult.ok) {
    if (!syncNotes.length) return answerResult;
    return blockAfterAutomation(answerResult.error, readiness, syncNotes);
  }

  const resultData = answerResult.data as {
    answer: string;
    question: string;
    readiness: ReadinessRow;
    intelligence?: unknown;
    exportModel?: unknown;
    evidence?: unknown;
  };

  return {
    ...answerResult,
    data: {
      ...resultData,
      answer: syncNotes.length ? `${syncNotes.join(" ")} ${resultData.answer}` : resultData.answer,
      actions: syncNotes.length ? { syncedSources } : undefined
    }
  };
}
