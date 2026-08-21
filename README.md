# Mindburst

Multi-tenant business management SaaS platform. This milestone ships the
platform foundation (multi-tenant auth, RBAC, RLS) plus the first business
module: IT Ticketing.

Stack: React + TypeScript + Vite + React Router + Tailwind + shadcn/ui,
backed by Supabase (Postgres, Auth, Storage, Edge Functions), deployed on
Vercel.

## Project structure

```
src/
  app/            App-level composition (router)
  components/     ui (shadcn), layout (sidebars/shells), shared (badges, empty/error/loading states)
  features/       platform (company admin UI), it/tickets (ticketing feature)
  lib/            supabase client, auth, tenant (company context), permissions
  pages/          route-level screens, grouped by platform/company/it
  routes/         route guards (RequireAuth, RequirePlatformAdmin, RequireCompanyAccess, RequireModule)
  types/          hand-written types mirroring the DB schema
supabase/
  migrations/     the entire database + RLS security model, in order
  functions/      Edge Functions (invite-user) — anything needing the secret key
```

## 1. Environment setup

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your
Supabase project settings (Project ID `ddtwiujzbwwgvjcdkexv`). Never put the
secret/service-role key in `.env` under `VITE_*` — it must only exist as a
Supabase Edge Function secret (`supabase secrets set`), never in client code.

```bash
npm install
npm run dev
```

## 2. Apply database migrations

This repo was never linked to a live Supabase project during generation (no
credentials were available). Link and push the migrations yourself:

```bash
npx supabase login
npx supabase link --project-ref ddtwiujzbwwgvjcdkexv
npx supabase db push
```

This creates every table, RLS policy, trigger, and helper function described
below, and seeds the permission catalog.

## 3. Deploy the Edge Function

`invite-user` creates auth users (requires the Admin API / secret key), so it
must run server-side:

```bash
npx supabase functions deploy invite-user
npx supabase secrets set SUPABASE_SECRET_KEY=your_secret_key_here
```

## 4. Create the first Platform Superadmin

There is no self-serve signup for platform admins by design. In the Supabase
SQL editor (or via `supabase db execute`), after creating the user in
Authentication → Users:

```sql
insert into public.platform_admins (user_id)
values ('<the user''s auth.users id>');
```

They can then sign in at `/platform/login`.

## 5. Try the golden path

1. `/platform/login` → sign in as the Superadmin.
2. `/platform/companies` → create a company (name, slug, code) and enable the
   IT module.
3. In the company's detail panel, invite a Company Admin by email.
4. The admin accepts the invite, signs in at `/c/{slug}/login`, and lands on
   the company dashboard.
5. IT → Tickets → New ticket → assign, comment, resolve, close.

## Security model (short version)

Every tenant-owned table has Row Level Security enabled. Access is decided
entirely in Postgres via `has_company_access()`, `has_permission()`, and
`has_module_enabled()` (see `supabase/migrations/20260101000007_*`) — the
frontend's `Can` component and route guards are convenience/UX only, not the
enforcement boundary. See the comments throughout `supabase/migrations/` for
the reasoning behind each policy.

## Deployment (Vercel)

```bash
vercel link
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
vercel deploy
```

`vercel.json` rewrites all paths to `index.html` so client-side routing
(React Router) works on refresh/direct links.
