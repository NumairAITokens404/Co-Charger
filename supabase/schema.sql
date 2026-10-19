-- Co-Charger school project: Supabase Auth users + one public Hyderabad spots table.
create extension if not exists pgcrypto;

create table public.charger_spots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  area text not null check (char_length(area) between 2 and 80),
  city text not null default 'Hyderabad' check (city = 'Hyderabad'),
  latitude numeric(6,3) not null check (latitude between 17.15 and 17.65),
  longitude numeric(6,3) not null check (longitude between 78.20 and 78.75),
  plug_type text not null check (plug_type in ('Type 2', '15A socket', 'Portable EVSE')),
  hourly_rate integer not null check (hourly_rate between 1 and 999),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint demo_ownership check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

create index charger_spots_city_idx on public.charger_spots(city);
create index charger_spots_owner_idx on public.charger_spots(owner_id);
alter table public.charger_spots enable row level security;

create policy "Anyone can see Hyderabad spots" on public.charger_spots for select to anon, authenticated using (true);
create policy "Users can add their own spot" on public.charger_spots for insert to authenticated with check (owner_id = (select auth.uid()) and is_demo = false);
create policy "Users can edit their own spot" on public.charger_spots for update to authenticated using (owner_id = (select auth.uid()) and is_demo = false) with check (owner_id = (select auth.uid()) and is_demo = false);
create policy "Users can remove their own spot" on public.charger_spots for delete to authenticated using (owner_id = (select auth.uid()) and is_demo = false);
grant select on public.charger_spots to anon, authenticated;
grant insert, update, delete on public.charger_spots to authenticated;

insert into public.charger_spots (title,area,latitude,longitude,plug_type,hourly_rate,is_demo) values
  ('Gachibowli home plug','Gachibowli',17.440,78.349,'15A socket',70,true),
  ('Kondapur corner cable','Kondapur',17.460,78.365,'Type 2',110,true),
  ('Jubilee Hills driveway','Jubilee Hills',17.433,78.407,'Type 2',120,true),
  ('Banjara Hills spare plug','Banjara Hills',17.416,78.435,'15A socket',80,true),
  ('Madhapur evening charge','Madhapur',17.450,78.391,'Portable EVSE',90,true),
  ('Begumpet neighbour plug','Begumpet',17.445,78.466,'15A socket',60,true),
  ('Secunderabad cable spot','Secunderabad',17.440,78.498,'Type 2',100,true),
  ('Kukatpally home charger','Kukatpally',17.495,78.400,'Type 2',95,true);
