# MicroTask

A local micro-task marketplace. People post short jobs (10–60 minutes) on a map, nearby helpers request to take them, and payment is held in escrow until the work is done.

**Live demo:** https://microtask-bice.vercel.app

**Try it:** sign up with email or Google, browse tasks on the map or in the feed, and post your own. Payments run in Stripe test mode — use card `4242 4242 4242 4242`, any future date and any CVC.

## Features

- **Task lifecycle with escrow** — `open → accepted → funded → in_progress → completed → paid`. The poster funds the task through Stripe Checkout after accepting a helper, and the payment is released once the work is marked complete.
- **Request / accept flow** — helpers send requests, posters review profile and rating before accepting. Duplicate requests are blocked by a database constraint.
- **Map-based discovery** — Leaflet map with marker clustering and OpenStreetMap tiles. With GPS on, tasks are filtered by radius and show their distance; without it, the map frames every open task.
- **Filterable feed** — search, category, price range and sorting.
- **Real-time chat** between poster and helper, scoped to each task (Supabase Realtime).
- **Trust layer** — deterministic, explainable scoring in `src/lib`:
  - `dealConfidence.ts` — 0–100 confidence score for a deal, with the factors behind it
  - `qualityEngine.ts` — quality checks for tasks, users, requests and active deals, returning warnings and concrete recommendations
- **Accounts** — email and Google sign-in, email verification, password reset, identity and address verification requests.
- **Reviews and notifications** — ratings on both sides, live notification badge.
- **Admin dashboard** — health alerts (stuck payments, stale tasks, flagged users), moderation, platform fee setting.
- **Mobile-first** — every page checked for layout issues at widths from 320px to 1280px.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query, Framer Motion |
| Backend | Supabase (Postgres, Auth, Realtime, Row Level Security) |
| Server logic | Supabase Edge Functions (Deno) |
| Payments | Stripe Checkout |
| Maps | Leaflet, OpenStreetMap |
| Hosting | Vercel |
| Tests | Vitest |

## Architecture

- **Postgres + RLS** carries the authorization model: every table (`tasks`, `task_applications`, `task_messages`, `payments`, `reviews`, …) has row-level policies, so the client talks to the database directly and can only see or change what it should.
- **Edge Functions** handle anything that needs a secret or must be atomic: accepting a request, creating / verifying / releasing / cancelling a payment, and status transitions. They use the service-role key server-side only.
- **Platform fee** is read from `app_settings` (default 8%) so it can be changed from the admin panel without a deploy.

```
src/
  pages/          route-level screens
  components/     UI, grouped by feature (chat, map, reviews, admin, …)
  lib/            scoring engines and health alerts (pure, testable)
  integrations/   Supabase client and generated types
supabase/
  migrations/     schema, RLS policies, triggers
  functions/      edge functions (payments, task status, requests)
```

## Run locally

```bash
cp .env.example .env    # fill in your Supabase URL and anon key
npm install
npm run dev             # http://localhost:8080
```

Database and functions:

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

Google sign-in needs the Google provider enabled in Supabase Auth, and `http://localhost:8080/**` added to the allowed redirect URLs.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run lint` | ESLint |
