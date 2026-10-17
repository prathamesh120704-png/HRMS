# Tarang HRMS — Konkan Coastal Foods

HRMS for a 180-person company in Goa: Employee Master, Attendance, Leave and an AI assistant ("Ask HR").
Read [RESEARCH.md](RESEARCH.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [DESIGN.md](DESIGN.md) first.

**Live URL:** https://hrms-pi-three.vercel.app

## Status
| Checkpoint | State |
|---|---|
| 1 Research, 2 Architecture and design | Drafted (v0.2), awaiting faculty sign-off |
| 3 Fresh setup | Done: deployed on Vercel (Hobby), connected to Supabase and Clerk (development instance) |
| 4 Database and seed | Migrations 0001-0005 run and seed loaded (20 employees); parity check of SQL vs TypeScript maths still to do |
| Domain rules (working days, day status, Late, accrual, balance, LOP, validation, masking) | Done, 47 unit tests pass in 4 time zones |
| 5 Login and roles | Code written (Clerk -> employees by email, role from DB, access-denied); **not yet tested against live Clerk/Supabase** |
| 6 Employee Master | Directory, multi-step add, profile tabs, masking, self-service edit, deactivate, Reveal, history; **not yet tested live** |
| 7 Attendance | Check in/out/WFH, month calendar, regularisation request, team today, holiday settings; **not yet tested live** |
| 8 Leave balances and apply | Balance cards (opening/accrued/used/pending/available), apply form with live working days, LOP conversion, certificate upload, cancel, optional holidays; SQL vs TypeScript parity verified (640 checks) |
| 9 Approvals and email | Manager/HR inbox (leave and attendance corrections), approve/reject with comment, balance moves pending to used only on approval, clash warning, secure certificate link, team leave calendar, email queue with Brevo sender and daily retry cron. **Run migration 0006.** Emails send only once SMTP is configured |
| 10 Reports | Month-end summary screen and CSV download (HR: everyone, manager: own team), no PAN/Aadhaar/bank columns, formula-injection safe. Totals verified against an independent day-by-day calendar walk for three employees. Seed now adds 45 days of sample attendance |
| 11 HR assistant agent | Ask HR screen, 7 required tools + own tool `month_end_check`, role-filtered tools, 5-call cap, redaction, untrusted-text wrapping, agent_log, drafts confirmed by button. 14 unit tests; **20 of 20 attack/behaviour prompts pass** (`npm run agent:test`, needs migration 0007 and a Gemini key). Free AI tier is about 20 requests per day per model, so the agent falls back across 4 models |
| 12 Test and polish | Not started |

## Setup
```bash
npm install
cp .env.example .env.local     # fill in values; never commit this file
npm test                       # domain unit tests
npm run lint                   # TypeScript check
```
### 1. Supabase
1. Create a free project. Put `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only; no `NEXT_PUBLIC_`).
2. Run `supabase/migrations/0001` to `0007` in order (SQL editor or CLI).
3. Authentication > Sign In / Providers > Third-party: add **Clerk** with your Clerk domain, so Supabase accepts Clerk session tokens.

### 2. Clerk
1. Create an application; put the publishable and secret keys in `.env.local`.
2. Enable the Supabase integration (Clerk Dashboard > Integrations) so session tokens carry `role: authenticated`.
3. Sessions > Customize session token, add the claim: `{"email": "{{user.primary_email_address}}"}`. The database links a first sign-in to its employee row by this verified email.
4. Restrict sign-up (invite-only or allowlist). Create the seed users listed below.

### 3. Seed and run
```bash
npm run seed     # needs SEED_EMAIL_BASE for usable logins; idempotent, never deletes
npm run dev
```

## Test logins
Set `SEED_EMAIL_BASE=you@gmail.com` before seeding. Users are created with plus-addressing and must exist in Clerk (invite-only):
`you+hr@gmail.com` (HR Admin), `you+mgr1@gmail.com`, `you+mgr2@gmail.com`, `you+mgr3@gmail.com` (managers), `you+emp1@gmail.com` ... `you+emp16@gmail.com` (employees). `emp16` joined on 1 July for pro-rating tests.

Testing approvals: Asha (`emp1`) reports to Savita (`mgr1`). Sign in as `emp1`, apply for leave, then sign in as `mgr1` and approve it. HR's own leave needs a second HR Admin to decide it (nobody decides their own request), so use employee requests for the demo.

## Rules
- All times are IST. Never commit secrets. Roles come from the database. See [CLAUDE.md](CLAUDE.md).
