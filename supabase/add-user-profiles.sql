create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 60),
  last_name text not null check (char_length(trim(last_name)) between 1 and 60),
  phone_number text not null check (phone_number ~ '^\+91[0-9]{10}$'),
  address text not null check (char_length(trim(address)) between 5 and 300),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read their own profile"
on public.user_profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Users can create their own profile"
on public.user_profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.user_profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke all on public.user_profiles from anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
