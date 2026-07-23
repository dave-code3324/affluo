alter type public.email_verification_status rename to verification_status;

create type public.confidence_level as enum (
  'LOW',
  'MEDIUM',
  'HIGH'
);

create type public.signal_verification_status as enum (
  'UNVERIFIED',
  'VERIFIED',
  'REJECTED'
);

create type public.contact_detail_type as enum (
  'PROFESSIONAL_EMAIL',
  'PROFESSIONAL_PHONE',
  'LINKEDIN',
  'COMPANY_WEBSITE'
);

create type public.feedback_decision as enum (
  'TO_CONTACT',
  'TO_MONITOR',
  'NOT_RELEVANT'
);

create type public.feedback_reason as enum (
  'WRONG_PROFILE',
  'WEAK_SIGNAL',
  'WRONG_LOCATION',
  'ALREADY_KNOWN',
  'INSUFFICIENT_CONTACT_DETAILS',
  'OTHER'
);

alter table public.prospects
add column professional_profile_summary text;

alter table public.opportunities
add column confidence_level public.confidence_level not null default 'MEDIUM',
add column qualification_summary text,
add column potential_needs text[] not null default '{}',
add column reviewed_at timestamptz,
add column reviewed_by uuid references public.users (id) on delete set null,
add constraint opportunities_id_firm_unique unique (id, firm_id);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  type text not null,
  title text not null,
  description text not null,
  event_date date,
  detected_at timestamptz not null,
  source_url text,
  source_name text,
  source_published_at timestamptz,
  verification_status public.signal_verification_status not null default 'UNVERIFIED',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_url is null or source_url ~ '^https?://'),
  check (
    verification_status <> 'VERIFIED'
    or (
      source_url is not null
      and source_name is not null
      and verified_at is not null
    )
  )
);

create index signals_prospect_verification_idx
on public.signals (prospect_id, verification_status);

create table public.opportunity_signals (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  signal_id uuid not null references public.signals (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, signal_id)
);

create index opportunity_signals_signal_idx
on public.opportunity_signals (signal_id);

create unique index opportunity_signals_one_primary_idx
on public.opportunity_signals (opportunity_id)
where is_primary;

create table public.contact_details (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  type public.contact_detail_type not null,
  value text not null,
  verification_status public.verification_status not null default 'UNVERIFIED',
  verification_method text,
  verified_at timestamptz,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prospect_id, type, value),
  check (
    type not in ('LINKEDIN', 'COMPANY_WEBSITE')
    or value ~ '^https?://'
  ),
  check (
    type <> 'PROFESSIONAL_EMAIL'
    or value ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  check (
    type <> 'PROFESSIONAL_PHONE'
    or value ~ '^\+?[0-9 ().-]{6,30}$'
  ),
  check (
    verification_status <> 'VERIFIED'
    or verified_at is not null
  )
);

create index contact_details_prospect_verification_idx
on public.contact_details (prospect_id, verification_status);

create unique index contact_details_one_primary_per_type_idx
on public.contact_details (prospect_id, type)
where is_primary and verification_status <> 'INVALID';

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
  end if;

  return new;
end;
$$;

create table public.opportunity_feedback (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  decision public.feedback_decision not null,
  reason public.feedback_reason,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, firm_id),
  foreign key (opportunity_id, firm_id)
    references public.opportunities (id, firm_id)
    on delete cascade,
  check (decision = 'NOT_RELEVANT' or reason is null)
);

create index opportunity_feedback_firm_decision_idx
on public.opportunity_feedback (firm_id, decision);

create index opportunity_feedback_user_idx
on public.opportunity_feedback (user_id);

create trigger signals_set_updated_at
before update on public.signals
for each row execute function private.set_updated_at();

create trigger contact_details_set_updated_at
before update on public.contact_details
for each row execute function private.set_updated_at();

create trigger opportunity_feedback_set_updated_at
before update on public.opportunity_feedback
for each row execute function private.set_updated_at();

create or replace function private.validate_opportunity_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.opportunities
    join public.signals
      on signals.prospect_id = opportunities.prospect_id
    where opportunities.id = new.opportunity_id
      and signals.id = new.signal_id
  )
  then
    raise exception 'Signal and opportunity must reference the same prospect';
  end if;

  return new;
end;
$$;

create trigger validate_opportunity_signal_before_write
before insert or update on public.opportunity_signals
for each row execute function private.validate_opportunity_signal();

alter table public.signals enable row level security;
alter table public.opportunity_signals enable row level security;
alter table public.contact_details enable row level security;
alter table public.opportunity_feedback enable row level security;

create policy "Members can read delivered signals"
on public.signals for select
to authenticated
using (
  verification_status <> 'REJECTED'
  and exists (
    select 1
    from public.opportunity_signals
    join public.opportunities
      on opportunities.id = opportunity_signals.opportunity_id
    join public.weekly_batches
      on weekly_batches.id = opportunities.weekly_batch_id
    where opportunity_signals.signal_id = signals.id
      and opportunities.prospect_id = signals.prospect_id
      and opportunities.status = 'PUBLISHED'
      and weekly_batches.status = 'PUBLISHED'
      and (select private.user_has_firm(opportunities.firm_id))
  )
);

create policy "Members can read delivered opportunity signals"
on public.opportunity_signals for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities
    join public.weekly_batches
      on weekly_batches.id = opportunities.weekly_batch_id
    where opportunities.id = opportunity_signals.opportunity_id
      and opportunities.status = 'PUBLISHED'
      and weekly_batches.status = 'PUBLISHED'
      and (select private.user_has_firm(opportunities.firm_id))
  )
);

create policy "Members can read usable delivered contact details"
on public.contact_details for select
to authenticated
using (
  verification_status <> 'INVALID'
  and exists (
    select 1
    from public.opportunities
    join public.weekly_batches
      on weekly_batches.id = opportunities.weekly_batch_id
    where opportunities.prospect_id = contact_details.prospect_id
      and opportunities.status = 'PUBLISHED'
      and opportunities.contactability_status <> 'NOT_CONTACTABLE'
      and weekly_batches.status = 'PUBLISHED'
      and (select private.user_has_firm(opportunities.firm_id))
  )
);

create policy "Members can read their firm feedback"
on public.opportunity_feedback for select
to authenticated
using ((select private.user_has_firm(firm_id)));

create policy "Members can create their own firm feedback"
on public.opportunity_feedback for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.user_has_firm(firm_id))
  and exists (
    select 1
    from public.opportunities
    join public.weekly_batches
      on weekly_batches.id = opportunities.weekly_batch_id
    where opportunities.id = opportunity_feedback.opportunity_id
      and opportunities.firm_id = opportunity_feedback.firm_id
      and opportunities.status = 'PUBLISHED'
      and weekly_batches.status = 'PUBLISHED'
  )
);

create policy "Members can update their firm feedback"
on public.opportunity_feedback for update
to authenticated
using ((select private.user_has_firm(firm_id)))
with check (
  user_id = (select auth.uid())
  and (select private.user_has_firm(firm_id))
  and exists (
    select 1
    from public.opportunities
    join public.weekly_batches
      on weekly_batches.id = opportunities.weekly_batch_id
    where opportunities.id = opportunity_feedback.opportunity_id
      and opportunities.firm_id = opportunity_feedback.firm_id
      and opportunities.status = 'PUBLISHED'
      and weekly_batches.status = 'PUBLISHED'
  )
);
