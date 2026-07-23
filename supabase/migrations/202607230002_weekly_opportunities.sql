create type public.weekly_batch_status as enum (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

create type public.email_verification_status as enum (
  'UNVERIFIED',
  'LIKELY',
  'VERIFIED',
  'INVALID'
);

create type public.contactability_status as enum (
  'NOT_CONTACTABLE',
  'PARTIALLY_VERIFIED',
  'CONTACTABLE'
);

create type public.opportunity_status as enum (
  'DRAFT',
  'PUBLISHED',
  'DISMISSED'
);

create table public.weekly_batches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status public.weekly_batch_status not null default 'DRAFT',
  published_at timestamptz,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, week_start),
  check (week_end >= week_start),
  check (
    (status = 'PUBLISHED' and published_at is not null)
    or status <> 'PUBLISHED'
  )
);

create index weekly_batches_firm_status_published_idx
on public.weekly_batches (firm_id, status, published_at desc);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  job_title text not null,
  company_name text not null,
  city text not null,
  department text not null,
  linkedin_url text,
  professional_email text,
  email_verification_status public.email_verification_status not null default 'UNVERIFIED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospects_department_idx on public.prospects (department);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  weekly_batch_id uuid not null references public.weekly_batches (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete restrict,
  title text not null,
  signal_type text not null,
  signal_summary text not null,
  why_now text not null,
  relevance_score integer not null,
  contactability_status public.contactability_status not null default 'NOT_CONTACTABLE',
  status public.opportunity_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_batch_id, prospect_id),
  check (relevance_score between 0 and 100)
);

create index opportunities_firm_status_idx
on public.opportunities (firm_id, status);

create index opportunities_batch_status_score_idx
on public.opportunities (weekly_batch_id, status, relevance_score desc);

create trigger weekly_batches_set_updated_at
before update on public.weekly_batches
for each row execute function private.set_updated_at();

create trigger prospects_set_updated_at
before update on public.prospects
for each row execute function private.set_updated_at();

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function private.set_updated_at();

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
  prospect_email_status public.email_verification_status;
begin
  select firm_id, status
  into batch_firm_id, batch_status
  from public.weekly_batches
  where id = new.weekly_batch_id;

  if batch_firm_id is null or batch_firm_id <> new.firm_id then
    raise exception 'Opportunity and batch must belong to the same firm';
  end if;

  if new.status = 'PUBLISHED' then
    if batch_status <> 'PUBLISHED' then
      raise exception 'A published opportunity needs a published batch';
    end if;

    if new.contactability_status = 'NOT_CONTACTABLE' then
      raise exception 'A published opportunity must be contactable';
    end if;

    select linkedin_url, professional_email, email_verification_status
    into prospect_linkedin, prospect_email, prospect_email_status
    from public.prospects
    where id = new.prospect_id;

    if prospect_linkedin is null and prospect_email is null then
      raise exception 'A published opportunity needs a contact channel';
    end if;

    if new.contactability_status = 'CONTACTABLE'
      and prospect_linkedin is null
      and (
        prospect_email is null
        or prospect_email_status not in ('LIKELY', 'VERIFIED')
      )
    then
      raise exception 'A contactable opportunity needs a verified channel';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_opportunity_before_write
before insert or update on public.opportunities
for each row execute function private.validate_published_opportunity();

alter table public.weekly_batches enable row level security;
alter table public.prospects enable row level security;
alter table public.opportunities enable row level security;

create policy "Members can read their published batches"
on public.weekly_batches for select
to authenticated
using (
  status = 'PUBLISHED'
  and (select private.user_has_firm(firm_id))
);

create policy "Members can read their published opportunities"
on public.opportunities for select
to authenticated
using (
  status = 'PUBLISHED'
  and contactability_status <> 'NOT_CONTACTABLE'
  and (select private.user_has_firm(firm_id))
  and exists (
    select 1
    from public.weekly_batches
    where id = opportunities.weekly_batch_id
      and firm_id = opportunities.firm_id
      and status = 'PUBLISHED'
  )
);

create policy "Members can read delivered prospects"
on public.prospects for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities
    join public.weekly_batches
      on weekly_batches.id = opportunities.weekly_batch_id
    where opportunities.prospect_id = prospects.id
      and opportunities.status = 'PUBLISHED'
      and opportunities.contactability_status <> 'NOT_CONTACTABLE'
      and weekly_batches.status = 'PUBLISHED'
      and (select private.user_has_firm(opportunities.firm_id))
  )
);
