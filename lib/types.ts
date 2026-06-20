export type HealthStatus = "Healthy" | "Warning" | "Critical";
export type EvidenceSource = "zoho" | "gmail" | "document" | "bank";

export type Evidence = {
  id: string;
  source: EvidenceSource;
  label: string;
  url?: string;
  capturedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  owner: string;
  contractRenewal: string;
};

export type Vendor = {
  id: string;
  name: string;
  category: string;
};

export type Invoice = {
  id: string;
  customerId: string;
  amount: number;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  status: "paid" | "open" | "overdue";
  evidenceIds: string[];
};

export type Payment = {
  id: string;
  customerId: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  evidenceIds: string[];
};

export type Expense = {
  id: string;
  vendorId: string;
  amount: number;
  category: string;
  incurredAt: string;
  evidenceIds: string[];
};

export type Bill = {
  id: string;
  vendorId: string;
  amount: number;
  dueAt: string;
  status: "open" | "paid";
  evidenceIds: string[];
};

export type EmailThread = {
  id: string;
  subject: string;
  partyId: string;
  partyType: "customer" | "vendor";
  date: string;
  category: "invoice" | "payment_reminder" | "collections" | "contract_renewal" | "vendor";
  evidenceIds: string[];
};

export type FinancialGraph = {
  organization: {
    id: string;
    name: string;
    cashBalance: number;
  };
  customers: Customer[];
  vendors: Vendor[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  bills: Bill[];
  emails: EmailThread[];
  evidence: Evidence[];
};

export type MetricEvidence = {
  sourceId: string;
  label: string;
  source: EvidenceSource;
};

export type MetricResult = {
  id: string;
  label: string;
  value: number;
  unit: "currency" | "percent" | "months" | "score" | "count";
  formula: string;
  evidence: MetricEvidence[];
};

export type RiskAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  reason: string;
  impact: string;
  supportingData: MetricResult[];
  recommendedAction: string;
};

export type ValidationOutput = {
  validated: boolean;
  confidence: "high" | "medium" | "low";
  sources: MetricEvidence[];
  calculation_reference: string[];
  failureReason?: string;
};

export type DashboardModel = {
  generatedAt: string;
  organizationName: string;
  healthScore: {
    score: number;
    status: HealthStatus;
    components: Record<string, number>;
    validation: ValidationOutput;
  };
  metrics: Record<string, MetricResult>;
  risks: RiskAlert[];
  recentActions: string[];
};
