type EvidenceRow = Record<string, unknown>;

export type ReadinessProfile = {
  score: number;
  factors: Record<string, number>;
  blockers?: Record<string, number>;
};

type FinancialFormula = {
  id: string;
  label: string;
  formula: string;
  useWhen: string;
  guardrail: string;
};

type FinancialUseCase = {
  id: string;
  label: string;
  keywords: string[];
  intent: string;
  requiredEvidence: string[];
  formulas: string[];
  processChecks: string[];
};

export type ExportLayoutColumn = {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "currency" | "percent";
  formula?: string;
  source?: string;
};

export type ExportLayout = {
  id: string;
  label: string;
  description: string;
  columns: ExportLayoutColumn[];
  sheets: Array<{ name: string; purpose: string; columns: string[] }>;
  standardProcess: string[];
};

const formulas: FinancialFormula[] = [
  { id: "gross_margin", label: "Gross Margin", formula: "(Revenue - COGS) / Revenue * 100", useWhen: "Profitability and pricing quality", guardrail: "Needs validated revenue and cost of goods sold for the same period." },
  { id: "net_margin", label: "Net Profit Margin", formula: "Net Profit / Revenue * 100", useWhen: "Overall profitability", guardrail: "Needs finalized revenue, expenses, tax, and period close status." },
  { id: "ebitda_margin", label: "EBITDA Margin", formula: "EBITDA / Revenue * 100", useWhen: "Operating performance before financing and depreciation effects", guardrail: "Needs normalized EBITDA adjustments and consistent revenue period." },
  { id: "current_ratio", label: "Current Ratio", formula: "Current Assets / Current Liabilities", useWhen: "Short-term solvency", guardrail: "Needs current balance sheet classifications." },
  { id: "quick_ratio", label: "Quick Ratio", formula: "(Cash + Marketable Securities + Receivables) / Current Liabilities", useWhen: "Liquidity excluding inventory", guardrail: "Needs validated cash, receivables, and current liabilities." },
  { id: "dso", label: "Days Sales Outstanding", formula: "Average Accounts Receivable / Credit Sales * Days", useWhen: "Receivables collection efficiency", guardrail: "Needs receivable aging and credit sales for the same period." },
  { id: "dpo", label: "Days Payable Outstanding", formula: "Average Accounts Payable / COGS * Days", useWhen: "Vendor payment behavior", guardrail: "Needs payable aging and matched purchase/COGS records." },
  { id: "cash_runway", label: "Cash Runway", formula: "Cash Balance / Average Monthly Net Burn", useWhen: "How long cash can sustain operations", guardrail: "Needs bank balance and normalized monthly burn." },
  { id: "burn_rate", label: "Net Burn Rate", formula: "Cash Outflows - Cash Inflows", useWhen: "Monthly cash pressure", guardrail: "Needs bank statement transactions and normalized operating flows." },
  { id: "working_capital", label: "Net Working Capital", formula: "Current Assets - Current Liabilities", useWhen: "Operational liquidity and funding gap", guardrail: "Needs current asset/liability classification." },
  { id: "gst_payable", label: "GST Payable", formula: "Output GST - Eligible Input GST Credit", useWhen: "GST liability and compliance review", guardrail: "Needs GST sales, purchase, ITC eligibility, and filing period." },
  { id: "tds_payable", label: "TDS Payable", formula: "TDS Deducted - TDS Deposited", useWhen: "TDS compliance and outstanding liability", guardrail: "Needs deduction records, challans, and due dates." },
  { id: "revenue_growth", label: "Revenue Growth", formula: "(Current Period Revenue - Prior Period Revenue) / Prior Period Revenue * 100", useWhen: "Growth and trend analysis", guardrail: "Needs comparable periods and normalized revenue." },
  { id: "expense_variance", label: "Expense Variance", formula: "Actual Expense - Budget or Prior Period Expense", useWhen: "Cost control and anomaly detection", guardrail: "Needs mapped expense categories across comparable periods." }
];

