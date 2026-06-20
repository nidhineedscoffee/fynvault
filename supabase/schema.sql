create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cash_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id text not null,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

create table integration_connections (
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

create table evidence (
  id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  source text not null check (source in ('zoho', 'gmail', 'document', 'bank')),
  label text not null,
  url text,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table graph_entities (
  id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null,
  display_name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table graph_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_entity_id text not null references graph_entities(id) on delete cascade,
  relationship_type text not null,
  target_entity_id text not null references graph_entities(id) on delete cascade,
  evidence_ids text[] not null default array[]::text[],
  created_at timestamptz not null default now()
);

create table financial_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  metric_id text not null,
  value numeric not null,
  unit text not null,
  formula text not null,
  source_ids text[] not null,
  generated_at timestamptz not null default now()
);

create table risk_alerts (
  id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  reason text not null,
  impact text not null,
  supporting_data jsonb not null,
  recommended_action text not null,
  created_at timestamptz not null default now()
);

create table action_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action_type text not null,
  status text not null check (status in ('ready', 'blocked', 'sent', 'exported')),
  validation jsonb not null,
  draft jsonb not null,
  created_at timestamptz not null default now()
);
