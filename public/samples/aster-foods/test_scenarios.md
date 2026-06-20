# test_scenarios.md

## Expected classification
- sales_register_apr_2026.csv, sales_register_may_2026.csv, sales_register_jun_2026.csv: Sales register / Accounts receivable / GST outward supply.
- purchase_register_apr_2026.csv, purchase_register_may_2026.csv, purchase_register_jun_2026.csv: Purchase register / Accounts payable / GST input credit.
- bank_statement_apr_2026.csv, bank_statement_may_2026.csv, bank_statement_jun_2026.csv: Bank statement / cashbook reconciliation.
- gst_summary_apr_2026.csv, gst_summary_may_2026.csv, gst_summary_jun_2026.csv: GST summary / statutory return evidence.
- tds_summary_q1_2026.csv: TDS data.
- payroll_apr_2026.csv, payroll_may_2026.csv, payroll_jun_2026.csv: Payroll.
- contracts_renewals.csv: Contracts and renewal memory.
- receivables_aging_jun_2026.csv: Receivables aging.
- payables_aging_jun_2026.csv: Payables aging.
- missing_documents_tracker.csv: Missing inputs tracker.

## Expected validation issues
- GST mismatch: April GST summary outward taxable value is Rs. 10,000 higher than April sales register, with output CGST/SGST higher by Rs. 900 each.
- Duplicate invoice number: AFPL/26-27/DUP-01 appears in May and June sales registers for different customers.
- Missing bank reference: April bank statement has bank charges row with blank reference_no.
- Vendor normalization issue: Spice Traders Pvt Ltd and Spice Trader Pvt. Ltd. map to the same GSTIN 29AABCS1234A1Z9.
- Minor GST rounding issue: June GST summary input CGST differs by Rs. 1.
- Mixed date formats: DD-MM-YYYY, YYYY-MM-DD, and DD/MM/YYYY appear across registers.
- Unpaid vendor bill older than 45 days: PB/APR/007 for Tamil Nadu Packaging Co remains unpaid as of 2026-06-30.
- Payroll anomaly: Rahul Nair June gross salary jumps from Rs. 72,000 to Rs. 1,35,000 due to variable payout.

## Expected missing inputs
- May purchase register marked incomplete in missing_documents_tracker.csv.
- Q1 TDS challan evidence missing; June TDS deposit statuses are pending.

## Expected normalization records
- Customer names should normalize across sales, bank narrations, contracts, and aging.
- Fresh Basket India Pvt Ltd is the top customer and links to bank receipts UTR-APR-001, UTR-JUN-001 and contract renewal.
- RetailMart South LLP is the second largest customer and links to UTR-APR-003 and UTR-JUN-002.
- Spice Traders Pvt Ltd and Spice Trader Pvt. Ltd. should merge using GSTIN.
- Interstate GST records should be identified for Coimbatore Foods Trading and Tamil Nadu Packaging Co.

## Expected financial memory events
- Fresh Basket India Pvt Ltd contract renewal is due on 2026-07-15.
- Two largest customers, Fresh Basket India Pvt Ltd and RetailMart South LLP, contribute more than 40% of Q1 revenue.
- DailyNeeds Supermart has unpaid May invoice AFPL/26-27/DUP-01.
- Tamil Nadu Packaging Co has a high-priority overdue payable older than 45 days.
- June payroll contains one unusual incentive/variable payout.

## Expected advisory opportunities
- Revenue concentration risk: two customers contribute more than 40% of Q1 revenue.
- Credit control: follow up on overdue receivables from Udupi Fresh Mart and DailyNeeds Supermart.
- Vendor payment risk: prioritize PB/APR/007 to avoid supply disruption or penalties.
- GST compliance: reconcile April mismatch and June Rs. 1 rounding difference before filing.
- TDS compliance: deposit pending TDS for June professional fees and contractor freight.
- Renewal opportunity: renew Fresh Basket India Pvt Ltd before 2026-07-15.

## Expected Ask Fynny questions and evidence
1. Who are our top customers this quarter?
   - Evidence: sales registers April-June and contracts_renewals.csv.
2. Why does April GST not match sales?
   - Evidence: April sales register totals versus gst_summary_apr_2026.csv.
3. Which invoices are overdue?
   - Evidence: receivables_aging_jun_2026.csv and sales payment_status.
4. Which vendor bill is oldest unpaid?
   - Evidence: payables_aging_jun_2026.csv and purchase_register_apr_2026.csv.
5. Did payroll increase in June?
   - Evidence: payroll_apr_2026.csv, payroll_may_2026.csv, payroll_jun_2026.csv.
6. Which contract needs renewal?
   - Evidence: contracts_renewals.csv.
7. Which bank transactions need review?
   - Evidence: blank reference_no in bank_statement_apr_2026.csv and varied narrations.

## Expected Intelligence Readiness Score
- Before fixing issues: 76 / 100
- After fixing issues: 94 / 100

## Fixes expected to reach 94
- Upload complete May purchase register evidence.
- Correct April GST summary mismatch.
- Resolve duplicate invoice number AFPL/26-27/DUP-01.
- Add missing bank reference for April bank charges.
- Confirm June payroll variable payout.
- Deposit pending June TDS and upload challan.
- Normalize vendor master using GSTIN.

