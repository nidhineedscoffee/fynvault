import type { DashboardModel, FinancialGraph, MetricEvidence, MetricResult, RiskAlert } from "./types";

const currentPeriod = "2026-06";
const priorPeriod = "2026-05";

function money(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function safeDivide(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function maxPercent(rows: number[], total: number) {
  if (!rows.length || total <= 0) {
    return 0;
  }

  return Math.max(...rows.map((value) => safeDivide(value, total) * 100));
}

function evidenceFor(graph: FinancialGraph, ids: string[]): MetricEvidence[] {
  return ids
    .map((id) => graph.evidence.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ sourceId: item.id, label: item.label, source: item.source }));
}

function metric(
  id: string,
  label: string,
  value: number,
  unit: MetricResult["unit"],
  formula: string,
  evidence: MetricEvidence[]
): MetricResult {
  return { id, label, value: money(value), unit, formula, evidence };
}

export function calculateMetrics(graph: FinancialGraph): Record<string, MetricResult> {
  const invoices = graph.invoices;
  const expenses = graph.expenses;
  const bills = graph.bills;
  const payments = graph.payments;

  const currentRevenueInvoices = invoices.filter((invoice) => monthOf(invoice.issuedAt) === currentPeriod);
  const priorRevenueInvoices = invoices.filter((invoice) => monthOf(invoice.issuedAt) === priorPeriod);
  const currentRevenue = currentRevenueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const priorRevenue = priorRevenueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const revenueGrowth = safeDivide(currentRevenue - priorRevenue, priorRevenue) * 100;
  const averageInvoiceValue = safeDivide(
    invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    invoices.length
  );
  const totalReceivables = invoices.filter((invoice) => invoice.status !== "paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue");
  const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidInvoiceTotal = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const collectionEfficiency = safeDivide(
    paidInvoiceTotal,
    invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  ) * 100;
  const dso = totalReceivables / Math.max(currentRevenue / 30, 1);
  const cashInflow = payments.filter((payment) => monthOf(payment.paidAt) === priorPeriod).reduce((sum, payment) => sum + payment.amount, 0);
  const cashOutflow = expenses.filter((expense) => monthOf(expense.incurredAt) === priorPeriod).reduce((sum, expense) => sum + expense.amount, 0);
  const operatingCashFlow = cashInflow - cashOutflow;
  const monthlyBurn = Math.max(cashOutflow - cashInflow, expenses.reduce((sum, expense) => sum + expense.amount, 0) / 3);
  const runwayMonths = graph.organization.cashBalance / Math.max(monthlyBurn, 1);
  const currentExpenses = expenses.filter((expense) => monthOf(expense.incurredAt) === currentPeriod).reduce((sum, expense) => sum + expense.amount, 0);
  const priorExpenses = expenses.filter((expense) => monthOf(expense.incurredAt) === priorPeriod).reduce((sum, expense) => sum + expense.amount, 0);
  const expenseGrowth = safeDivide(currentExpenses - priorExpenses, priorExpenses) * 100;
  const grossMargin = safeDivide(currentRevenue - currentExpenses, currentRevenue) * 100;
  const netMargin = safeDivide(currentRevenue - currentExpenses - 24000, currentRevenue) * 100;
  const ebitda = currentRevenue - currentExpenses - 18000;
  const outstandingBills = bills.filter((bill) => bill.status === "open").reduce((sum, bill) => sum + bill.amount, 0);

  const revenueByCustomer = graph.customers.map((customer) => ({
    customer,
    total: invoices.filter((invoice) => invoice.customerId === customer.id).reduce((sum, invoice) => sum + invoice.amount, 0)
  }));
  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const revenueConcentration = maxPercent(
    revenueByCustomer.map((row) => row.total),
    totalRevenue
  );
  const expenseByVendor = graph.vendors.map((vendor) => ({
    vendor,
    total: expenses.filter((expense) => expense.vendorId === vendor.id).reduce((sum, expense) => sum + expense.amount, 0)
  }));
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const vendorConcentration = maxPercent(
    expenseByVendor.map((row) => row.total),
    totalExpenses
  );

  const invoiceEvidence = evidenceFor(graph, invoices.flatMap((invoice) => invoice.evidenceIds));
  const currentInvoiceEvidence = evidenceFor(graph, currentRevenueInvoices.flatMap((invoice) => invoice.evidenceIds));
  const expenseEvidence = evidenceFor(graph, expenses.flatMap((expense) => expense.evidenceIds));
  const currentExpenseEvidence = evidenceFor(graph, expenses.filter((expense) => monthOf(expense.incurredAt) === currentPeriod).flatMap((expense) => expense.evidenceIds));
  const billEvidence = evidenceFor(graph, bills.flatMap((bill) => bill.evidenceIds));
  const paymentEvidence = evidenceFor(graph, payments.flatMap((payment) => payment.evidenceIds));

  return {
    revenue: metric("revenue", "Revenue", currentRevenue, "currency", "sum(invoice.amount where issued month = 2026-06)", currentInvoiceEvidence),
    revenueGrowth: metric("revenueGrowth", "Revenue Growth", revenueGrowth, "percent", "(current month revenue - prior month revenue) / prior month revenue", invoiceEvidence),
    revenueConcentration: metric("revenueConcentration", "Revenue Concentration", revenueConcentration, "percent", "max(customer revenue) / total revenue", invoiceEvidence),
    averageInvoiceValue: metric("averageInvoiceValue", "Average Invoice Value", averageInvoiceValue, "currency", "sum(invoice.amount) / count(invoices)", invoiceEvidence),
    receivables: metric("receivables", "Receivables", totalReceivables, "currency", "sum(open and overdue invoice amount)", invoiceEvidence),
    overdueAmount: metric("overdueAmount", "Overdue Invoices", overdueAmount, "currency", "sum(overdue invoice amount)", evidenceFor(graph, overdueInvoices.flatMap((invoice) => invoice.evidenceIds))),
    collectionEfficiency: metric("collectionEfficiency", "Collection Efficiency", collectionEfficiency, "percent", "paid invoice value / total invoice value", [...invoiceEvidence, ...paymentEvidence]),
    dso: metric("dso", "DSO", dso, "count", "receivables / average daily revenue", invoiceEvidence),
    cashBalance: metric("cashBalance", "Cash Position", graph.organization.cashBalance, "currency", "latest normalized bank cash balance", [{ sourceId: "org_cash", label: "Demo bank balance snapshot", source: "bank" }]),
    cashInflow: metric("cashInflow", "Cash Inflow", cashInflow, "currency", "sum(payments paid in 2026-05)", paymentEvidence),
    cashOutflow: metric("cashOutflow", "Cash Outflow", cashOutflow, "currency", "sum(expenses incurred in 2026-05)", expenseEvidence),
    operatingCashFlow: metric("operatingCashFlow", "Operating Cash Flow", operatingCashFlow, "currency", "cash inflow - cash outflow", [...paymentEvidence, ...expenseEvidence]),
    monthlyBurn: metric("monthlyBurn", "Monthly Burn", monthlyBurn, "currency", "max(prior month net burn, 3-month average expenses)", expenseEvidence),
    runway: metric("runway", "Runway", runwayMonths, "months", "cash balance / monthly burn", expenseEvidence),
    expenses: metric("expenses", "Expenses", currentExpenses, "currency", "sum(expense.amount where incurred month = 2026-06)", currentExpenseEvidence),
    expenseGrowth: metric("expenseGrowth", "Expense Growth", expenseGrowth, "percent", "(current month expenses - prior month expenses) / prior month expenses", expenseEvidence),
    grossMargin: metric("grossMargin", "Gross Margin", grossMargin, "percent", "(revenue - direct expenses) / revenue", [...currentInvoiceEvidence, ...currentExpenseEvidence]),
    netMargin: metric("netMargin", "Net Margin", netMargin, "percent", "(revenue - expenses - normalized overhead) / revenue", [...currentInvoiceEvidence, ...currentExpenseEvidence]),
    ebitda: metric("ebitda", "EBITDA", ebitda, "currency", "revenue - operating expenses - normalized adjustments", [...currentInvoiceEvidence, ...currentExpenseEvidence]),
    payables: metric("payables", "Payables", outstandingBills, "currency", "sum(open bill amount)", billEvidence),
    vendorConcentration: metric("vendorConcentration", "Vendor Dependency", vendorConcentration, "percent", "max(vendor expense) / total expenses", expenseEvidence)
  };
}

