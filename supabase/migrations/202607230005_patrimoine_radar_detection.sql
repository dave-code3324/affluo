create type public.opportunity_origin as enum (
  'CSV_IMPORT',
  'AUTOMATED_DETECTION',
  'MANUAL'
);

create type public.source_document_processing_status as enum (
  'COLLECTED',
  'PROCESSING',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

create type public.detection_run_status as enum (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED'
);

create type public.detection_run_item_status as enum (
  'COLLECTED',
  'PROCESSING',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

create type public.detection_signal_type as enum (
  'COMPANY_SALE',
  'BUSINESS_TRANSFER',
  'FUNDRAISING',
  'MANAGEMENT_CHANGE',
  'COMPANY_CREATION',
  'COMPANY_CLOSURE',
  'DIVIDEND_EVENT',
  'REAL_ESTATE_TRANSACTION',
  'PROFESSIONAL_SUCCESSION',
  'LIQUIDITY_EVENT',
  'OTHER'
);

create type public.extraction_method as enum (
  'DETERMINISTIC',
  'LLM'
);

create type public.extraction_invocation_status as enum (
  'PENDING',
  'COMPLETED',
  'FAILED'
);

alter table public.companies
add column legal_name text,
add column trade_name text,
add column siren text unique,
add column siret text unique,
add column industry text,
add column legal_form text;

update public.companies
set legal_name = name
where legal_name is null;

alter table public.companies
alter column legal_name set not null,
add constraint companies_siren_format check (
  siren is null or siren ~ '^[0-9]{9}$'
),
add constraint companies_siret_format check (
  siret is null or siret ~ '^[0-9]{14}$'
);

alter table public.prospects
add column identification_source text,
add column identification_confidence integer,
add constraint prospects_identification_source_url check (
  identification_source is null
  or identification_source ~ '^https?://'
),
add constraint prospects_identification_confidence_range check (
  identification_confidence is null
  or identification_confidence between 0 and 100
);

create table public.detection_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  status public.detection_run_status not null default 'PENDING',
  started_at timestamptz,
  completed_at timestamptz,
  documents_collected integer not null default 0,
  documents_processed integer not null default 0,
  signals_detected integer not null default 0,
  prospects_created integer not null default 0,
  opportunities_created integer not null default 0,
  opportunities_ignored integer not null default 0,
  errors_count integer not null default 0,
  metadata jsonb,
  launched_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_key ~ '^[A-Z0-9_]+$'),
  check (
    documents_collected >= 0
    and documents_processed >= 0
    and signals_detected >= 0
    and prospects_created >= 0
    and opportunities_created >= 0
    and opportunities_ignored >= 0
    and errors_count >= 0
  ),
  check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create index detection_runs_source_created_idx
on public.detection_runs (source_key, created_at desc);

create index detection_runs_status_idx
on public.detection_runs (status);

create unique index detection_runs_one_active_source_idx
on public.detection_runs (source_key)
where status in ('PENDING', 'RUNNING');

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  external_id text,
  source_url text not null,
  title text not null,
  raw_content text not null,
  content_hash text not null,
  published_at timestamptz,
  collected_at timestamptz not null,
  processing_status public.source_document_processing_status not null default 'COLLECTED',
  processing_error text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, external_id),
  unique (source_key, source_url),
  unique (source_key, content_hash),
  check (source_key ~ '^[A-Z0-9_]+$'),
  check (source_url ~ '^https?://'),
  check (char_length(raw_content) > 0),
  check (content_hash ~ '^[a-f0-9]{64}$'),
  check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create index source_documents_processing_collected_idx
on public.source_documents (processing_status, collected_at desc);

alter table public.signals
add column source_document_id uuid unique references public.source_documents (id) on delete set null,
add column confidence_level public.confidence_level not null default 'MEDIUM',
add column extraction_method public.extraction_method not null default 'DETERMINISTIC',
add column extraction_version text not null default 'deterministic-v1';

alter table public.opportunities
add column origin public.opportunity_origin not null default 'MANUAL',
add column automatic_score integer,
add column automatic_confidence public.confidence_level,
add column detection_run_id uuid references public.detection_runs (id) on delete set null,
add constraint opportunities_automatic_score_range check (
  automatic_score is null or automatic_score between 0 and 100
);

update public.opportunities as opportunity
set origin = 'CSV_IMPORT'
where exists (
  select 1
  from public.import_rows
  where created_opportunity_id = opportunity.id
);

create index opportunities_detection_run_idx
on public.opportunities (detection_run_id);

create table public.detection_run_items (
  id uuid primary key default gen_random_uuid(),
  detection_run_id uuid not null references public.detection_runs (id) on delete cascade,
  source_document_id uuid not null references public.source_documents (id) on delete cascade,
  status public.detection_run_item_status not null default 'COLLECTED',
  rejection_reasons text[] not null default '{}',
  matching_reasons text[] not null default '{}',
  error_message text,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (detection_run_id, source_document_id),
  check (attempt_count >= 0),
  check (duration_ms is null or duration_ms >= 0)
);

create index detection_run_items_run_status_idx
on public.detection_run_items (detection_run_id, status);

create table public.extraction_invocations (
  id uuid primary key default gen_random_uuid(),
  detection_run_id uuid not null references public.detection_runs (id) on delete cascade,
  input_document_id uuid not null references public.source_documents (id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version text not null,
  output jsonb,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  status public.extraction_invocation_status not null default 'PENDING',
  error_message text,
  created_at timestamptz not null default now(),
  check (output is null or jsonb_typeof(output) = 'object'),
  check (latency_ms is null or latency_ms >= 0),
  check (input_tokens is null or input_tokens >= 0),
  check (output_tokens is null or output_tokens >= 0)
);

create index extraction_invocations_run_idx
on public.extraction_invocations (detection_run_id);

create index extraction_invocations_document_idx
on public.extraction_invocations (input_document_id);

create trigger detection_runs_set_updated_at
before update on public.detection_runs
for each row execute function private.set_updated_at();

create trigger source_documents_set_updated_at
before update on public.source_documents
for each row execute function private.set_updated_at();

create trigger detection_run_items_set_updated_at
before update on public.detection_run_items
for each row execute function private.set_updated_at();

alter table public.detection_runs enable row level security;
alter table public.source_documents enable row level security;
alter table public.detection_run_items enable row level security;
alter table public.extraction_invocations enable row level security;

create policy "Admins can read detection runs"
on public.detection_runs for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create detection runs"
on public.detection_runs for insert
to authenticated
with check (
  (select private.is_admin())
  and launched_by_user_id = (select auth.uid())
);

create policy "Admins can update detection runs"
on public.detection_runs for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete detection runs"
on public.detection_runs for delete
to authenticated
using ((select private.is_admin()));

create policy "Admins can manage source documents"
on public.source_documents for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can manage detection run items"
on public.detection_run_items for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can read extraction invocations"
on public.extraction_invocations for select
to authenticated
using ((select private.is_admin()));
