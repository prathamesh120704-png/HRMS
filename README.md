# Tarang HRMS: Konkan Coastal Foods

HRMS for a 180-person company in Goa (head office Panaji, plant Verna): **Employee Master, Attendance, Leave** and an **AI assistant ("Ask HR")** that does real work through server tools.
Indian HR rules throughout: PAN, Aadhaar, UAN and IFSC validation, IST everywhere, location-wise weekly offs and holidays, the company leave policy.

**Live app:** https://hrms-pi-three.vercel.app · **Repo:** https://github.com/prathamesh120704-png/HRMS

## Documents
| File | What it is |
|---|---|
| [RESEARCH.md](RESEARCH.md) | Research answers, sources, and the business rules R1–R35 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, data model, access control, agent design, **decision log** |
| [DESIGN.md](DESIGN.md) | Flows, wireframes, design system |
| [CLAUDE.md](CLAUDE.md) | Rules for Claude Code in this repo, plus lessons learned |
| [VIVA.md](VIVA.md) | Every rule: where it lives and why |
| [DEMO.md](DEMO.md) | The 5–7 minute demo script |
| [docs/TEST-REPORT.md](docs/TEST-REPORT.md) | Automated checklist results (43 checks) |
| [docs/MANUAL-CHECKLIST.md](docs/MANUAL-CHECKLIST.md) | Checklist items that need a signed-in browser |
| [tests/agent/prompts.md](tests/agent/prompts.md) | The 20 agent attack/behaviour prompts and results |

## Status
| # | Checkpoint | State |
|---|---|---|
| 1 | Research | Done. **§8, the interview, is a template to fill with a real conversation** |
| 2 | Architecture and design | Written (v0.2) and reviewed in plan mode. **Faculty sign-off still to be recorded** |
| 3 | Fresh setup | Done: Vercel (Hobby), Supabase, Clerk (development instance), Brevo email |
| 4 | Database and seed | Done: migrations 0001–0007, seed (20 employees, 2 locations, holidays, 45 days sample attendance) |
| 5 | Login and roles | Done and used live: Clerk → employee by email, role from the database, access-denied for inactive users |
| 6 | Employee Master | Done: directory, 4-step add with Indian validation, tabs, masking, self-service edit, deactivate, Reveal, audit history |
| 7 | Attendance | Done: IST check in/out/WFH, month calendar, regularisation, team view, holidays per location |
| 8 | Leave balances and apply | Done: balances, pro-rating, working-day preview, LOP conversion, certificate upload, cancel |
| 9 | Approvals and email | Done: inbox with clash warnings, decisions, secure certificate link, team leave calendar, email queue and daily retry |
| 10 | Reports | Done: month-end summary and CSV, no sensitive columns |
| 11 | HR assistant agent | Done: 7 required tools + `month_end_check`, guardrails, `agent_log`, **20/20 attack prompts pass** |
| 12 | Test and polish | **43/43 automated checks pass**; 80 unit tests; manual list in docs/MANUAL-CHECKLIST.md to tick on the live site |

### Evidence
- `npm test`: 80 unit tests (rules, validation, masking, CSV, agent guardrails), also run under four laptop time zones.
- `npm run checklist`: 43 checks against the real database and live site (constraints that must reject bad data, anonymous access, no secrets in git history, signed-out routes refused).
- SQL and TypeScript leave maths compared on **640 cases** against the live database: 0 differences ([tests/db/parity.md](tests/db/parity.md)).
- `npm run agent:test`: the 20 prompts (needs a Gemini key; the free tier allows about 20 requests per day per model).

## Setup
```bash
npm install
cp .env.example .env.local     # fill in values; never commit this file
npm test                       # unit tests
npm run lint                   # TypeScript check
npm run dev
```

### 1. Supabase
1. Create a free project. Put `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only; no `NEXT_PUBLIC_`).
2. Run `supabase/migrations/0001` to `0007` in order (SQL editor).
3. Authentication → Sign In / Providers → Third-Party Auth → add **Clerk** with your Clerk domain.

### 2. Clerk
1. Create an application (Email sign-in); put the publishable and secret keys in `.env.local`. Copy the secret key with the **Copy** button: a key starting with `•` breaks login.
2. Integrations → Supabase → activate (adds `role: authenticated`).
3. Sessions → Customize session token: `{"role": "authenticated", "email": "{{user.primary_email_address}}"}`. The database links first sign-in to an employee by this verified email.
4. Restrict sign-up (invite-only). Create the test users below.

### 3. Seed
```bash
npm run seed     # set SEED_EMAIL_BASE first for usable logins; idempotent, never deletes
```

### 4. Email and AI (optional but used in the demo)
- **Brevo** (free): SMTP settings and a verified sender go in `SMTP_*` and `EMAIL_FROM`; add `CRON_SECRET` (any long random string) and `APP_URL`.
- **Gemini** (free): `GOOGLE_GENERATIVE_AI_API_KEY` from aistudio.google.com/apikey. `AI_MODEL` is optional (comma-separated list of models tried in order).
- Add the same variables in Vercel and redeploy.

## Test logins
With `SEED_EMAIL_BASE=you@gmail.com`, users are `you+<tag>@gmail.com` and must exist in Clerk:

| Role | Email tag | Person |
|---|---|---|
| HR Admin | `+hr` | Rohan Kamat (KCF0001) |
| Manager | `+mgr1` / `+mgr2` / `+mgr3` | Savita Desai (Panaji finance) / Anand Prabhu (Verna plant) / Neha Shirodkar (sales) |
| Employee | `+emp1` … `+emp16` | `+emp1` Asha Naik reports to Savita; `+emp16` Aditi Joshi joined 1 July (pro-rating) |

Approvals test: sign in as `+emp1`, apply for leave, then as `+mgr1` approve it. HR's own leave needs a second HR Admin (nobody decides their own request).

## Rules (short)
All times IST · never commit secrets · roles come from the database · no direct table writes (every write is a role-checking database function) · Aadhaar is never shown in full. See [CLAUDE.md](CLAUDE.md).
