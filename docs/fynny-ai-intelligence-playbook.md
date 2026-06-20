# Fynny AI Intelligence Playbook

This playbook defines what Ask Fynny should know, how it should reason, and what it must never do.

## Principle

Fynny is not allowed to invent financial facts. The AI explains verified records, formulas, validation issues, processing status, and financial memory.

## Intelligence Stack

1. Domain knowledge layer
   - Use cases, formulas, process checks, and guardrails in `lib/financial-intelligence.ts`.
2. Evidence retrieval
   - Calculations, intelligence datasets, normalized records, validation issues, and financial memory.
3. Readiness gate
   - Ask Fynny answers only when Intelligence Ready is true.
4. Explanation layer
   - The model explains, prioritizes, and summarizes. It does not create primary financial values.
5. Fine-tuning layer
   - Add only after we have reviewed, labeled examples from real CA workflows.

## Use Cases

- Cash flow intelligence
- Receivables and collection risk
- Payables and vendor pressure
- GST compliance
- TDS compliance
- Profitability and MIS
- Advisory opportunity discovery
- Portfolio readiness
- Client visibility
- Missing data detection

## Financial Formulas

- Gross Margin = `(Revenue - COGS) / Revenue * 100`
- Net Profit Margin = `Net Profit / Revenue * 100`
- EBITDA Margin = `EBITDA / Revenue * 100`
- Current Ratio = `Current Assets / Current Liabilities`
- Quick Ratio = `(Cash + Marketable Securities + Receivables) / Current Liabilities`
- DSO = `Average Accounts Receivable / Credit Sales * Days`
- DPO = `Average Accounts Payable / COGS * Days`
- Cash Runway = `Cash Balance / Average Monthly Net Burn`
- Burn Rate = `Cash Outflows - Cash Inflows`
- Working Capital = `Current Assets - Current Liabilities`
- GST Payable = `Output GST - Eligible Input GST Credit`
- TDS Payable = `TDS Deducted - TDS Deposited`
- Revenue Growth = `(Current Period Revenue - Prior Period Revenue) / Prior Period Revenue * 100`
- Expense Variance = `Actual Expense - Budget or Prior Period Expense`

## Process Models

### Collection

- Confirm client consent.
- Collect only approved financial sources.
- Reject unrelated data.

### Classification

- Identify source type, period, client, document category, and confidence.
- Route unsupported files to review.

### Validation

- Check missing periods, duplicate files, corrupted rows, invalid dates, missing amounts, and reconciliation mismatches.

### Normalization

- Convert source-specific formats into unified financial records.
- Preserve source document and confidence.

### Memory Build

- Build entities for clients, customers, vendors, accounts, documents, filings, and financial events.

### Intelligence Ready

- Require completeness, validation, reconciliation, missing-input resolution, and confidence thresholds.

## Fine-Tuning Criteria

Do not fine-tune until these exist:

- At least 200 reviewed Ask Fynny examples.
- Each example has question, evidence payload, correct answer, refusal behavior, and reviewer notes.
- Examples cover CA workflows across cash flow, GST, TDS, MIS, receivables, payables, advisory, and client portal.
- No raw secrets, personal emails, bank account numbers, or unrelated client content.
- Evaluation set is separate from training set.

## Output Rules

- Always state when a response is blocked by readiness.
- Always cite evidence categories used.
- Always list missing inputs when important.
- Never calculate new values unless validated calculations already exist.
- Never claim a filing, payment, or tax status without source evidence.
- Never read or summarize unrelated personal data.