const useCases: FinancialUseCase[] = [
  {
    id: "cash_flow",
    label: "Cash Flow Intelligence",
    keywords: ["cash", "runway", "burn", "bank", "liquidity", "inflow", "outflow", "working capital"],
    intent: "Explain cash movement, runway, liquidity pressure, and working-capital risks.",
    requiredEvidence: ["bank statements", "cash balances", "receivables", "payables", "normalized transactions"],
    formulas: ["cash_runway", "burn_rate", "working_capital", "current_ratio", "quick_ratio"],
    processChecks: ["Bank statement period coverage", "Duplicate transaction detection", "Operating vs non-operating classification", "Reconciliation status"]
  },
  {
    id: "receivables",
    label: "Receivables and Collection Risk",
    keywords: ["receivable", "debtors", "collection", "invoice", "overdue", "dso", "customer outstanding"],
    intent: "Identify delayed collections, aging risks, and customer-level attention items.",
    requiredEvidence: ["sales register", "invoice records", "payment records", "customer ledger"],
    formulas: ["dso", "revenue_growth"],
    processChecks: ["Invoice-payment matching", "Aging bucket validation", "Duplicate invoice checks", "Customer master consistency"]
  },
  {
    id: "payables",
    label: "Payables and Vendor Pressure",
    keywords: ["payable", "vendor", "supplier", "dpo", "purchase", "creditor", "bill"],
    intent: "Review vendor exposure, payment timing, and short-term obligations.",
    requiredEvidence: ["purchase register", "vendor ledger", "payment records", "bank statements"],
    formulas: ["dpo", "working_capital"],
    processChecks: ["Vendor matching", "Purchase-payment reconciliation", "Due-date validation", "Duplicate bill detection"]
  },
  {
    id: "gst",
    label: "GST Compliance",
    keywords: ["gst", "gstr", "itc", "tax", "filing", "compliance", "input credit"],
    intent: "Validate GST readiness, missing filing inputs, ITC gaps, and tax liability.",
    requiredEvidence: ["GST returns", "sales register", "purchase register", "ITC records", "tax challans"],
    formulas: ["gst_payable"],
    processChecks: ["GST period completeness", "Sales-purchase reconciliation", "ITC eligibility", "Missing challan checks"]
  },
  {
    id: "tds",
    label: "TDS Compliance",
    keywords: ["tds", "deduction", "challan", "26q", "24q", "withholding"],
    intent: "Detect TDS payable, deposit gaps, and filing readiness.",
    requiredEvidence: ["TDS deductions", "challans", "vendor payments", "payroll records"],
    formulas: ["tds_payable"],
    processChecks: ["Deduction-deposit matching", "Due-date validation", "PAN/vendor mapping", "Payroll reconciliation"]
  },
  {
    id: "profitability",
    label: "Profitability and MIS",
    keywords: ["profit", "margin", "mis", "p&l", "income", "expense", "ebitda", "revenue"],
    intent: "Explain margin movement, cost drivers, and MIS-ready insights.",
    requiredEvidence: ["P&L records", "sales register", "expense ledger", "normalized chart of accounts"],
    formulas: ["gross_margin", "net_margin", "ebitda_margin", "expense_variance", "revenue_growth"],
    processChecks: ["Period close status", "Expense normalization", "Revenue recognition consistency", "Exceptional item review"]
  },
  {
    id: "advisory",
    label: "Advisory Opportunities",
    keywords: ["advisory", "opportunity", "recommend", "risk", "improve", "action", "insight"],
    intent: "Surface evidence-backed advisory opportunities without making unsupported claims.",
    requiredEvidence: ["readiness profile", "validation issues", "financial memory", "intelligence datasets"],
    formulas: ["working_capital", "dso", "dpo", "gross_margin", "cash_runway"],
    processChecks: ["Readiness gate", "Evidence coverage", "Risk severity", "Client impact framing"]
  }
];

