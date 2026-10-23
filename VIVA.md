# Viva notes: every rule, where it lives, how it works

For each rule: **what** it is, **where** it is in the code, and **why** it is built that way. Read the code once for each row so you can
open it live. Rule numbers (R1…R35) are in [RESEARCH.md](RESEARCH.md) §11.

## 1. Time and attendance

| Question | Answer | Where |
|---|---|---|
| How do you keep everything in IST? | One module, `ist.ts`, is the only file that touches time zones. Times are stored as UTC instants (`timestamptz`); dates (attendance day, leave day, holiday) are plain IST calendar dates. The server takes "now" from its own clock, never the browser. Tests pass under four laptop time zones. | `src/lib/time/ist.ts`, `check_in()` SQL |
| What is Late? | Check-in strictly after 10:15:00 IST. Exactly 10:15 is on time. | `lateRules.ts` `isLate` |
| Three Lates? | Every 3 Late marks in a calendar month = half a day of LOP: `floor(lates/3) × 0.5`. Computed at report time, not stored, so it can never drift. | `lopFromLates`, `monthSummary` |
| Present / Half Day / Absent? | ≥ 8 h Present, 4 to < 8 h Half Day, < 4 h or no punch Absent. A check-in with no check-out has no hours, so it is Absent until regularised. | `dayStatus.ts` `deriveDayStatus` |
| Why no second attendance row for a day? | `unique(employee_id, date)` in Postgres; check-in uses `insert … on conflict do nothing`. A double-click or two tabs cannot create a second record. | `0001_schema.sql`, `check_in()` |
| Holidays and weekly offs per location? | Each location has its own `weekly_off_days` and its own holidays. Panaji Sat+Sun off, Verna Sunday only. A Verna holiday does not exist for Panaji. | `locations`, `holidays`, `nonWorkingReason` |
| Approved leave vs a punch? | On Leave wins. Half-day leave: the other half follows the hours worked. | `deriveDayStatus` (R13, R28) |
| How does regularisation work? | The request is only a request. `decide_regularisation` writes the attendance row only on approve, and only a manager or HR (never the requester) can approve. Limited to the last 30 days. | `decide_regularisation()` |

## 2. Leave

| Question | Answer | Where |
|---|---|---|
| How are leave days counted? | Walk every date in the range; skip weekly offs and holidays *of that employee's location*. Friday to Monday at head office = 2. | `workingDays.ts` `countWorkingDays` |
| What is the sandwich rule? | Charging the weekly offs/holidays between two leave days as leave too. Konkan has none, so they are simply not counted. | R18 |
| What is the balance formula? | `available = opening + adjustment + accrued − used(approved) − pending`. One pure function. **Calculated, never stored**, so an approval, cancel or backdated change cannot leave a stored number wrong. | `balance.ts`, `leaveBalance.ts` |
| Why does the balance drop while a request is pending? | Pending days are *reserved* so a person cannot spend the same day twice. Approval moves pending → used, so `available` is unchanged; reject or cancel releases it. | `decide_leave()` |
| Pro-rating? | Joined on or before the 15th: months remaining include the joining month; after the 15th it is excluded. `quota × months/12`, rounded to the nearest 0.5. Joined 1 July: CL 4, SL 3.5. | `accrual.ts` `proratedQuota` |
| EL? | 1.25 days per **completed** calendar month (a month counts when you were there on its 1st and it has ended). Carry forward capped at 30; CL and SL lapse on 31 Dec. | `accruedMonthly`, `carryForward`, `ensure_balances()` |
| Not enough balance? | The app offers to convert the excess to LOP. The split is on whole days: `floor(available)` days use the type, the rest become LOP; the two rows are approved or cancelled together. | `splitForLop`, `submit_leave()` |
| SL over 2 days? | Needs a certificate: PDF/JPG/PNG up to 2 MB into a **private** bucket, opened through 60-second signed links, readable only by owner, their manager and HR. | `leaveRules.ts`, `/api/certificate` |
| Can HR change the leave rules? | Yes (L1): Settings → Leave types, an HR-only database function. The rules still hold: Loss of Pay can never get a quota, a type with no accrual or granted on request cannot carry forward, the code is fixed for life, types are never deleted, and every change is audited. Balances are calculated live, so an edit applies to everyone immediately. The seed no longer resets them. | `hr_update_leave_type()`, `leaveType.ts` |
| Two requests on the same day? | Impossible: a database *exclusion constraint* on the date range of live requests. | `leave_no_overlap` |
| Can someone approve their own leave? | No. Four layers: the inbox hides your own; `can_decide_for()` refuses; the table has `check (approver_id <> employee_id)`; the agent has no approve tool. | R34 |
| Why is the working-day count written twice (SQL and TypeScript)? | The database function must recount so a caller cannot send fake `days`, and the balance check must be atomic with the insert. The TypeScript copy powers the instant preview. I compared them on **640 cases** against the live database: 0 differences (logged in ARCHITECTURE.md). | `leave_count_days()`, `tests/db/parity.md` |

