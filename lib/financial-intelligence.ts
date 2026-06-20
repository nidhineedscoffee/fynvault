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
    nextBestActions,
    confidence: input.readiness.score >= 90 && evidenceCount >= 5 ? "high" : input.readiness.score >= 80 && evidenceCount >= 2 ? "medium" : "low"
  };
}

export function buildReadinessTrainingGuidance(readiness?: ReadinessProfile) {
  if (!readiness) {
    return ["Create the client workspace.", "Connect or upload source data.", "Run processing until Intelligence Ready is true."];
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
