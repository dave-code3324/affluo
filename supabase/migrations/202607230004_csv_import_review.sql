create type public.user_role as enum (
  'MEMBER',
  'ADMIN'
);

create type public.import_status as enum (
  'UPLOADED',
  'VALIDATING',
  'READY',
  'IMPORTING',
  'COMPLETED',
  'FAILED'
);

create type public.import_row_status as enum (
  'PENDING',
  'VALID',
  'INVALID',
  'DUPLICATE',
  'IMPORTED',
  'SKIPPED'
);

create type public.duplicate_resolution as enum (
  'SKIP',
  'UPDATE_EXISTING',
  'CREATE_DISTINCT'
);

create type public.duplicate_match_level as enum (
  'STRONG',
  'SECONDARY'
);

create type public.opportunity_review_status as enum (
  'TO_REVIEW',
  'IN_REVIEW',
  'NEEDS_CHANGES',
  'APPROVED',
  'REJECTED'
);

create type public.opportunity_rejection_reason as enum (
  'OUT_OF_TARGET',
  'INSUFFICIENT_SIGNAL',
  'STALE_SIGNAL',
  'UNRELIABLE_SOURCE',
  'INSUFFICIENT_CONTACT_DETAILS',
  'DUPLICATE',
  'COMPLIANCE_RISK',
  'OTHER'
);

alter table public.users
add column role public.user_role not null default 'MEMBER';

-- The original profile policy allowed every user to update every column of
-- their own row. Once `role` exists, keeping it would permit self-promotion.
drop policy "Users can update their profile" on public.users;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  website text,
  normalized_domain text unique,
  city text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (website is null or website ~ '^https?://')
);

create index companies_normalized_name_idx
on public.companies (normalized_name);

alter table public.prospects
add column company_id uuid references public.companies (id) on delete set null;

alter table public.opportunities
alter column firm_id drop not null,
alter column weekly_batch_id drop not null,
add column review_status public.opportunity_review_status not null default 'TO_REVIEW',
add column rejection_reason public.opportunity_rejection_reason,
add column internal_notes text,
add constraint opportunities_assignment_consistency check (
  (firm_id is null and weekly_batch_id is null and status <> 'PUBLISHED')
  or (firm_id is not null and weekly_batch_id is not null)
);

update public.opportunities
set review_status = 'APPROVED'
where status = 'PUBLISHED';

alter table public.contact_details
add column verified_by_user_id uuid references public.users (id) on delete set null;

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  filename text not null,
  content_hash text not null,
  status public.import_status not null default 'UPLOADED',
  failure_message text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  processed_rows integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_rows >= 0),
  check (valid_rows >= 0),
  check (invalid_rows >= 0),
  check (duplicate_rows >= 0),
  check (processed_rows >= 0 and processed_rows <= total_rows)
);

create index imports_created_at_idx on public.imports (created_at desc);
create index imports_status_idx on public.imports (status);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports (id) on delete cascade,
  row_number integer not null check (row_number > 1),
  raw_data jsonb not null,
  normalized_data jsonb,
  status public.import_row_status not null default 'PENDING',
  error_messages jsonb not null default '[]'::jsonb,
  duplicate_of_prospect_id uuid references public.prospects (id) on delete set null,
  duplicate_match_level public.duplicate_match_level,
  duplicate_resolution public.duplicate_resolution,
  created_prospect_id uuid references public.prospects (id) on delete set null,
  created_opportunity_id uuid unique references public.opportunities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, row_number),
  check (jsonb_typeof(raw_data) = 'object'),
  check (normalized_data is null or jsonb_typeof(normalized_data) = 'object'),
  check (jsonb_typeof(error_messages) = 'array')
);

