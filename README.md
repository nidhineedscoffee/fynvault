# Fynny

Fynny is a secure data collection and processing layer for CA firms. It collects scattered client financial data only with client consent, processes it into clean financial records, builds financial memory, and gates intelligence products behind an Intelligence Ready score.

## Backbone

```text
Consent -> Read-only Collection -> Processing Layer -> Financial Memory -> Intelligence Ready -> Reports / Advisory / Ask Fynny
```

The Processing Layer is the central backend pipeline. Reports, advisory, client visibility, Ask Fynny, and financial memory must pass through it.

## Processing Stages

1. Collection
2. Classification
3. Extraction
4. Validation
5. Normalization
6. Memory Build
7. Intelligence Ready

Every uploaded document creates a `processing_jobs` row and seven `processing_stages` rows through the database trigger in `supabase/schema.sql`.

## Intelligence Readiness Score

`GET /api/intelligence-ready/:clientId` calculates the gateway score from:

- Data Completeness
- Validation Status
- Reconciliation Status
- Missing Inputs
- Processing Confidence

No intelligence endpoint should generate output until `intelligenceReady` is true.

## Secure Collection

Fynny only collects financial documents the client approves. Access is read-only and can be revoked anytime.

Supported source types:

- WhatsApp manual uploads or forwarded files only for MVP
- Email
- Gmail
- Google Drive
- Tally
- Zoho Books
- QuickBooks
- Accounting exports
- Bank statements
- GST files
- TDS files
- Spreadsheets
- CSV
- XLSX
- Payroll reports
- PDFs

Direct WhatsApp scraping is intentionally blocked.

Classified document types include invoice, purchase register, sales register, bank statement, GST data, TDS data, payroll, contract, and other.

Intelligence datasets include cash flow, receivables, payables, GST, compliance, advisory, MIS report, client visibility, and exports.

## API Surface

```text
GET  /api/auth/me
GET  /api/firm
POST /api/firm
GET  /api/clients
POST /api/clients
GET  /api/clients/:id
PATCH /api/clients/:id
DELETE /api/clients/:id

GET  /api/processing
GET  /api/processing/jobs
GET  /api/processing/jobs/:id
POST /api/processing/retry
POST /api/processing/jobs/:id/retry
GET  /api/processing/issues
GET  /api/processing/clients/:id
GET  /api/clients/:id/processing
GET  /api/clients/:id/validation-issues
GET  /api/validation-issues/:id
PATCH /api/validation-issues/:id
GET  /api/intelligence-ready/:clientId

GET  /api/clients/:id/consent
POST /api/clients/:id/consent/request
POST /api/client-portal/consent/:id/approve
POST /api/client-portal/consent/:id/revoke
GET  /api/clients/:id/data-sources
POST /api/clients/:id/data-sources/connect
POST /api/clients/:id/data-sources/create
POST /api/clients/:id/data-sources/sync
GET  /api/clients/:id/document-requests
POST /api/clients/:id/document-requests
POST /api/document-requests/:id/upload-link
GET  /api/clients/:id/documents
POST /api/clients/:id/documents
POST /api/public-upload/:token
GET  /api/documents/:id
DELETE /api/documents/:id
POST /api/documents/:id/process

POST /api/clients/:id/calculate
GET  /api/clients/:id/snapshot
GET  /api/clients/:id/memory
POST /api/clients/:id/ask
GET  /api/clients/:id/reports
POST /api/clients/:id/reports
POST /api/reports/:id/publish
GET  /api/clients/:id/exports
POST /api/clients/:id/exports
GET  /api/clients/:id/advisory
POST /api/clients/:id/advisory
GET  /api/client-portal/:id

GET  /api/dashboard?clientId=<uuid>
GET  /api/graph?clientId=<uuid>
POST /api/ask      { "clientId": "<uuid>", "question": "..." }
POST /api/actions  { "clientId": "<uuid>", "action": "risk_report" }
```

## Run Locally

```bash
npm install
npm run dev
```

Apply `supabase/schema.sql` in Supabase before using the new Processing Layer tables.

## Provider Redirects

```text
ScaleKit: https://fynvault.vercel.app/api/auth/scalekit/callback
Zoho:     https://fynvault.vercel.app/api/sync/zoho
Google:   https://fynvault.vercel.app/api/sync/gmail
```