const exportLayouts: Record<string, ExportLayout> = {
  cash_flow: {
    id: "bank_summary",
    label: "Cash Flow Export",
    description: "Bank-led cash movement model with inflow, outflow, net cash position, and runway review.",
    columns: [
      { key: "period", label: "Period", type: "text", source: "document month/year or transaction date" },
      { key: "opening_balance", label: "Opening Balance", type: "currency", source: "bank statement" },
      { key: "cash_inflow", label: "Cash Inflow", type: "currency", formula: "SUM(receipts + sales collections)" },
      { key: "cash_outflow", label: "Cash Outflow", type: "currency", formula: "SUM(payments + purchases + expenses)" },
      { key: "net_cash_position", label: "Net Cash Position", type: "currency", formula: "Cash Inflow - Cash Outflow" },
      { key: "closing_balance", label: "Closing Balance", type: "currency", formula: "Opening Balance + Net Cash Position" },
      { key: "runway_months", label: "Runway Months", type: "number", formula: "Cash Balance / Average Monthly Net Burn" },
      { key: "reconciliation_status", label: "Reconciliation Status", type: "text", source: "processing validation" }
    ],
    sheets: [
      { name: "Cash Summary", purpose: "Monthly cash position and runway", columns: ["Period", "Cash Inflow", "Cash Outflow", "Net Cash Position", "Runway Months"] },
      { name: "Formula Audit", purpose: "Formula and evidence traceability", columns: ["Metric", "Formula", "Required Evidence", "Guardrail"] }
    ],
    standardProcess: ["Confirm bank statement period coverage.", "Classify inflows and outflows.", "Reconcile totals to source statements.", "Calculate net cash and runway only from validated rows."]
  },
  receivables: {
    id: "cleaned_sales_register",
    label: "Receivables Export",
    description: "Customer invoice and collection-risk layout for sales register cleanup and aging.",
    columns: [
      { key: "customer_name", label: "Customer Name", type: "text", source: "sales register" },
      { key: "invoice_no", label: "Invoice No", type: "text", source: "sales register" },
      { key: "invoice_date", label: "Invoice Date", type: "date", source: "sales register" },
      { key: "due_date", label: "Due Date", type: "date", source: "invoice terms" },
      { key: "invoice_amount", label: "Invoice Amount", type: "currency", source: "sales register" },
      { key: "outstanding_amount", label: "Outstanding Amount", type: "currency", formula: "Invoice Amount - Receipts Matched" },
      { key: "aging_bucket", label: "Aging Bucket", type: "text", formula: "TODAY() - Due Date grouped into 0-30/31-60/61-90/90+" },
      { key: "dso_basis", label: "DSO Basis", type: "number", formula: "Average Accounts Receivable / Credit Sales * Days" },
      { key: "risk_level", label: "Risk Level", type: "text", source: "validation and aging rules" }
    ],
    sheets: [
      { name: "Receivables Aging", purpose: "Customer-wise outstanding and aging", columns: ["Customer Name", "Invoice No", "Due Date", "Outstanding Amount", "Aging Bucket", "Risk Level"] },
      { name: "Collection Actions", purpose: "Review and follow-up queue", columns: ["Customer Name", "Risk Level", "Evidence", "Recommended Action"] }
    ],
    standardProcess: ["Deduplicate invoice numbers.", "Match receipts to invoices.", "Bucket invoices by due-date aging.", "Flag high-risk customers without estimating unsupported values."]
  },
  payables: {
    id: "cleaned_purchase_register",
    label: "Payables Export",
    description: "Vendor bill and payment-pressure layout for purchase register cleanup.",
    columns: [
      { key: "vendor_name", label: "Vendor Name", type: "text", source: "purchase register" },
      { key: "bill_no", label: "Bill No", type: "text", source: "purchase register" },
      { key: "bill_date", label: "Bill Date", type: "date", source: "purchase register" },
      { key: "due_date", label: "Due Date", type: "date", source: "vendor terms" },
      { key: "bill_amount", label: "Bill Amount", type: "currency", source: "purchase register" },
      { key: "outstanding_amount", label: "Outstanding Amount", type: "currency", formula: "Bill Amount - Payments Matched" },
      { key: "aging_bucket", label: "Aging Bucket", type: "text", formula: "TODAY() - Due Date grouped into 0-30/31-60/61-90/90+" },
      { key: "priority", label: "Payment Priority", type: "text", source: "risk rules and due dates" }
    ],
    sheets: [
      { name: "Payables Aging", purpose: "Vendor-wise exposure and due dates", columns: ["Vendor Name", "Bill No", "Due Date", "Outstanding Amount", "Aging Bucket", "Priority"] },
      { name: "Cash Planning", purpose: "Payment pressure by period", columns: ["Period", "Payables Due", "Cash Impact", "Recommended Action"] }
    ],
    standardProcess: ["Deduplicate vendor bills.", "Match payments to bills.", "Validate due dates.", "Prioritize payables from actual due dates and cash evidence."]
  },
  gst: {
    id: "gst_ready_data",
    label: "GST Ready Export",
    description: "GST reconciliation layout for output tax, eligible ITC, payable estimate, and mismatch review.",
    columns: [
      { key: "period", label: "Period", type: "text", source: "GST filing period" },
      { key: "outward_taxable_value", label: "Outward Taxable Value", type: "currency", source: "sales register/GSTR" },
      { key: "output_gst", label: "Output GST", type: "currency", formula: "CGST + SGST + IGST on outward supplies" },
      { key: "inward_taxable_value", label: "Inward Taxable Value", type: "currency", source: "purchase register/GSTR" },
      { key: "eligible_itc", label: "Eligible ITC", type: "currency", formula: "Eligible CGST + SGST + IGST credit" },
      { key: "gst_payable", label: "GST Payable", type: "currency", formula: "Output GST - Eligible Input GST Credit" },
      { key: "mismatch_status", label: "Mismatch Status", type: "text", source: "validation issues" }
    ],
    sheets: [
      { name: "GST Summary", purpose: "Period-wise GST readiness", columns: ["Period", "Output GST", "Eligible ITC", "GST Payable", "Mismatch Status"] },
      { name: "Mismatch Review", purpose: "Exceptions requiring CA review", columns: ["Period", "Issue", "Severity", "Suggested Fix"] }
    ],
    standardProcess: ["Validate GST period completeness.", "Reconcile sales and purchase registers.", "Check ITC eligibility.", "Calculate GST payable only after mismatch review."]
  },
  profitability: {
    id: "mis_report",
    label: "MIS Export",
    description: "MIS model for revenue, gross margin, EBITDA, net margin, variance, and advisory notes.",
    columns: [
      { key: "period", label: "Period", type: "text", source: "financial records" },
      { key: "revenue", label: "Revenue", type: "currency", source: "sales records" },
      { key: "direct_cost", label: "Direct Cost", type: "currency", source: "purchase/COGS records" },
      { key: "gross_margin", label: "Gross Margin %", type: "percent", formula: "(Revenue - COGS) / Revenue * 100" },
      { key: "opex", label: "Operating Expense", type: "currency", source: "expense records" },
      { key: "ebitda_margin", label: "EBITDA Margin %", type: "percent", formula: "EBITDA / Revenue * 100" },
      { key: "net_margin", label: "Net Margin %", type: "percent", formula: "Net Profit / Revenue * 100" },
      { key: "variance_notes", label: "Variance Notes", type: "text", source: "rule explanation" }
    ],
    sheets: [
      { name: "MIS Summary", purpose: "Client-ready monthly operating view", columns: ["Period", "Revenue", "Gross Margin %", "EBITDA Margin %", "Net Margin %", "Variance Notes"] },
      { name: "Formula Audit", purpose: "Financial model formulas and guardrails", columns: ["Metric", "Formula", "Required Evidence", "Guardrail"] }
    ],
    standardProcess: ["Map records to a unified chart of accounts.", "Validate period close status.", "Calculate margins from normalized records.", "Explain variance using evidence instead of generic commentary."]
  },
  tds: {
    id: "client_summary",
    label: "Compliance Export",
    description: "TDS and compliance review layout for deposit status, filing readiness, and missing inputs.",
    columns: [
      { key: "deductee_name", label: "Deductee Name", type: "text", source: "TDS records" },
      { key: "payment_date", label: "Payment Date", type: "date", source: "payment records" },
      { key: "section", label: "TDS Section", type: "text", source: "TDS records" },
      { key: "gross_amount", label: "Gross Amount", type: "currency", source: "payment records" },
      { key: "tds_amount", label: "TDS Amount", type: "currency", formula: "TDS Deducted - TDS Deposited" },
      { key: "deposit_status", label: "Deposit Status", type: "text", source: "challan matching" },
      { key: "challan_ref", label: "Challan Reference", type: "text", source: "challans" }
    ],
    sheets: [
      { name: "TDS Review", purpose: "Deduction and deposit status", columns: ["Deductee Name", "Section", "Gross Amount", "TDS Amount", "Deposit Status"] },
      { name: "Missing Inputs", purpose: "Compliance data requests", columns: ["Input", "Why Needed", "Status", "Owner"] }
    ],
    standardProcess: ["Match deductions to deposits.", "Validate challans and due dates.", "Check PAN/vendor mapping.", "Flag missing inputs before filing conclusions."]
  },
  advisory: {
    id: "client_summary",
    label: "Advisory Export",
    description: "Evidence-backed advisory opportunity layout for risks, impact, and recommended action.",
    columns: [
      { key: "opportunity_type", label: "Opportunity Type", type: "text", source: "intelligence classification" },
      { key: "evidence", label: "Evidence", type: "text", source: "validated calculations and memory" },
      { key: "financial_impact", label: "Financial Impact", type: "text", source: "rules and formulas" },
      { key: "risk_level", label: "Risk Level", type: "text", source: "readiness and validation status" },
      { key: "recommended_action", label: "Recommended Action", type: "text", source: "advisory rules" }
    ],
    sheets: [
      { name: "Advisory Opportunities", purpose: "Evidence-backed advisory queue", columns: ["Opportunity Type", "Evidence", "Financial Impact", "Risk Level", "Recommended Action"] }
    ],
    standardProcess: ["Confirm Intelligence Ready gate.", "Use validation issues and memory events as evidence.", "Map opportunities to client impact.", "Avoid advice unsupported by source records."]
  }
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeRows(rows: EvidenceRow[], fallback: string) {
  if (!rows.length) return fallback;
  return rows
    .slice(0, 3)
    .map((row) => String(row.name ?? row.dataset_type ?? row.calculation_type ?? row.event_type ?? row.type ?? row.id ?? "verified record"))
    .join(", ");
}

function scoreUseCase(question: string, useCase: FinancialUseCase) {
  const lower = question.toLowerCase();
  return useCase.keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0);
}

