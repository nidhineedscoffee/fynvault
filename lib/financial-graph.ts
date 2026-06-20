import type { FinancialGraph } from "./types";

export const demoGraph: FinancialGraph = {
  organization: {
    id: "org_finvault_demo",
    name: "Northstar Components",
    cashBalance: 418000
  },
  customers: [
    { id: "cus_aurora", name: "Aurora Retail", owner: "Maya", contractRenewal: "2026-09-15" },
    { id: "cus_helio", name: "Helio Labs", owner: "Ishan", contractRenewal: "2026-12-01" },
    { id: "cus_cinder", name: "Cinder Foods", owner: "Maya", contractRenewal: "2026-07-25" },
    { id: "cus_lumen", name: "Lumen Works", owner: "Aarav", contractRenewal: "2027-02-08" }
  ],
  vendors: [
    { id: "ven_cloud", name: "Cloudgrid", category: "Infrastructure" },
    { id: "ven_ops", name: "OpsLedger", category: "Finance Ops" },
    { id: "ven_ads", name: "Brightline Ads", category: "Marketing" }
  ],
  invoices: [
    { id: "inv_1001", customerId: "cus_aurora", amount: 126000, issuedAt: "2026-04-04", dueAt: "2026-05-04", paidAt: "2026-05-02", status: "paid", evidenceIds: ["ev_zoho_inv_1001"] },
    { id: "inv_1002", customerId: "cus_helio", amount: 84000, issuedAt: "2026-04-12", dueAt: "2026-05-12", paidAt: "2026-05-15", status: "paid", evidenceIds: ["ev_zoho_inv_1002"] },
    { id: "inv_1003", customerId: "cus_aurora", amount: 148000, issuedAt: "2026-05-04", dueAt: "2026-06-03", status: "overdue", evidenceIds: ["ev_zoho_inv_1003", "ev_gmail_collect_01"] },
    { id: "inv_1004", customerId: "cus_cinder", amount: 52000, issuedAt: "2026-05-12", dueAt: "2026-06-11", status: "overdue", evidenceIds: ["ev_zoho_inv_1004"] },
    { id: "inv_1005", customerId: "cus_lumen", amount: 73000, issuedAt: "2026-05-21", dueAt: "2026-06-20", status: "open", evidenceIds: ["ev_zoho_inv_1005"] },
    { id: "inv_1006", customerId: "cus_helio", amount: 98000, issuedAt: "2026-06-02", dueAt: "2026-07-02", status: "open", evidenceIds: ["ev_zoho_inv_1006"] }
  ],
  payments: [
    { id: "pay_7001", customerId: "cus_aurora", invoiceId: "inv_1001", amount: 126000, paidAt: "2026-05-02", evidenceIds: ["ev_zoho_pay_7001"] },
    { id: "pay_7002", customerId: "cus_helio", invoiceId: "inv_1002", amount: 84000, paidAt: "2026-05-15", evidenceIds: ["ev_zoho_pay_7002"] }
  ],
  expenses: [
    { id: "exp_5001", vendorId: "ven_cloud", amount: 42000, category: "Infrastructure", incurredAt: "2026-04-05", evidenceIds: ["ev_zoho_exp_5001"] },
    { id: "exp_5002", vendorId: "ven_ops", amount: 36000, category: "Finance Ops", incurredAt: "2026-04-18", evidenceIds: ["ev_zoho_exp_5002"] },
    { id: "exp_5003", vendorId: "ven_cloud", amount: 51000, category: "Infrastructure", incurredAt: "2026-05-07", evidenceIds: ["ev_zoho_exp_5003"] },
    { id: "exp_5004", vendorId: "ven_ads", amount: 69000, category: "Marketing", incurredAt: "2026-05-19", evidenceIds: ["ev_zoho_exp_5004"] },
    { id: "exp_5005", vendorId: "ven_cloud", amount: 56000, category: "Infrastructure", incurredAt: "2026-06-08", evidenceIds: ["ev_zoho_exp_5005"] }
  ],
  bills: [
    { id: "bill_3001", vendorId: "ven_cloud", amount: 28000, dueAt: "2026-06-24", status: "open", evidenceIds: ["ev_zoho_bill_3001"] },
    { id: "bill_3002", vendorId: "ven_ads", amount: 31000, dueAt: "2026-06-28", status: "open", evidenceIds: ["ev_zoho_bill_3002"] }
  ],
  emails: [
    { id: "email_thr_01", subject: "Aurora May invoice follow-up", partyId: "cus_aurora", partyType: "customer", date: "2026-06-14", category: "collections", evidenceIds: ["ev_gmail_collect_01"] },
    { id: "email_thr_02", subject: "Cinder renewal terms", partyId: "cus_cinder", partyType: "customer", date: "2026-06-17", category: "contract_renewal", evidenceIds: ["ev_gmail_contract_01"] }
  ],
  evidence: [
    { id: "ev_zoho_inv_1001", source: "zoho", label: "Zoho invoice INV-1001", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_inv_1002", source: "zoho", label: "Zoho invoice INV-1002", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_inv_1003", source: "zoho", label: "Zoho invoice INV-1003", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_inv_1004", source: "zoho", label: "Zoho invoice INV-1004", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_inv_1005", source: "zoho", label: "Zoho invoice INV-1005", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_inv_1006", source: "zoho", label: "Zoho invoice INV-1006", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_pay_7001", source: "zoho", label: "Zoho payment PAY-7001", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_pay_7002", source: "zoho", label: "Zoho payment PAY-7002", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_exp_5001", source: "zoho", label: "Zoho expense EXP-5001", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_exp_5002", source: "zoho", label: "Zoho expense EXP-5002", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_exp_5003", source: "zoho", label: "Zoho expense EXP-5003", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_exp_5004", source: "zoho", label: "Zoho expense EXP-5004", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_exp_5005", source: "zoho", label: "Zoho expense EXP-5005", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_bill_3001", source: "zoho", label: "Zoho bill BILL-3001", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_zoho_bill_3002", source: "zoho", label: "Zoho bill BILL-3002", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_gmail_collect_01", source: "gmail", label: "Gmail thread: Aurora May invoice follow-up", capturedAt: "2026-06-20T06:00:00.000Z" },
    { id: "ev_gmail_contract_01", source: "gmail", label: "Gmail thread: Cinder renewal terms", capturedAt: "2026-06-20T06:00:00.000Z" }
  ]
};