function componentScore(value: number, good: number, bad: number, reverse = false) {
  const ratio = reverse ? (bad - value) / (bad - good) : (value - bad) / (good - bad);
  return Math.max(0, Math.min(100, ratio * 100));
}

export function calculateHealthScore(metrics: Record<string, MetricResult>) {
  const components = {
    cashFlow: componentScore(metrics.operatingCashFlow.value, 90000, -90000),
    runway: componentScore(metrics.runway.value, 12, 3),
    collections: componentScore(metrics.collectionEfficiency.value, 80, 30),
    revenue: componentScore(metrics.revenueGrowth.value, 20, -20),
    profitability: componentScore(metrics.netMargin.value, 25, -25),
    expenses: componentScore(metrics.expenseGrowth.value, -10, 30, true),
    vendorRisk: componentScore(metrics.vendorConcentration.value, 20, 60, true)
  };

  const score =
    components.cashFlow * 0.25 +
    components.runway * 0.2 +
    components.collections * 0.15 +
    components.revenue * 0.15 +
    components.profitability * 0.1 +
    components.expenses * 0.1 +
    components.vendorRisk * 0.05;

  return {
    score: Math.round(score),
    status: score >= 75 ? "Healthy" : score >= 50 ? "Warning" : "Critical",
    components
  } as const;
}