export function classifyFinancialQuestion(question: string) {
  const scored = useCases
    .map((useCase) => ({ useCase, score: scoreUseCase(question, useCase) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.useCase);
  return scored.length ? scored.slice(0, 3) : [useCases.find((useCase) => useCase.id === "advisory") ?? useCases[0]];
}

export function getExportLayoutForUseCases(useCaseIds: string[]) {
  const first = useCaseIds.map((id) => exportLayouts[id]).find(Boolean);
  return first ?? exportLayouts.advisory;
}

export function getExportLayoutForType(exportType: string) {
  const layout = Object.values(exportLayouts).find((item) => item.id === exportType);
  return layout ?? exportLayouts.advisory;
}

export function buildFinancialIntelligenceAnswer(input: {
  question: string;
  readiness: ReadinessProfile;
  calculations: EvidenceRow[];
  datasets: EvidenceRow[];
  memoryEvents: EvidenceRow[];
}) {
  const matchedUseCases = classifyFinancialQuestion(input.question);
  const formulaIds = new Set(matchedUseCases.flatMap((useCase) => useCase.formulas));
  const matchedFormulas = formulas.filter((formula) => formulaIds.has(formula.id));
  const processChecks = Array.from(new Set(matchedUseCases.flatMap((useCase) => useCase.processChecks)));
  const requiredEvidence = Array.from(new Set(matchedUseCases.flatMap((useCase) => useCase.requiredEvidence)));
  const exportLayout = getExportLayoutForUseCases(matchedUseCases.map((useCase) => useCase.id));
  const evidenceCount = input.calculations.length + input.datasets.length + input.memoryEvents.length;
  const readinessFactors = Object.entries(input.readiness.factors)
    .map(([name, score]) => `${titleCase(name)} ${score}%`)
    .join("; ");
  const nextBestActions = [
    evidenceCount === 0 ? "Connect or upload more source records before issuing a client-facing conclusion." : "Review the cited calculations, datasets, and memory events before sharing the response.",
    "Use the formula guardrails below; do not compute values unless matching validated records exist.",
    "If a required evidence source is missing, raise a data request instead of guessing."
  ];

  return {
    answer: [
      `Fynny classified this as ${matchedUseCases.map((useCase) => useCase.label).join(", ")}.`,
      `The client is Intelligence Ready with a readiness score of ${input.readiness.score}%. Readiness factors: ${readinessFactors}.`,
      `For "${input.question}", I found ${input.calculations.length} calculation records, ${input.datasets.length} intelligence datasets, and ${input.memoryEvents.length} memory events.`,
      `Most relevant evidence: calculations (${summarizeRows(input.calculations, "none")}); datasets (${summarizeRows(input.datasets, "none")}); memory (${summarizeRows(input.memoryEvents, "none")}).`,
      `If you need a file, I can produce a ${exportLayout.label} using the standard ${exportLayout.columns.length}-column layout.`,
      "I will explain only what the verified evidence supports and will not invent financial values."
    ].join(" "),
    matchedUseCases: matchedUseCases.map((useCase) => ({
      id: useCase.id,
      label: useCase.label,
      intent: useCase.intent,
      requiredEvidence: useCase.requiredEvidence
    })),
    formulas: matchedFormulas.map((formula) => ({
      label: formula.label,
      formula: formula.formula,
      useWhen: formula.useWhen,
      guardrail: formula.guardrail
    })),
    processChecks,
    requiredEvidence,
    exportLayout,
    nextBestActions,
    confidence: input.readiness.score >= 90 && evidenceCount >= 5 ? "high" : input.readiness.score >= 80 && evidenceCount >= 2 ? "medium" : "low"
  };
}

export function buildReadinessTrainingGuidance(readiness?: ReadinessProfile) {
  if (!readiness) {
    return ["Add a client.", "Connect or upload source data.", "Run processing until Intelligence Ready is true."];
  }
  const blockers = readiness.blockers ?? {};
  const guidance: string[] = [];
  if (!blockers.jobs) guidance.push("Upload or connect at least one financial source so processing can start.");
  if (!blockers.normalizedRecords) guidance.push("Complete normalization into unified financial records.");
  if (!blockers.memoryEntities) guidance.push("Build financial memory entities for customers, vendors, accounts, and events.");
  if (!blockers.intelligenceDatasets) guidance.push("Generate intelligence datasets for cash flow, receivables, payables, GST, compliance, and advisory.");
  if (blockers.openCritical) guidance.push("Resolve critical validation issues before enabling intelligence answers.");
  return guidance.length ? guidance : ["Review readiness factors and add missing supporting evidence."];
}
