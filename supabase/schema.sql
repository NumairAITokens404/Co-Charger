-- Co-Charger school project: Supabase Auth users + one public India spots table.
create extension if not exists pgcrypto;

create table public.charger_spots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  area text not null check (char_length(area) between 2 and 80),
  city text not null check (char_length(trim(city)) between 2 and 80),
  latitude numeric(6,3) not null check (latitude between 6 and 37.6),
  longitude numeric(6,3) not null check (longitude between 68 and 97.5),
  plug_type text not null check (plug_type in ('Type 2', '15A socket', 'Portable EVSE')),
  hourly_rate integer not null check (hourly_rate between 1 and 999),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint demo_ownership check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

create index charger_spots_city_idx on public.charger_spots(city);
create index charger_spots_owner_idx on public.charger_spots(owner_id);
alter table public.charger_spots enable row level security;

create policy "Anyone can see charger spots" on public.charger_spots for select to anon, authenticated using (true);
create policy "Users can add their own spot" on public.charger_spots for insert to authenticated with check (owner_id = (select auth.uid()) and is_demo = false);
create policy "Users can edit their own spot" on public.charger_spots for update to authenticated using (owner_id = (select auth.uid()) and is_demo = false) with check (owner_id = (select auth.uid()) and is_demo = false);
create policy "Users can remove their own spot" on public.charger_spots for delete to authenticated using (owner_id = (select auth.uid()) and is_demo = false);
grant select on public.charger_spots to anon, authenticated;
grant insert, update, delete on public.charger_spots to authenticated;

insert into public.charger_spots (title,area,city,latitude,longitude,plug_type,hourly_rate,is_demo) values
  ('Gachibowli home plug','Gachibowli','Hyderabad',17.440,78.349,'15A socket',70,true),
  ('Kondapur corner cable','Kondapur','Hyderabad',17.460,78.365,'Type 2',110,true),
  ('Jubilee Hills driveway','Jubilee Hills','Hyderabad',17.433,78.407,'Type 2',120,true),
  ('Banjara Hills spare plug','Banjara Hills','Hyderabad',17.416,78.435,'15A socket',80,true),
  ('Madhapur evening charge','Madhapur','Hyderabad',17.450,78.391,'Portable EVSE',90,true),
  ('Begumpet neighbour plug','Begumpet','Hyderabad',17.445,78.466,'15A socket',60,true),
  ('Secunderabad cable spot','Secunderabad','Hyderabad',17.440,78.498,'Type 2',100,true),
  ('Kukatpally home charger','Kukatpally','Hyderabad',17.495,78.400,'Type 2',95,true);

-- Additional demo locations across India.
insert into public.charger_spots (title,area,city,latitude,longitude,plug_type,hourly_rate,is_demo)
select v.*,true from (values
('Bandra apartment plug','Bandra West','Mumbai',19.060,72.835,'Type 2',120),
('Andheri spare cable','Andheri East','Mumbai',19.117,72.863,'15A socket',75),
('Indiranagar home plug','Indiranagar','Bengaluru',12.978,77.640,'Type 2',100),
('Koramangala spare cable','Koramangala','Bengaluru',12.935,77.624,'Portable EVSE',85),
('Saket driveway plug','Saket','New Delhi',28.524,77.206,'Type 2',110),
('Salt Lake home cable','Salt Lake','Kolkata',22.586,88.417,'15A socket',65),
('Adyar neighbourhood plug','Adyar','Chennai',13.006,80.257,'Type 2',90),
('Baner home charger','Baner','Pune',18.560,73.786,'Portable EVSE',80),
('Navrangpura spare cable','Navrangpura','Ahmedabad',23.037,72.561,'15A socket',60),
('C-Scheme driveway','C-Scheme','Jaipur',26.907,75.797,'Type 2',95),
('Gomti Nagar home plug','Gomti Nagar','Lucknow',26.856,81.008,'15A socket',65),
('Panampilly cable spot','Panampilly Nagar','Kochi',9.956,76.299,'Portable EVSE',70),
('Sector 35 spare charger','Sector 35','Chandigarh',30.727,76.760,'Type 2',90),
('Dispur neighbourhood cable','Dispur','Guwahati',26.143,91.790,'15A socket',60),
('Patia home plug','Patia','Bhubaneswar',20.355,85.822,'Type 2',80),
('Panaji home charger','Panaji','Goa',15.491,73.828,'Portable EVSE',85),
('Vijay Nagar spare cable','Vijay Nagar','Indore',22.753,75.894,'15A socket',65),
('Marine Hill demo plug','Marine Hill','Sri Vijaya Puram',11.675,92.744,'15A socket',75)
) v(title,area,city,latitude,longitude,plug_type,hourly_rate)
where not exists (select 1 from public.charger_spots s where s.is_demo and s.title=v.title and s.city=v.city);

-- Private account details; only the signed-in owner can read or edit them.
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
