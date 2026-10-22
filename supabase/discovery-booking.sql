-- Apply to the existing Co-Charger database. Public pins remain approximate.
alter table public.charger_spots
  add column if not exists available_now boolean not null default false;

create table if not exists public.host_private (
  spot_id uuid primary key references public.charger_spots(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  exact_address text not null check (char_length(trim(exact_address)) between 8 and 300),
  access_notes text not null default '' check (char_length(access_notes) <= 500),
  phone_number text not null check (phone_number ~ '^\+91[0-9]{10}$'),
  updated_at timestamptz not null default now()
);
alter table public.host_private enable row level security;
create policy "Host reads own private details" on public.host_private for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Host adds private details" on public.host_private for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.charger_spots s where s.id = spot_id and s.owner_id = (select auth.uid()) and not s.is_demo
  ));
create policy "Host updates private details" on public.host_private for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.charger_spots s where s.id = spot_id and s.owner_id = (select auth.uid()) and not s.is_demo
  ));
revoke all on public.host_private from anon, authenticated;
grant select, insert on public.host_private to authenticated;
grant update (exact_address, access_notes, phone_number, updated_at) on public.host_private to authenticated;

create table if not exists public.host_reviews (
  spot_id uuid primary key references public.charger_spots(id) on delete cascade,
  status text not null check (status in ('pending', 'verified', 'rejected')) default 'pending',
  reviewed_at timestamptz,
  reviewer_note text
);
alter table public.host_reviews enable row level security;
create policy "Review status is public" on public.host_reviews for select to anon, authenticated using (true);
revoke all on public.host_reviews from anon, authenticated;
grant select on public.host_reviews to anon, authenticated;

create table if not exists public.host_bookings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.charger_spots(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  driver_note text not null default '' check (char_length(driver_note) <= 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  responded_at timestamptz,
  check (ends_at > starts_at),
  check (driver_id <> host_id)
);
create index if not exists host_bookings_host_idx on public.host_bookings(host_id, created_at desc);
create index if not exists host_bookings_driver_idx on public.host_bookings(driver_id, created_at desc);
alter table public.host_bookings enable row level security;
create policy "Booking participants read" on public.host_bookings for select to authenticated
  using (driver_id = (select auth.uid()) or host_id = (select auth.uid()));
revoke all on public.host_bookings from anon, authenticated;
grant select on public.host_bookings to authenticated;
create policy "Accepted driver reads host details" on public.host_private for select to authenticated
  using (exists (
    select 1 from public.host_bookings b
    where b.spot_id = host_private.spot_id and b.driver_id = (select auth.uid())
      and b.status = 'accepted' and b.ends_at > now()
  ));

-- Existing charger_spots ownership RLS still limits updates to the owning host.
-- Verification lives in host_reviews, which has no client write grant.

create table if not exists public.public_stations (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  operator_name text not null,
  station_name text not null,
  address text not null,
  city text not null,
  state text not null,
  latitude numeric(9,6) not null check (latitude between 6 and 37.6),
  longitude numeric(9,6) not null check (longitude between 68 and 97.5),
  connector_types text[] not null,
  max_power_kw numeric(7,2),
  source_url text not null,
  source_published_at date not null,
  imported_at timestamptz not null default now(),
  review_status text not null default 'directory' check (review_status in ('directory', 'location_checked', 'access_checked')),
  disabled boolean not null default false
);
create index if not exists public_stations_coordinates_idx on public.public_stations(latitude, longitude);
create index if not exists public_stations_city_idx on public.public_stations(city);
alter table public.public_stations enable row level security;
create policy "Public stations are visible" on public.public_stations for select to anon, authenticated
  using (not disabled);
revoke all on public.public_stations from anon, authenticated;
grant select on public.public_stations to anon, authenticated;

-- RPCs are the only write path for bookings. A driver cannot forge acceptance.
create or replace function public.request_host_booking(p_spot_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_starts_at < now() or p_starts_at > now() + interval '30 days'
     or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '8 hours'
     or char_length(coalesce(p_note, '')) > 300 then
    raise exception 'Invalid booking time or note';
  end if;
  select owner_id into v_owner from public.charger_spots
    where id = p_spot_id and not is_demo and available_now = true;
  if v_owner is null or v_owner = auth.uid() then raise exception 'Host is unavailable'; end if;
  if not exists (select 1 from public.host_private where spot_id = p_spot_id and owner_id = v_owner) then
    raise exception 'Host has not completed booking details';
  end if;
  if exists (select 1 from public.host_bookings where spot_id = p_spot_id and status = 'accepted'
      and starts_at < p_ends_at and ends_at > p_starts_at) then
    raise exception 'Time is already booked';
  end if;
  insert into public.host_bookings(spot_id, host_id, driver_id, starts_at, ends_at, driver_note)
    values (p_spot_id, v_owner, auth.uid(), p_starts_at, p_ends_at, coalesce(p_note, '')) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.respond_host_booking(p_booking_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_booking public.host_bookings%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_booking from public.host_bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.host_id <> auth.uid() then raise exception 'Booking not found'; end if;
  if v_booking.status <> 'pending' then raise exception 'Booking already handled'; end if;
  if v_booking.expires_at <= now() or v_booking.starts_at <= now() then
    update public.host_bookings set status = 'expired', responded_at = now() where id = p_booking_id;
    return;
  end if;
  -- Serialize responses for this charger so overlapping pending requests cannot both be accepted.
  perform 1 from public.charger_spots where id = v_booking.spot_id for update;
  if p_accept and exists (select 1 from public.host_bookings where spot_id = v_booking.spot_id
    and id <> p_booking_id and status = 'accepted' and starts_at < v_booking.ends_at and ends_at > v_booking.starts_at) then
    raise exception 'Time is already booked';
  end if;
  update public.host_bookings set status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now() where id = p_booking_id;
end; $$;

create or replace function public.cancel_host_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.host_bookings set status = 'cancelled', responded_at = now()
    where id = p_booking_id and driver_id = auth.uid() and status in ('pending', 'accepted')
      and starts_at > now();
  if not found then raise exception 'Booking cannot be cancelled'; end if;
end; $$;

revoke all on function public.request_host_booking(uuid,timestamptz,timestamptz,text) from public;
revoke all on function public.respond_host_booking(uuid,boolean) from public;
revoke all on function public.cancel_host_booking(uuid) from public;
revoke all on function public.request_host_booking(uuid,timestamptz,timestamptz,text) from anon;
revoke all on function public.respond_host_booking(uuid,boolean) from anon;
revoke all on function public.cancel_host_booking(uuid) from anon;
grant execute on function public.request_host_booking(uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.respond_host_booking(uuid,boolean) to authenticated;
grant execute on function public.cancel_host_booking(uuid) to authenticated;