create index import_rows_import_status_idx
on public.import_rows (import_id, status);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users (id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  previous_data jsonb,
  new_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  check (previous_data is null or jsonb_typeof(previous_data) = 'object'),
  check (new_data is null or jsonb_typeof(new_data) = 'object'),
  check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create index audit_logs_entity_idx
on public.audit_logs (entity_type, entity_id);

create index audit_logs_actor_created_idx
on public.audit_logs (actor_user_id, created_at desc);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function private.set_updated_at();

create trigger imports_set_updated_at
before update on public.imports
for each row execute function private.set_updated_at();

create trigger import_rows_set_updated_at
before update on public.import_rows
for each row execute function private.set_updated_at();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'ADMIN'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function private.validate_published_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_firm_id uuid;
  batch_status public.weekly_batch_status;
  prospect_linkedin text;
  prospect_email text;
  prospect_email_status public.verification_status;
  has_usable_contact boolean;
  has_verified_contact boolean;
begin
  if new.status = 'PUBLISHED' then
    if new.firm_id is null or new.weekly_batch_id is null then
      raise exception 'A published opportunity needs a firm and a batch';
    end if;

    select firm_id, status
    into batch_firm_id, batch_status
    from public.weekly_batches
    where id = new.weekly_batch_id;

    if batch_firm_id is null or batch_firm_id <> new.firm_id then
      raise exception 'Opportunity and batch must belong to the same firm';
    end if;

    if batch_status <> 'PUBLISHED' then
      raise exception 'A published opportunity needs a published batch';
    end if;

    if new.review_status <> 'APPROVED' then
      raise exception 'A published opportunity must be approved';
    end if;

    if new.contactability_status = 'NOT_CONTACTABLE' then
      raise exception 'A published opportunity must be contactable';
    end if;

    select linkedin_url, professional_email, email_verification_status
    into prospect_linkedin, prospect_email, prospect_email_status
    from public.prospects
    where id = new.prospect_id;

    select
      exists (
        select 1
        from public.contact_details
        where prospect_id = new.prospect_id
          and verification_status <> 'INVALID'
      ),
      exists (
        select 1
        from public.contact_details
        where prospect_id = new.prospect_id
          and verification_status = 'VERIFIED'
          and type in (
            'PROFESSIONAL_EMAIL',
            'PROFESSIONAL_PHONE',
            'LINKEDIN'
          )
      )
    into has_usable_contact, has_verified_contact;

    if prospect_linkedin is null
      and prospect_email is null
      and not has_usable_contact
    then
      raise exception 'A published opportunity needs a contact channel';
    end if;

    if new.contactability_status = 'CONTACTABLE'
      and prospect_linkedin is null
      and (
        prospect_email is null
        or prospect_email_status not in ('LIKELY', 'VERIFIED')
      )
      and not has_verified_contact
    then
      raise exception 'A contactable opportunity needs a verified channel';
    end if;
  elsif new.firm_id is not null or new.weekly_batch_id is not null then
    if new.firm_id is null or new.weekly_batch_id is null then
      raise exception 'Firm and batch assignment must be set together';
    end if;

    select firm_id
    into batch_firm_id
    from public.weekly_batches
    where id = new.weekly_batch_id;

    if batch_firm_id is null or batch_firm_id <> new.firm_id then
      raise exception 'Opportunity and batch must belong to the same firm';
    end if;
  end if;

  return new;
end;
$$;

alter table public.companies enable row level security;
alter table public.imports enable row level security;
alter table public.import_rows enable row level security;
alter table public.audit_logs enable row level security;

create policy "Admins can manage companies"
on public.companies for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can read imports"
on public.imports for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create imports"
on public.imports for insert
to authenticated
with check (
  (select private.is_admin())
  and created_by_user_id = (select auth.uid())
);

create policy "Admins can update imports"
on public.imports for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete imports"
on public.imports for delete
to authenticated
using ((select private.is_admin()));

create policy "Admins can manage import rows"
on public.import_rows for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can read audit logs"
on public.audit_logs for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create audit logs"
on public.audit_logs for insert
to authenticated
with check (
  (select private.is_admin())
  and actor_user_id = (select auth.uid())
);

create policy "Admins can manage prospects"
on public.prospects for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can manage opportunities"
on public.opportunities for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can manage signals"
on public.signals for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can manage opportunity signals"
on public.opportunity_signals for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can manage contact details"
on public.contact_details for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can read users"
on public.users for select
to authenticated
using ((select private.is_admin()));
