import { NextResponse } from "next/server";
import { resolveFinancialGraph } from "@/lib/data-source";
import { requireIntelligenceReady } from "@/lib/processing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required. Graph access is gated by Intelligence Ready status." }, { status: 400 });
  }

  const readiness = await requireIntelligenceReady(clientId);
  if (!readiness.ok) {
    return NextResponse.json(readiness, { status: readiness.status });
  }

  const source = await resolveFinancialGraph(clientId);
  if (!source.graph) {
    return NextResponse.json({ error: source.reason ?? "Client financial graph is unavailable." }, { status: 404 });
  }

  return NextResponse.json({
    mode: source.mode,
    clientId: source.clientId,
    intelligenceReadiness: readiness.data,
    reason: source.reason,
    graph: source.graph,
    relationships: {
      customerInvoiceEdges: source.graph.invoices.map((invoice) => ({ from: invoice.customerId, to: invoice.id, type: "customer_invoice" })),
      invoicePaymentEdges: source.graph.payments.map((payment) => ({ from: payment.invoiceId, to: payment.id, type: "invoice_payment" })),
      vendorBillEdges: source.graph.bills.map((bill) => ({ from: bill.vendorId, to: bill.id, type: "vendor_bill" })),
      vendorExpenseEdges: source.graph.expenses.map((expense) => ({ from: expense.vendorId, to: expense.id, type: "vendor_expense" })),
      emailPartyEdges: source.graph.emails.map((email) => ({ from: email.partyId, to: email.id, type: `${email.partyType}_email` }))
    }
  });
}
