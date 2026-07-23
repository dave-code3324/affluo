create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  city text not null check (char_length(city) between 2 and 120),
  department text not null check (department ~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$'),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (firm_id, user_id),
  unique (user_id)
);

create index firm_members_firm_id_idx on public.firm_members (firm_id);

create table public.firm_preferences (
  firm_id uuid primary key references public.firms (id) on delete cascade,
  nationwide boolean not null default false,
  prospecting_departments text[] not null default '{}',
  target_profiles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nationwide or cardinality(prospecting_departments) > 0),
  check (cardinality(target_profiles) > 0)
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function private.set_updated_at();

create trigger firms_set_updated_at
before update on public.firms
for each row execute function private.set_updated_at();

create trigger firm_preferences_set_updated_at
before update on public.firm_preferences
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, email_confirmed_at)
  values (new.id, new.email, new.email_confirmed_at)
  on conflict (id) do update
  set
    email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.users (id, email, email_confirmed_at)
select id, email, email_confirmed_at
from auth.users
where email is not null
on conflict (id) do update
set
  email = excluded.email,
  email_confirmed_at = excluded.email_confirmed_at,
  updated_at = now();

create or replace function private.user_has_firm(requested_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.firm_members
    where firm_id = requested_firm_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.user_has_firm(uuid) from public;
grant execute on function private.user_has_firm(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.firms enable row level security;
alter table public.firm_members enable row level security;
alter table public.firm_preferences enable row level security;

create policy "Users can read their profile"
on public.users for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can update their profile"
on public.users for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Members can read their firm"
on public.firms for select
to authenticated
using ((select private.user_has_firm(id)));

create policy "Owners can update their firm"
on public.firms for update
to authenticated
using (
  exists (
    select 1
    from public.firm_members
    where firm_id = firms.id
      and user_id = (select auth.uid())
      and role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.firm_members
    where firm_id = firms.id
      and user_id = (select auth.uid())
      and role = 'owner'
  )
);

create policy "Members can read their memberships"
on public.firm_members for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.user_has_firm(firm_id))
);

create policy "Members can read their preferences"
on public.firm_preferences for select
to authenticated
using ((select private.user_has_firm(firm_id)));

create policy "Owners can update their preferences"
on public.firm_preferences for update
to authenticated
using (
  exists (
    select 1
    from public.firm_members
    where firm_id = firm_preferences.firm_id
      and user_id = (select auth.uid())
      and role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.firm_members
    where firm_id = firm_preferences.firm_id
      and user_id = (select auth.uid())
      and role = 'owner'
  )
);

create or replace function public.complete_onboarding(
  firm_name text,
  firm_city text,
  firm_department text,
  is_nationwide boolean,
  departments text[],
  profiles text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_firm_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.firm_members where user_id = current_user_id
  ) then
    raise exception 'Onboarding already completed';
  end if;

  if char_length(trim(firm_name)) not between 2 and 120
    or char_length(trim(firm_city)) not between 2 and 120
    or firm_department !~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$'
    or cardinality(profiles) not between 1 and 20
    or exists (
      select 1 from unnest(profiles) as profile
      where char_length(trim(profile)) not between 1 and 80
    )
    or (
      not is_nationwide
      and (
        cardinality(departments) not between 1 and 101
        or exists (
          select 1 from unnest(departments) as department
          where department !~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$'
        )
      )
    )
  then
    raise exception 'Invalid onboarding data';
  end if;

  insert into public.firms (
    name,
    city,
    department,
    onboarding_completed_at
  )
  values (
    trim(firm_name),
    trim(firm_city),
    upper(firm_department),
    now()
  )
  returning id into new_firm_id;

  insert into public.firm_members (firm_id, user_id, role)
  values (new_firm_id, current_user_id, 'owner');

  insert into public.firm_preferences (
    firm_id,
    nationwide,
    prospecting_departments,
    target_profiles
  )
  values (
    new_firm_id,
    is_nationwide,
    case when is_nationwide then '{}' else departments end,
    profiles
  );

  return new_firm_id;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, boolean, text[], text[]) from public;
grant execute on function public.complete_onboarding(text, text, text, boolean, text[], text[]) to authenticated;
