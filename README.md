# Co-Charger

A simple Hyderabad EV charging map project. React, Leaflet, OpenStreetMap tiles, and Supabase.

## What is saved

Supabase Auth stores user logins. One `public.charger_spots` table stores charger names, Hyderabad areas, approximate coordinates, plug types, and mock hourly rates. Eight clearly labelled demo spots are seeded in the table. There are no bookings, messages, or payments.

## Run locally

```bash
npm install
cp .env.example .env.local
# Add the project's Supabase URL and publishable key to .env.local.
npm run dev
```

The live project is at https://co-charger-india.astral-dog-0736.chatgpt.site. For local email sign-in, add the local origin to the Supabase Auth redirect allow list. The published origin is already configured.

A visitor can browse the map without logging in. Click **Use my location** to sort Hyderabad spots within 15 km. Outside Hyderabad, the app stays on the Hyderabad demo. A signed-in user can add or remove their own spot. Pins are rounded to three decimals before storage, so the map does not expose an exact home address.

Map tiles come from OpenStreetMap's standard tile service with visible attribution. This is suitable for a small project; a larger public service should choose tile hosting with a service agreement.
