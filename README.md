# Competiții Regiunea 5 FRB

Web app for organising the regional basketball tournaments of Regiunea 5, Federația Română de Baschet.
Coaches log in, see their teams' groups, volunteer to organise a tournament (date + gym), the other teams
accept/reject, the organiser publishes the game program and enters results.

Stack: **Next.js 16** (App Router, server actions) · **Supabase** (Postgres, Auth, RLS) · Tailwind. Romanian UI, mobile first.

## Local development

Requirements: Node 24, Docker, Supabase CLI (`brew install supabase/tap/supabase`).

```bash
npm install
supabase start              # local Postgres + Auth + Mailpit (emails) in Docker
npm run db:reset            # apply migrations + seed (Turneul 1 groups)
npm run seed:dev-users      # demo accounts, password Parola123!
npm run dev                 # http://127.0.0.1:3000
```

`.env.local` holds the local keys printed by `supabase start` (see `.env.example`).

Demo accounts (`npm run seed:dev-users`, password `Parola123!` for all):

| Account | Role |
| --- | --- |
| admin@test.local | master admin |
| sr5@test.local / sr6@test.local | regional admin SR5 / SR6 |
| star@test.local / ubt@test.local | club admin – ACS Baschet Star / U-BT |
| lps.satumare@test.local, css.sighet@test.local | coaches |
| arbitru5@test.local, arbitru6@test.local | referee SR5 / SR6 |
| arbitru5b@test.local | referee + table official SR5 |
| oficial5@test.local | table official SR5 |

Invitation / password-reset emails are caught locally by Mailpit: http://127.0.0.1:54324.
Database UI (Supabase Studio): http://127.0.0.1:54323.

## Roles

| Role | Sees | Can |
| --- | --- | --- |
| Master admin | everything | everything, incl. creating admins |
| Regional admin (SR5/SR6) | all regional groups; national games of own region | intervene in own-region (and mixed) groups, add national games, nominate officials, manage clubs / users / officials |
| Club admin | championships where the club's teams play; their national games | act for any club team, invite coaches and assign them to club teams |
| Coach | championships where their teams play; their national games | propose / accept / reject hosting, add national games for their team |
| Referee / table official (self sign-up at `/inregistrare-oficiali`) | all regional games; national games of own region | accept / reject nominations (reason required), manage unavailability |

Visibility and permissions are enforced in Postgres (RLS + functions), see
`supabase/migrations/*_roles_national_officials.sql`; the UI only mirrors them.

## Database

- Schema = SQL migrations in `supabase/migrations/` (never edit the DB by hand). New change: `supabase migration new <name>`.
- After a schema change: `npm run db:reset && npm run db:types` (regenerates `src/lib/database.types.ts`).
- Workflow rules (who may propose / respond / confirm, auto-confirmation) live in Postgres functions
  in the init migration; access is enforced by Row Level Security.
- `npm run test:db` runs the SQL tests in `supabase/tests/` (workflow + roles/visibility; rolled back; need a fresh `db:reset`).

### Seed data

`data/turneul1.json` is the cleaned Turneul 1 group list, extracted from
`data/Program campionate regionale_zonale (2).xlsx`. Edit the JSON, then `npm run seed:generate` to rebuild
`supabase/seed.sql`.

## Production: Supabase + Render

**1. Supabase project** (supabase.com, region *Central EU – Frankfurt*)

```bash
supabase login
supabase link --project-ref <project-ref>        # asks for the database password
supabase db push --include-seed                  # migrations + Turneul 1 groups (seed is idempotent)
```

Then in the Supabase dashboard → **Authentication**:
- *Sign In / Providers*: **disable "Allow new users to sign up"** (accounts are created by admins / the officials sign-up page uses the server key).
- *URL Configuration*: Site URL = `https://<render-app>.onrender.com` (or the final domain); Redirect URLs: `https://<render-app>.onrender.com/**`.
- *Emails → Templates*: paste `supabase/templates/invite.html` into **Invite user** and `supabase/templates/recovery.html` into **Reset password** (subjects as in `supabase/config.toml`).
- *Emails → SMTP Settings*: **required** – Supabase's built-in mailer only delivers to the project's team members, so invitations to club admins would not arrive.

**2. Render** (render.com → New → Blueprint → this GitHub repo; `render.yaml` defines the service).
Set the three env vars from Supabase → Project Settings → API Keys:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (secret key).

**3. First master admin** – put the same three values in `.env.production.local` (git-ignored), then:

```bash
npm run create-admin:prod -- email@domeniu.ro "Nume Prenume"   # sends the invitation email
```

Later schema changes: add a migration, test locally (`npm run db:reset && npm run test:db`), then `supabase db push`
and push to GitHub (Render redeploys automatically).

## Not done yet (by design, MVP)

- Email notifications to coaches: recipients are computed (`src/lib/notify.ts`) but nothing is sent until the sender account is chosen.
- Public schedule/results page and the news/blog part.
- Tournaments 2–5 (pyramid promotion/relegation, GVA/GVB) – the schema supports more tournaments, the logic is not built.
- Referees / table officials entering results (they can see and answer nominations already).