## 3. Employee data and privacy

| Question | Answer | Where |
|---|---|---|
| Validation rules? | PAN `[A-Z]{5}[0-9]{4}[A-Z]`, Aadhaar 12 digits, UAN 12 digits (optional), IFSC `[A-Z]{4}0[A-Z0-9]{6}`, mobile `[6-9]\d{9}`, PIN 6 digits, state from a list, age ≥ 18 on joining. Checked in the form (Zod) **and** by database CHECK constraints, so bypassing the app still fails. | `validation/indian.ts`, `0001_schema.sql` |
| Employee code? | `KCF` + a database sequence, so two HR users cannot get the same one. A trigger blocks any change, forever. | `employee_code_seq`, trigger |
| Reporting loops? | A trigger walks up the manager chain; if it meets the employee, the change is refused. | `employees_no_reporting_loop` |
| Why are PAN, Aadhaar and bank in separate tables? | Row-level security works on rows, not columns. A separate table lets us say "only the owner and HR" without exposing the same rule to the directory. | `employee_statutory`, `employee_bank` |
| Masking? | PAN `ABCDE****F`, Aadhaar `XXXX XXXX 1234`, account last 4. Masked on the server before anything leaves it. **Aadhaar can never be revealed, not even by HR** (stricter than the brief; open question for faculty). HR can Reveal PAN or account; every Reveal is logged. The audit log stores masked values too. | `mask.ts`, `hr_reveal()`, `audit_mask()` |
| Audit trail? | Database triggers write who/what/old/new/when for job and statutory changes, so no code path can skip it. The log is append-only. | `audit_row()` |

## 4. Security and roles

| Question | Answer |
|---|---|
| Where is the role stored? | In **our** database (`employees.is_hr_admin`). Manager is *derived*: anyone who is `reporting_manager_id` of an active employee. Clerk only proves identity. |
| Where is it checked? | On the server, every request: `getSession()` links the Clerk user to the employee row, rejects inactive people and past last-working-day, and reads the role. Pages call `requireHr()` / `requireManagerOrHr()`. Hiding a button is never the check. |
| What stops a user using the database directly? | The `authenticated` role has **no write permission on any table**. Every write is a Postgres function that reads the caller from the token and re-checks the role inside. RLS limits reads. The Supabase key is server-only; the browser never talks to the database. |
| URL tampering? | `/employees/<id>` returns 404 for non-HR; `/profile` has no id to change; RLS is the second wall. |
| Secrets? | Only `.env.example` (blank) is in git; I scanned every commit for key shapes: none. |
| The bug I hit with props? | Passing the session object (it holds the database client) as a component prop crashed React's dev debug channel. Fix: pass plain values only. Recorded in CLAUDE.md. |

## 5. The AI agent

| Question | Answer |
|---|---|
| What does the agent do? | It decides **which tool to call**; the tools are the same server functions the screens use, so numbers come from code. |
| Can it leak Aadhaar? | No tool reads those tables; a redaction filter also strips sensitive keys and ID-shaped values from every result and log; the prompt forbids it. Tested with 3 attack prompts. |
| Can it approve or cancel? | No such tool exists. The only write is `draft_leave_request`, which saves a **draft**; only a human clicking Confirm submits it (through the same function as the Apply screen). |
| Role limits? | Employees are never given the manager or HR tools. Each tool also re-checks the role. |
| 5 tool calls? | A counter in the tool wrapper stops call 6; the model cannot raise it. Every call is written to `agent_log` first; if logging fails, the result is withheld (fail closed). |
| Prompt injection? | Employee-written text (leave reasons) reaches the model wrapped in `<untrusted_data>` tags, truncated, and the agent has no tool that could act on it anyway. |
| Free-tier problem? | Measured: about 20 requests per day per model. The agent falls back across four models, only before any tool has run, so a draft is never duplicated. |
| Extra tool? | `month_end_check` (HR): finds 3+ Lates or missed punches and drafts a reminder email that HR must confirm. |

## 6. Honest limitations (say these before they ask)
- Clerk runs as a **development instance** (shows a "Development mode" banner); production needs a custom domain.
- HR's own leave needs a **second HR Admin** to decide it (nobody decides their own); the seed has one HR as required.
- Free AI quota is small (about 20 requests/model/day). Keep the live demo to a few questions.
- Optional holidays are employee-picked (max 2 a year); Maternity uses 182 calendar days: both are my decisions, flagged in RESEARCH.md for confirmation.
- Absent days count as 1 LOP and a Half Day as 0.5 LOP (R24): the brief does not define LOP; this is my rule table.
