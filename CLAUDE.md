# CLAUDE.md — Tarang HRMS (Konkan Coastal Foods)

## What this project is
An HRMS for a 180-person Indian company (head office Panaji, plant Verna). Three modules — Employee Master, Attendance, Leave — plus an AI assistant agent ("Ask HR") that calls server tools. Payroll is out of scope; we only produce the month-end attendance summary.

## Read first
- `RESEARCH.md` — business rules R1–R35 (the source of truth for HR rules)
- `ARCHITECTURE.md` — stack, data model, access control, agent design
- `DESIGN.md` — flows, wireframes, design system. **Follow DESIGN.md** for UI.

If code must depart from ARCHITECTURE.md, update ARCHITECTURE.md and its decision log **first**, then code.

## Stack
Next.js (App Router, TypeScript) on Vercel · Supabase Postgres (RLS) · Clerk (identity only) · Brevo SMTP email · Gemini free tier via Vercel AI SDK · Zod · Vitest · Playwright · date-fns-tz.

## Hard rules
1. **All times in IST (Asia/Kolkata).** Only `src/lib/time/ist.ts` touches time zones. Never use local-time getters (`getHours` etc.) or take "now" from the browser.
2. **Never commit secrets.** No `.env`, keys or tokens in git. Only `.env.example` with blank values. Never print secrets.
3. **Roles are read from the database, never from Clerk.** Every page, action and route calls `requireEmployee()` and the right `requireHrAdmin()` / `requireManagerOf()` / `requireSelfOrHr()` on the server. Hiding a button is not a check.
4. **Never show Aadhaar unmasked** (UI, CSV, logs, agent). PAN as `ABCDE****F`, Aadhaar as `XXXX XXXX 1234`, bank as last 4. HR Reveal is logged to `audit_log`.
5. **Leave balance is calculated, not stored.** One function in `src/lib/domain/balance.ts`. Balance changes only on approval; pending days are reserved; cancellation restores.
6. **Business rules live in `src/lib/domain` as pure functions** (no I/O, no framework imports) with unit tests. The DB enforces invariants (unique, FK, check, triggers, RLS).
7. **The agent never gets credentials or sensitive data.** Tools run on the server as the signed-in user, max 5 tool calls per question, every call logged to `agent_log`, writes are drafts confirmed by a human click. The model cannot approve, reject or cancel.
8. **Service-role key only in server-only modules** (seed, cron, email). Never in client code or sent to the model.
9. **No direct table writes.** `authenticated` has no write grant on business tables; every write is a role-checking Postgres function (see ARCHITECTURE.md §4.2). The browser never talks to Supabase; Supabase URL and anon key are not `NEXT_PUBLIC_`.
10. **LOP and month-end totals come from one function** (`monthSummary`, R24). Leave `days` is a snapshot at submit time. Certificates live in the private `leave-certificates` bucket, served by 60-second signed URLs.

## Folder rules
- `src/app` routes stay thin: auth check → call module service → render.
- `src/modules/<employees|attendance|leave|reports|agent>` own their actions, queries, schemas, components. Modules do not import each other's internals.
- `src/lib/domain`, `lib/auth`, `lib/time`, `lib/validation` are shared.
- `supabase/migrations` for schema; `supabase/seed.ts` for seed data.
- UI uses only `components/ui` primitives; status colours come from the single `STATUS_STYLES` map.

## Working style
- For each build checkpoint: **plan first**, compare with ARCHITECTURE.md, then code.
- **Tests first**: turn the checklist item into a failing test, then implement until it passes.
- Keep changes small; explain any rule you implement (the author must defend it in a viva).
- Do not run database resets, destructive migrations or commit `.env` files without explicit approval.
- Do not build out-of-scope items: payroll, PF/ESI/PT/TDS, recruitment, performance reviews, biometrics/GPS, shifts/overtime, native mobile app, multi-tenant.

## Commands
(Fill in after setup.) `npm run dev` · `npm test` · `npm run lint` · `npm run seed`

## Lessons learned (add repeated mistakes here)
- Never pass the session, the database client or any non-plain object as a prop to a component. In dev, React serializes server-component props for its debug channel and the browser crashes ("reading 'name'", "enqueueModel is not a function"). Pass plain values; get the client inside with the cached `requireEmployee()`.
- Clerk shows secret keys masked as dots. Copy with the Copy button, not by selecting the dots. A key starting with `•` breaks the login handshake.
- A bulk Supabase upsert sends missing keys as `null`; list every column on every row.
