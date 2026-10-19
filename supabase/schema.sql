-- Co-Charger MVP schema. Payment capture and electrical verification are out of scope.
create extension if not exists pgcrypto;

create table if not exists public.charger_listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  area text not null check (char_length(area) between 2 and 80),
  city text not null check (char_length(city) between 2 and 80),
  connector text not null check (connector in ('Type 2','15A socket','CCS2')),
  power_kw numeric(5,1) not null check (power_kw between 1 and 50),
  price_per_hour integer not null check (price_per_hour between 1 and 10000),
  description text not null default '' check (char_length(description) <= 1000),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists charger_listings_public_search_idx on public.charger_listings(city, area) where verification_status = 'verified' and is_active = true;
create index if not exists charger_listings_host_idx on public.charger_listings(host_id);
alter table public.charger_listings enable row level security;
create policy "Anyone can browse verified active chargers" on public.charger_listings for select to anon, authenticated using (verification_status = 'verified' and is_active = true);
create policy "Hosts can read their own submissions" on public.charger_listings for select to authenticated using ((select auth.uid()) = host_id);
create policy "Hosts can submit chargers for review" on public.charger_listings for insert to authenticated with check ((select auth.uid()) = host_id and verification_status = 'pending');

grant select on public.charger_listings to anon, authenticated;
grant insert on public.charger_listings to authenticated;

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.charger_listings(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  duration_hours integer not null check (duration_hours between 1 and 12),
  estimated_amount integer not null default 0,
  platform_fee integer not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now()
);
create index if not exists booking_requests_driver_idx on public.booking_requests(driver_id,created_at desc);
create index if not exists booking_requests_listing_idx on public.booking_requests(listing_id,created_at desc);

-- Compute estimates from server-side listing price. No client-supplied amount is trusted.
create or replace function public.set_booking_estimate() returns trigger language plpgsql security invoker set search_path = '' as $$
declare listing_price integer;
begin
  select price_per_hour into listing_price from public.charger_listings
  where id = new.listing_id and verification_status = 'verified' and is_active = true and host_id <> (select auth.uid());
  if listing_price is null then raise exception 'This charger is unavailable'; end if;
  new.estimated_amount := listing_price * new.duration_hours;
  new.platform_fee := round(new.estimated_amount * 0.10);
  new.status := 'pending';
  return new;
end;
$$;
create trigger booking_estimate_before_insert before insert on public.booking_requests for each row execute function public.set_booking_estimate();
revoke all on function public.set_booking_estimate() from public;

aLter table public.booking_requests enable row level security;
create policy "Drivers can read their own requests" on public.booking_requests for select to authenticated using ((select auth.uid()) = driver_id);
create policy "Hosts can read incoming requests" on public.booking_requests for select to authenticated using (exists (select 1 from public.charger_listings l where l.id = booking_requests.listing_id and l.host_id = (select auth.uid())));
create policy "Drivers can request verified chargers" on public.booking_requests for insert to authenticated with check ((select auth.uid()) = driver_id and exists (select 1 from public.charger_listings l where l.id = booking_requests.listing_id and l.verification_status = 'verified' and l.is_active = true and l.host_id <> (select auth.uid())));
grant select, insert on public.booking_requests to authenticated;
