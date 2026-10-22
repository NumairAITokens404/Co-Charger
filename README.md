# Co-Charger

An India-wide EV charging map project. React, Leaflet, OpenStreetMap tiles, and Supabase.

## What is saved

Supabase Auth stores user logins. The private `public.user_profiles` table stores each user's first name, last name, +91 phone number, and address; row-level security lets users access only their own details. The `public.charger_spots` table stores host names, cities and areas, approximate coordinates, plug types, and hourly rates. 26 clearly labelled demo spots across 17 cities are seeded in the table.

The discovery pilot also stores public charging stations from the Bureau of Energy Efficiency (BEE), host booking requests, host review status, and private host contact details. The directory is dated and is **not** live availability. Public-station charging and payment happen with the operator. Home bookings do not collect payment yet.

## Discovery and bookings

The map starts in Hyderabad. Small green house markers represent real home hosts, pink house markers identify demo homes, and blue lightning markers represent public stations. Nearby pins group into compact numbered circles until the driver zooms in. The list initially shows 20 places, with more available on request. Search can find cities elsewhere in India. The map and list show the current viewport, and search can jump to a result outside it. Public listings show their source and publication date, with an extra warning after six months. A BEE listing is labelled **official directory, access unconfirmed** unless Co-Charger has separately reviewed its access. The original BEE PDF is linked in each listing.

The optional route estimate is inside “More filters and route estimate.” Drivers can select a car model and enter battery percentage. The model fallback uses 70% of the lower-capacity variant's published certified full-charge range; the driver can override that with their own full-charge range or, preferably, the remaining range shown by their car. These model values are rough planning assumptions based on [Tata Nexon EV](https://ev.tatamotors.com/content/dam/tml/ev/products/nexon/year-2024/ev/promoting-vc/brochure/nexon-ev-mr-and-lr-brochure.pdf), [Tata Punch EV](https://ev.tatamotors.com/content/dam/tml/ev/pdf/owners-manual/punch-ev-owner-manual.pdf), [MG ZS EV](https://www.mgmotor.co.in/vehicles/mgzsev-electric-car-in-india), [Mahindra BE 6](https://booking.mahindra.com/on/demandware.static/-/Library-Sites-eSUVSharedLibrary/default/MBE6/MBE6-Brochure-Specification.pdf), and [Hyundai Creta Electric](https://www.hyundai.com/in/en/find-a-car/creta-electric/specification). Once a starting point and destination are selected, `/api/route` requests a driving distance from openrouteservice using a **server-only** `ORS_API_KEY`. A result is "likely reachable" only when the supplied/estimated range exceeds road distance by at least 5 km or 20%, whichever is greater. This is a planning hint, not a guarantee. If routing or the key is unavailable, the app shows reachability as unknown. The Google Maps button launches driving navigation from the device location; accepted home bookings use the exact address, while other home links use the approximate pin.

Real hosts add an exact charging address and access notes separately from their approximate public pin. They can switch requests on or off. Signed-in drivers with a profile can request a slot. The host accepts or declines in the Bookings section; the driver sees the exact address and phone only after acceptance and until the booking ends. Both parties should keep the page open or refresh Bookings to see requests; there are no push, SMS, or email booking notifications in this pilot. Requests expire after 30 minutes and cannot be accepted once expired. Reviews are a separate admin-only table, so self-posted spots are never automatically called verified.

Apply `supabase/discovery-booking.sql` to an existing database before deploying the new UI. On a new database, apply `supabase/schema.sql` first, then `supabase/discovery-booking.sql`. Administrators can mark a host verified only after checking identity, charger details, and access; update `host_reviews` through a trusted admin SQL session or service, never from a browser key.

## Refresh public stations

The official [BEE charging page](https://www.beeindia.gov.in/show_content.php?lang=1&level=2&lid=67&ls_id=345) links a dated PDF with operators, coordinates, and connectors. `scripts/import_bee_stations.py` discovers the newest linked PDF, extracts car-compatible rows, groups duplicate connector rows by operator/address/location, discards unreadable PDF text, and records the source date and link. It does not scrape operator sites that forbid automated collection. The BEE copyright policy requires prominent source acknowledgement, provided in the app.

Run a local preview with the bundled Python runtime or Python 3.12 plus `pdfplumber==0.11.7`:

```bash
python scripts/import_bee_stations.py --dry-run --json-out /tmp/cocharger-stations.json
```

The weekly GitHub Actions workflow runs the importer with `--sync`. Add repository secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for the connected project before enabling it. Keep the secret key out of Vite variables and browser code. The importer refuses to sync fewer than 100 parsed stations and hides records from an older publication only after a complete healthy import. Review Hyderabad entries for location and public access before setting `review_status` to `location_checked` or `access_checked`; imported rows start as `directory`. The October 2025 directory has already been imported into the connected pilot database, with 8,307 car-compatible station records, including 121 whose city is Hyderabad.

## Checks

```bash
npm run build
node --test tests/route.test.js
python -m unittest discover -s tests -p 'test_*.py'
```

The Python tests require `pdfplumber`. The booking RPCs were also checked on the connected Supabase project using temporary users, a temporary host and bookings inside rolled-back transactions: pre-acceptance privacy, acceptance, decline, expiry, overlapping acceptance, and unrelated-user access.

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

A visitor can browse the map without logging in. Click **Near me** to sort places by direct distance, or **Choose point** and tap the map. The map covers India, including its islands. Coordinate validation uses a broad coverage box, not exact national boundaries. After signing in, users can save their profile and add or remove their own spot. Host pins are rounded to three decimals before storage, so the map does not expose an exact home address. Profile addresses and phone numbers are never shown on the public map.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project**, import the `NumairAITokens404/Co-Charger` GitHub repository, and keep **Root Directory** at the repository root (`./`). The checked-in `vercel.json` selects Vite, runs `npm run build`, and serves `dist`.
2. Before clicking **Deploy**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Environment Variables**. Add `ORS_API_KEY` as a server-only variable for road distance. Copy the two Vite values from your local `.env.local` or Supabase project settings. Set them for **Production** and **Preview** if you want preview deployments to work. Never add a Supabase service-role key or Gmail app password to Vercel's Vite variables.
3. Deploy the `main` branch. Once Vercel gives you the production URL, open Supabase **Authentication → URL Configuration**. Set **Site URL** to that production URL and add the exact production URL under **Redirect URLs**. Keep your local URL there if you still use local sign-in. If you use Vercel preview deployments for sign-in, add a preview URL pattern scoped to your Vercel account or team as described in the Supabase docs.
4. Open the deployed site and test the map, theme switch, and email sign-in. The sign-in link should return to the deployed origin. If you later add a custom domain, update the Supabase Site URL and redirect allow list to include it.

Map tiles come from OpenStreetMap's standard tile service with visible attribution. This is suitable for a small project; a larger public service should choose tile hosting with a service agreement.

## Car hero and themes

The hero uses a high-resolution transparent front view derived from the supplied BMW i7 reference. A large headline sits behind the car while two smaller lines sit on either side. Four SVG headlight glows are anchored to the upper lamp elements shown in the reference and face the viewer. The glows appear in dark mode and switch off in light mode. Light mode keeps the original cream, green, and pink palette. Dark mode uses black backgrounds, white text, and restrained light blue accents. Theme choice is stored in this browser. No third-party car viewer, camera motion, or model controls are loaded.

`supabase/schema.sql` sets up a new database. `supabase/expand-india.sql` and `supabase/add-user-profiles.sql` record the upgrades applied to the existing project. User ownership policies remain enabled.