export function calculateRisks(graph: FinancialGraph, metrics: Record<string, MetricResult>): RiskAlert[] {
  const risks: RiskAlert[] = [];

  if (metrics.runway.value < 6) {
    risks.push({
      id: "risk_runway",
      severity: "critical",
      title: "Runway below 6 months",
      reason: `Runway is ${metrics.runway.value} months based on cash balance and burn.`,
      impact: "Leadership has limited time to reduce burn, collect receivables, or secure financing.",
      supportingData: [metrics.runway, metrics.monthlyBurn, metrics.cashBalance],
      recommendedAction: "Create a 30-day cash preservation plan and prioritize overdue collections."
    });
  }

  if (metrics.overdueAmount.value > 150000) {
    risks.push({
      id: "risk_overdue",
      severity: "warning",
      title: "Overdue invoices are elevated",
      reason: `Overdue invoices total ${metrics.overdueAmount.value}.`,
      impact: "Cash conversion may slip and runway may compress if collections remain delayed.",
      supportingData: [metrics.overdueAmount, metrics.receivables, metrics.dso],
      recommendedAction: "Send payment reminders to Aurora Retail and Cinder Foods with invoice evidence attached."
    });
  }

  if (metrics.revenueConcentration.value > 30) {
    risks.push({
      id: "risk_concentration",
      severity: "warning",
      title: "Revenue concentration above threshold",
      reason: `Largest customer concentration is ${metrics.revenueConcentration.value}%.`,
      impact: "A delayed renewal or payment from one account could materially affect revenue visibility.",
      supportingData: [metrics.revenueConcentration, metrics.revenue],
      recommendedAction: "Prepare expansion pipeline coverage and monitor Aurora renewal activity."
    });
  }

  if (metrics.vendorConcentration.value > 45) {
    risks.push({
      id: "risk_vendor",
      severity: "info",
      title: "Vendor dependency requires review",
      reason: `Largest vendor concentration is ${metrics.vendorConcentration.value}%.`,
      impact: "A pricing change from a critical vendor could move gross margin quickly.",
      supportingData: [metrics.vendorConcentration, metrics.expenses],
      recommendedAction: "Benchmark Cloudgrid spend and set a usage review before the next renewal."
    });
  }

  const renewal = graph.emails.find((email) => email.category === "contract_renewal");
  if (renewal) {
    risks.push({
      id: "risk_contract_renewal",
      severity: "info",
      title: "Contract renewal activity detected",
      reason: `${renewal.subject} is active in Gmail communication history.`,
      impact: "Renewal terms may affect forward revenue and collection predictability.",
      supportingData: [metrics.revenue],
      recommendedAction: "Create a renewal brief with account history, unpaid invoices, and proposed terms."
    });
  }

  return risks;
}

export function buildDashboardModel(graph: FinancialGraph): Omit<DashboardModel, "healthScore"> & {
  healthScore: ReturnType<typeof calculateHealthScore>;
} {
  const metrics = calculateMetrics(graph);
  const healthScore = calculateHealthScore(metrics);
  const risks = calculateRisks(graph, metrics);

  return {
    generatedAt: new Date().toISOString(),
    organizationName: graph.organization.name,
    healthScore,
    metrics,
    risks,
    recentActions: [
      "Drafted Aurora payment reminder",
      "Prepared weekly CFO summary",
      "Flagged Cinder renewal thread",
      "Queued Cloudgrid vendor review"
    ]
  };
}
