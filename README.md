# Co-Charger

A React and Supabase prototype for neighbourhood EV charging in India. The site uses the supplied Pantone Cannoli Cream, Amazon and Raspberry colour references.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase project URL and publishable key.
npm run dev
```

The deployed site uses Supabase project `rualnzklgzosnnvmsust` in Mumbai. The publishable key may safely be used by the browser; never put a service-role key in a `VITE_` variable.

## Current workflow

- Visitors can explore clearly labelled sample listings while no hosts are approved.
- Hosts sign in by email and submit a listing. New listings remain `pending` until an operator verifies them in Supabase.
- Verified listings appear publicly; drivers can search by city or neighbourhood and, when they choose, use location to sort nearby listings. Hosts may add a rounded, approximate coordinate.
- Drivers request a duration. The database computes the estimated host charge and 10% platform fee from the listing price.
- Hosts can accept or decline; drivers can cancel. Both parties can use a private booking message thread to agree on access, timing and payment.

## Operator setup

1. In Supabase Authentication → URL Configuration, set the Site URL to `https://co-charger-india.astral-dog-0736.chatgpt.site` and add the same URL to redirect URLs. Add local URLs for development if needed.
2. Review a host's charger type, power, access, and identity before setting `verification_status='verified'` in `public.charger_listings`. The application intentionally cannot verify itself.
3. Configure production email delivery for Supabase Auth before inviting users.
4. Arrange a payment provider and payout/onboarding flow before collecting money. This prototype shows the 10% fee but does not take payments.

The database schema is recorded in `supabase/`. All public tables have row level security and were checked with the Supabase security advisor.
