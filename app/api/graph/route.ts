import { NextResponse } from "next/server";
import { demoGraph } from "@/lib/financial-graph";

export async function GET() {
  return NextResponse.json({
    mode: "demo_seed",
    graph: demoGraph,
    relationships: {
      customerInvoiceEdges: demoGraph.invoices.map((invoice) => ({ from: invoice.customerId, to: invoice.id, type: "customer_invoice" })),
      invoicePaymentEdges: demoGraph.payments.map((payment) => ({ from: payment.invoiceId, to: payment.id, type: "invoice_payment" })),
      vendorBillEdges: demoGraph.bills.map((bill) => ({ from: bill.vendorId, to: bill.id, type: "vendor_bill" })),
      vendorExpenseEdges: demoGraph.expenses.map((expense) => ({ from: expense.vendorId, to: expense.id, type: "vendor_expense" })),
      emailPartyEdges: demoGraph.emails.map((email) => ({ from: email.partyId, to: email.id, type: `${email.partyType}_email` }))
    }
  });
}
