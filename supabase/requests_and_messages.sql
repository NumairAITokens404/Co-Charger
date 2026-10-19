-- Hosts can accept or decline; drivers can cancel. No payment is captured in this MVP.
grant update (status) on public.booking_requests to authenticated;
create policy "Hosts can answer their requests" on public.booking_requests for update to authenticated
using (status = 'pending' and exists (select 1 from public.charger_listings l where l.id = booking_requests.listing_id and l.host_id = (select auth.uid())))
with check (status in ('accepted','declined') and exists (select 1 from public.charger_listings l where l.id = booking_requests.listing_id and l.host_id = (select auth.uid())));
create policy "Drivers can cancel pending requests" on public.booking_requests for update to authenticated
using (status = 'pending' and driver_id = (select auth.uid()))
with check (status = 'cancelled' and driver_id = (select auth.uid()));

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index booking_messages_thread_idx on public.booking_messages(booking_id,created_at);
alter table public.booking_messages enable row level security;
create policy "Booking participants can read messages" on public.booking_messages for select to authenticated
using (exists (select 1 from public.booking_requests b join public.charger_listings l on l.id = b.listing_id where b.id = booking_messages.booking_id and (b.driver_id = (select auth.uid()) or l.host_id = (select auth.uid()))));
create policy "Booking participants can send messages" on public.booking_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and exists (select 1 from public.booking_requests b join public.charger_listings l on l.id = b.listing_id where b.id = booking_messages.booking_id and (b.driver_id = (select auth.uid()) or l.host_id = (select auth.uid()))));
grant select, insert on public.booking_messages to authenticated;
