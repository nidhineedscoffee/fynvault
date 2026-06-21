# Fynny Single-Client Email Demo Playbook

## Goal

Show the full Fynny story for one named client: `Aster Foods Pvt Ltd`.

Start with Gmail attachment sync, then continue with the full Aster Foods pack so the demo covers all major product use cases for one client.

## Files to email as attachments

- `fynny-email-sales-invoice-solid.csv`
- `fynny-email-contract-renewal.csv`
- `fynny-email-gst-summary.csv`

## Recommended email subjects

- `June customer invoice`
- `Fresh Basket renewal contract`
- `June GST working`

## Demo sequence

1. Create or select the client `Aster Foods Pvt Ltd` in Fynny.
2. Connect Gmail for that client with read-only access as the CA operator.
3. Send the three sample files above to the connected mailbox.
4. In Ask Fynny, run: `sync Gmail and process the new finance emails`
5. Upload `/samples/fynny-aster-foods-correlated-test-pack.zip` into the same client.
6. Then run all the core prompts from `/samples/aster-foods/client-demo-playbook.md`.

## What should happen

- Gmail sync should collect the attachments into processing.
- The invoice file should drive receivables and MIS evidence.
- The GST file should drive compliance and GST export evidence.
- The contract file should create memory about renewal and advisory context.
- The full Aster Foods pack should unlock cash flow, payables, TDS, payroll, validation, memory, advisory, reports, and exports for the same client.
- Exports should download in the requested format once the client is Intelligence Ready.

## Value to show the client

- No manual copy-paste from email attachments into a spreadsheet.
- One flow for ingestion, validation, normalization, memory, and report output.
- AI explains verified evidence instead of inventing financial facts.
- CA team can move from scattered inbox files to report-ready outputs faster for one client at a time.
