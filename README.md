# Co-Charger

An India-wide EV charging map project. React, Leaflet, OpenStreetMap tiles, and Supabase.

## What is saved

Supabase Auth stores user logins. The private `public.user_profiles` table stores each user's first name, last name, +91 phone number, and address; row-level security lets users access only their own details. The `public.charger_spots` table stores charger names, cities and areas, approximate coordinates, plug types, and mock hourly rates. 26 clearly labelled demo spots across 17 cities are seeded in the table. There are no bookings, messages, or payments.

## Run locally

```bash
npm --version
npm install
npm run dev
```

Open the localhost URL printed by Vite. This checkout already has a local `.env.local` with the Supabase URL and publishable key. If setting up another computer, copy `.env.example` to `.env.local` and add those two values. Never put a Supabase secret or service-role key in the Vite environment.

For local email sign-in, allow `http://127.0.0.1:5173` in Supabase Auth redirect URLs. If Vite chooses a different port, allow that exact local origin too.

To send sign-in emails from `vibecoders404@gmail.com` with the sender name **Co-Charger**, enable custom SMTP in the project's Supabase Authentication → Emails → SMTP Settings. Use `smtp.gmail.com`, port `465`, and `vibecoders404@gmail.com` as both sender address and SMTP username. The Gmail account owner must enter a Google app password directly into Supabase and save the settings. Google requires 2-Step Verification for app passwords. Do not put the app password in this repository or a Vite environment variable.

The branded **Confirm sign up** and **Magic link or OTP** HTML is kept in `supabase/email-templates/`. These two templates are also configured in the hosted Supabase dashboard. Keep `{{ .ConfirmationURL }}` in each button when editing them; Supabase replaces it with the user's secure link.

A visitor can browse the map without logging in. Click **Use my location** to sort spots within 15 km. If browser location is denied or unavailable, click **Choose on map** and tap an India map point to get the same nearby sorting. The map covers India, including its islands. Coordinate validation uses a broad coverage box, not exact national boundaries. After signing in, users can save their profile and add or remove their own spot. Host pins are rounded to three decimals before storage, so the map does not expose an exact home address. Profile addresses and phone numbers are never shown on the public map.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project**, import the `NumairAITokens404/Co-Charger` GitHub repository, and keep **Root Directory** at the repository root (`./`). The checked-in `vercel.json` selects Vite, runs `npm run build`, and serves `dist`.
2. Before clicking **Deploy**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Environment Variables**. Copy their values from your local `.env.local` or Supabase project settings. Set them for **Production** and **Preview** if you want preview deployments to work. These are browser-facing values; never add a Supabase service-role key or Gmail app password to Vercel's Vite variables.
3. Deploy the `main` branch. Once Vercel gives you the production URL, open Supabase **Authentication → URL Configuration**. Set **Site URL** to that production URL and add the exact production URL under **Redirect URLs**. Keep your local URL there if you still use local sign-in. If you use Vercel preview deployments for sign-in, add a preview URL pattern scoped to your Vercel account or team as described in the Supabase docs.
4. Open the deployed site and test the map, theme switch, and email sign-in. The sign-in link should return to the deployed origin. If you later add a custom domain, update the Supabase Site URL and redirect allow list to include it.

Map tiles come from OpenStreetMap's standard tile service with visible attribution. This is suitable for a small project; a larger public service should choose tile hosting with a service agreement.

## Car hero and themes

The hero uses a high-resolution transparent front view derived from the supplied BMW i7 reference. A large headline sits behind the car while two smaller lines sit on either side. Four SVG headlight glows are anchored to the upper lamp elements shown in the reference and face the viewer. The glows appear in dark mode and switch off in light mode. Light mode keeps the original cream, green, and pink palette. Dark mode uses black backgrounds, white text, and restrained light blue accents. Theme choice is stored in this browser. No third-party car viewer, camera motion, or model controls are loaded.

`supabase/schema.sql` sets up a new database. `supabase/expand-india.sql` and `supabase/add-user-profiles.sql` record the upgrades applied to the existing project. User ownership policies remain enabled.
