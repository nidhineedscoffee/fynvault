create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists firm_users (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  user_id text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  business_type text,
  gst_number text,
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  user_id text not null,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  type text not null,
  source text not null,
  classification text,
  validation_status text not null default 'needs_review' check (validation_status in ('verified', 'incomplete', 'needs_review')),
  file_url text,
  uploaded_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  industry text,
  outstanding_amount numeric not null default 0,
  risk_score numeric not null default 0
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric not null default 0,
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'overdue', 'draft', 'void')),
  source_document uuid references documents(id) on delete set null
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null default 0,
  payment_date date not null
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  value numeric not null default 0,
  renewal_date date,
  status text not null default 'active' check (status in ('active', 'renewal_due', 'expired', 'cancelled'))
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null check (provider in ('zoho', 'gmail', 'google', 'scalekit')),
  external_organization_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists consent_grants (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  source_type text not null check (source_type in ('whatsapp', 'email', 'gmail', 'google_drive', 'tally', 'zoho_books', 'quickbooks', 'accounting_export', 'bank_statement', 'gst_file', 'tds_file', 'spreadsheet', 'csv', 'xlsx', 'pdf', 'payroll_report')),
  access_scope text not null default 'read_only',
  status text not null default 'requested' check (status in ('requested', 'approved', 'revoked', 'expired')),
  approved_by text,
  approved_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  source_type text not null check (source_type in ('whatsapp', 'email', 'gmail', 'google_drive', 'tally', 'zoho_books', 'quickbooks', 'accounting_export', 'bank_statement', 'gst_file', 'tds_file', 'spreadsheet', 'csv', 'xlsx', 'pdf', 'payroll_report')),
  provider text not null,
  status text not null default 'disconnected',
  consent_status text not null default 'requested',
  connection_status text not null default 'disconnected' check (connection_status in ('requested', 'connected', 'disconnected', 'syncing', 'error', 'revoked')),
  last_sync_at timestamptz,
  consent_grant_id uuid references consent_grants(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists document_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  document_category text not null check (document_category in ('bank_statement', 'sales_register', 'purchase_register', 'gst_data', 'tds_data', 'expense_sheet', 'invoice', 'contract', 'other')),
  month integer check (month between 1 and 12),
  year integer,
  status text not null default 'requested' check (status in ('requested', 'sent', 'uploaded', 'completed', 'cancelled', 'expired')),
  due_date date,
  secure_upload_token text unique,
  requested_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists ingestion_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  data_source_id uuid references data_sources(id) on delete set null,
  action text not null,
  file_count integer not null default 0,
  status text not null check (status in ('started', 'completed', 'blocked', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  source_type text not null default 'pdf',
  document_type text check (document_type in ('invoice', 'purchase_register', 'sales_register', 'bank_statement', 'gst_data', 'tds_data', 'payroll', 'contract', 'other')),
  validation_status text not null default 'needs_review' check (validation_status in ('verified', 'incomplete', 'needs_review')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'blocked', 'failed', 'intelligence_ready')),
  current_stage text not null default 'collection',
  intelligence_ready boolean not null default false,
  intelligence_readiness_score numeric not null default 0,
  processing_confidence numeric not null default 0,
  confidence_score numeric not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists processing_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references processing_jobs(id) on delete cascade,
  stage_order integer not null,
  stage_name text not null check (stage_name in ('collection', 'classification', 'extraction', 'validation', 'normalization', 'memory_build', 'intelligence_ready')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'blocked', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  error_message text,
  unique (job_id, stage_name)
);

create table if not exists validation_issues (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references processing_jobs(id) on delete cascade,
  processing_job_id uuid references processing_jobs(id) on delete cascade,
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  issue_type text,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  category text not null,
  message text not null,
  impact text,
  suggested_fix text,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now()
);

create table if not exists normalized_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references processing_jobs(id) on delete cascade,
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  record_type text not null check (record_type in ('transaction', 'invoice', 'purchase', 'sale', 'bank_entry', 'gst_entry', 'tds_entry', 'payroll_entry', 'contract', 'liability', 'compliance_event', 'reporting_event', 'business_event', 'client_history', 'other')),
  source_document_id uuid references documents(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  confidence_score numeric not null default 0,
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending', 'matched', 'mismatch', 'not_required')),
  created_at timestamptz not null default now()
);

create table if not exists financial_records (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  source_document_id uuid references documents(id) on delete set null,
  record_type text not null,
  amount numeric not null default 0,
  date date,
  category text,
  description text,
  counterparty text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists calculations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  month integer check (month between 1 and 12),
  year integer,
  cash_inflow numeric not null default 0,
  cash_outflow numeric not null default 0,
  net_cash_position numeric not null default 0,
  receivables numeric not null default 0,
  payables numeric not null default 0,
  gst_estimate numeric not null default 0,
  tds_estimate numeric not null default 0,
  overdue_invoices numeric not null default 0,
  readiness_score numeric not null default 0,
  risk_score numeric not null default 0,
  data_completeness numeric not null default 0,
  missing_inputs text[] not null default array[]::text[],
  source_document_ids uuid[] not null default array[]::uuid[],
  formula_audit jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists financial_memory_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  source_document_id uuid references documents(id) on delete set null,
  source_report_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists memory_entities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  job_id uuid references processing_jobs(id) on delete set null,
  entity_type text not null check (entity_type in ('transaction', 'liability', 'compliance_event', 'reporting_event', 'business_event', 'client_history', 'counterparty', 'account', 'tax_period', 'other')),
  display_name text not null,
  attributes jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists memory_relationships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  source_entity_id uuid not null references memory_entities(id) on delete cascade,
  target_entity_id uuid not null references memory_entities(id) on delete cascade,
  relationship_type text not null,
  attributes jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_datasets (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  job_id uuid references processing_jobs(id) on delete set null,
  month integer check (month between 1 and 12),
  year integer,
  dataset_type text not null check (dataset_type in ('cash_flow', 'receivables', 'payables', 'gst', 'compliance', 'advisory', 'mis_report', 'client_visibility', 'export', 'other')),
  readiness_status text not null default 'blocked' check (readiness_status in ('blocked', 'ready')),
  payload jsonb not null default '{}'::jsonb,
  data_json jsonb not null default '{}'::jsonb,
  source_document_ids uuid[] not null default array[]::uuid[],
  readiness_score numeric not null default 0,
  intelligence_ready boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  report_type text not null,
  month integer check (month between 1 and 12),
  year integer,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'failed')),
  report_json jsonb not null default '{}'::jsonb,
  ai_summary text,
  published_to_client boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  export_type text not null,
  file_format text not null check (file_format in ('pdf', 'csv', 'xlsx')),
  storage_url text,
  source_report_id uuid references reports(id) on delete set null,
  source_dataset_id uuid references intelligence_datasets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists advisory_opportunities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  opportunity_type text not null,
  title text not null,
  evidence jsonb not null default '{}'::jsonb,
  potential_impact text,
  suggested_talking_points text[] not null default array[]::text[],
  status text not null default 'open' check (status in ('open', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists submission_cycles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  cycle_name text not null,
  reporting_period text,
  period_month integer check (period_month between 1 and 12),
  period_year integer check (period_year between 2000 and 2100),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'annual', 'one_time')),
  due_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  owner text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists submission_requirements (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  cycle_id uuid not null references submission_cycles(id) on delete cascade,
  required_item text not null,
  document_category text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  instructions text,
  created_at timestamptz not null default now()
);

create table if not exists submission_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  cycle_id uuid not null references submission_cycles(id) on delete cascade,
  requirement_id uuid not null references submission_requirements(id) on delete cascade,
  required_item text not null,
  document_category text not null,
  due_date date not null,
  status text not null default 'awaiting_client' check (status in ('awaiting_client', 'reminder_sent', 'received', 'processing', 'completed', 'escalated', 'cancelled')),
  reminder_status text not null default 'not_sent' check (reminder_status in ('not_sent', 'friendly_sent', 'follow_up_sent', 'urgent_sent', 'escalated')),
  last_contacted_at timestamptz,
  received_document_id uuid references documents(id) on delete set null,
  received_at timestamptz,
  secure_upload_token text not null unique,
  secure_upload_url text,
  owner text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists submission_reminders (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  submission_request_id uuid not null references submission_requests(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  tone text not null check (tone in ('friendly', 'follow_up', 'urgent')),
  subject text,
  message text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  sent_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists submission_escalations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  submission_request_id uuid not null references submission_requests(id) on delete cascade,
  reason text not null,
  notify_ca_team boolean not null default true,
  notify_client boolean not null default true,
  notify_owner boolean not null default true,
  status text not null default 'open' check (status in ('open', 'notified', 'resolved')),
  created_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists client_upload_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  submission_request_id uuid not null references submission_requests(id) on delete cascade,
  token text not null unique,
  purpose text not null default 'submission_request',
  upload_url text,
  status text not null default 'active' check (status in ('active', 'used', 'revoked', 'expired')),
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  user_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table firms add column if not exists email text;
alter table clients add column if not exists business_type text;
alter table clients add column if not exists gst_number text;
alter table clients add column if not exists contact_name text;
alter table documents add column if not exists firm_id uuid references firms(id) on delete cascade;
alter table documents add column if not exists client_id uuid references clients(id) on delete set null;
alter table documents add column if not exists source_type text;
alter table documents add column if not exists document_category text;
alter table documents add column if not exists month integer;
alter table documents add column if not exists year integer;
alter table documents add column if not exists processing_status text default 'queued';
alter table documents add column if not exists validation_status text default 'needs_review';
alter table documents add column if not exists extracted_text text;
alter table documents add column if not exists storage_url text;
alter table documents add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table documents alter column organization_id drop not null;
alter table data_sources add column if not exists status text default 'disconnected';
alter table data_sources add column if not exists consent_status text default 'requested';
alter table data_sources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table processing_jobs add column if not exists confidence_score numeric not null default 0;
alter table processing_jobs add column if not exists error_message text;
alter table processing_jobs add column if not exists completed_at timestamptz;
alter table processing_stages add column if not exists processing_job_id uuid references processing_jobs(id) on delete cascade;
alter table processing_stages add column if not exists output_json jsonb not null default '{}'::jsonb;
alter table processing_stages add column if not exists error_message text;
alter table validation_issues add column if not exists firm_id uuid references firms(id) on delete cascade;
alter table validation_issues add column if not exists processing_job_id uuid references processing_jobs(id) on delete cascade;
alter table validation_issues add column if not exists issue_type text;
alter table validation_issues add column if not exists impact text;
alter table validation_issues add column if not exists suggested_fix text;
alter table normalized_records add column if not exists firm_id uuid references firms(id) on delete cascade;
alter table normalized_records add column if not exists document_id uuid references documents(id) on delete set null;
alter table normalized_records add column if not exists normalized_payload jsonb not null default '{}'::jsonb;
alter table normalized_records add column if not exists source_payload jsonb not null default '{}'::jsonb;
alter table normalized_records add column if not exists confidence_score numeric not null default 0;
alter table intelligence_datasets add column if not exists firm_id uuid references firms(id) on delete cascade;
alter table intelligence_datasets add column if not exists month integer;
alter table intelligence_datasets add column if not exists year integer;
alter table intelligence_datasets add column if not exists readiness_status text not null default 'blocked';
alter table intelligence_datasets add column if not exists data_json jsonb not null default '{}'::jsonb;
alter table intelligence_datasets add column if not exists source_document_ids uuid[] not null default array[]::uuid[];
alter table submission_cycles add column if not exists period_month integer;
alter table submission_cycles add column if not exists period_year integer;
alter table client_upload_links add column if not exists upload_url text;
alter table client_upload_links add column if not exists status text not null default 'active';

create index if not exists idx_documents_organization_id on documents(organization_id);
create index if not exists idx_documents_client_id on documents(client_id);
create index if not exists idx_customers_organization_id on customers(organization_id);
create index if not exists idx_invoices_customer_id on invoices(customer_id);
create index if not exists idx_payments_invoice_id on payments(invoice_id);
create index if not exists idx_contracts_customer_id on contracts(customer_id);
create index if not exists idx_alerts_organization_id on alerts(organization_id);
create index if not exists idx_integrations_organization_id on integration_connections(organization_id);
create index if not exists idx_clients_firm_id on clients(firm_id);
create index if not exists idx_consent_grants_client_id on consent_grants(client_id);
create index if not exists idx_data_sources_client_id on data_sources(client_id);
create index if not exists idx_ingestion_logs_client_id on ingestion_logs(client_id);
create index if not exists idx_processing_jobs_client_id on processing_jobs(client_id);
create index if not exists idx_processing_jobs_document_id on processing_jobs(document_id);
create index if not exists idx_processing_stages_job_id on processing_stages(job_id);
create index if not exists idx_validation_issues_client_id on validation_issues(client_id);
create index if not exists idx_normalized_records_client_id on normalized_records(client_id);
create index if not exists idx_memory_entities_client_id on memory_entities(client_id);
create index if not exists idx_memory_relationships_client_id on memory_relationships(client_id);
create index if not exists idx_intelligence_datasets_client_id on intelligence_datasets(client_id);
create index if not exists idx_submission_cycles_client_id on submission_cycles(client_id);
create index if not exists idx_submission_requirements_cycle_id on submission_requirements(cycle_id);
create index if not exists idx_submission_requests_firm_status on submission_requests(firm_id, status);
create index if not exists idx_submission_requests_client_id on submission_requests(client_id);
create index if not exists idx_submission_requests_due_date on submission_requests(due_date);
create index if not exists idx_submission_reminders_request_id on submission_reminders(submission_request_id);
create index if not exists idx_submission_escalations_request_id on submission_escalations(submission_request_id);
create index if not exists idx_client_upload_links_token on client_upload_links(token);
create index if not exists idx_client_upload_links_request_id on client_upload_links(submission_request_id);

alter table firms enable row level security;
alter table firm_users enable row level security;
alter table clients enable row level security;
alter table client_users enable row level security;
alter table documents enable row level security;
alter table consent_grants enable row level security;
alter table data_sources enable row level security;
alter table document_requests enable row level security;
alter table ingestion_logs enable row level security;
alter table processing_jobs enable row level security;
alter table processing_stages enable row level security;
alter table validation_issues enable row level security;
alter table normalized_records enable row level security;
alter table financial_records enable row level security;
alter table calculations enable row level security;
alter table financial_memory_events enable row level security;
alter table memory_entities enable row level security;
alter table memory_relationships enable row level security;
alter table intelligence_datasets enable row level security;
alter table reports enable row level security;
alter table exports enable row level security;
alter table advisory_opportunities enable row level security;
alter table submission_cycles enable row level security;
alter table submission_requirements enable row level security;
alter table submission_requests enable row level security;
alter table submission_reminders enable row level security;
alter table submission_escalations enable row level security;
alter table client_upload_links enable row level security;
alter table audit_logs enable row level security;

create or replace function create_processing_job_for_document()
returns trigger as $$
declare
  new_job_id uuid;
begin
  insert into processing_jobs (firm_id, client_id, document_id, source_type, status, current_stage)
  values (new.firm_id, new.client_id, new.id, lower(coalesce(new.source, 'pdf')), 'queued', 'collection')
  returning id into new_job_id;

  insert into processing_stages (job_id, processing_job_id, stage_order, stage_name, status)
  values
    (new_job_id, new_job_id, 1, 'collection', 'pending'),
    (new_job_id, new_job_id, 2, 'classification', 'pending'),
    (new_job_id, new_job_id, 3, 'extraction', 'pending'),
    (new_job_id, new_job_id, 4, 'validation', 'pending'),
    (new_job_id, new_job_id, 5, 'normalization', 'pending'),
    (new_job_id, new_job_id, 6, 'memory_build', 'pending'),
    (new_job_id, new_job_id, 7, 'intelligence_ready', 'pending');

  return new;
end;
$$ language plpgsql;

drop trigger if exists documents_create_processing_job on documents;
create trigger documents_create_processing_job
after insert on documents
for each row execute function create_processing_job_for_document();

insert into storage.buckets (id, name, public)
values ('finvault-documents', 'finvault-documents', false)
on conflict (id) do nothing;
