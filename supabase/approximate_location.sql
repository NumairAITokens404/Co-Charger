-- Optional approximate coordinates (two decimals) allow distance sorting without publishing a home address.
alter table public.charger_listings
  add column latitude numeric(5,2) check (latitude between -90 and 90),
  add column longitude numeric(5,2) check (longitude between -180 and 180);
