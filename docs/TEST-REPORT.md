# Automated test report

Run: 17 Oct 2026, 11:40 pm IST · Live site: https://hrms-pi-three.vercel.app · **43 of 43 checks passed**

These are the checklist items that can be proven without a person signed in through Clerk. Rule checks are attempts the database must reject (nothing is written).
Business rules are also covered by the unit tests (`npm test`, 80 tests) and by the 640-case SQL-vs-TypeScript comparison. Items that need a signed-in browser are in [MANUAL-CHECKLIST.md](MANUAL-CHECKLIST.md).

## Employee Master

| Result | Check | How it is proven | Detail |
|---|---|---|---|
| ✅ pass | Codes are generated (KCFnnnn) and unique | database sequence + unique constraint | 20 employees |
| ✅ pass | An employee code can never be changed | immutability trigger | P0001 employee_code cannot be changed |
| ✅ pass | Invalid PAN (ABC123) is rejected | check constraint on employee_statutory.pan | 23514 new row for relation "employee_statutory" violates check constraint "employee_statutory_pa |
| ✅ pass | Invalid IFSC is rejected | check constraint on employee_bank.ifsc | 23514 new row for relation "employee_bank" violates check constraint "employee_bank_ifsc_check" |
| ✅ pass | 9-digit mobile is rejected | check constraint on employees.mobile | 23514 new row for relation "employees" violates check constraint "employees_mobile_check" |
| ✅ pass | Aadhaar of 11 digits is rejected | check constraint on employee_statutory.aadhaar | 23514 new row for relation "employee_statutory" violates check constraint "employee_statutory_aa |
| ✅ pass | An employee aged 17 on the joining date is rejected | check constraint employees_age_18 | 23514 new row for relation "employees" violates check constraint "employees_age_18" |
| ✅ pass | Setting A's manager to B while B reports to A is blocked | no-reporting-loop trigger (Rohan is above Asha) | P0001 Reporting loop: 5562ba7e-cfaa-4af3-b005-5d627346ebd0 cannot report to someone in their own |
| ✅ pass | An employee cannot report to themselves | loop trigger and check constraint (either rejects it) | P0001 Reporting loop: 1d99b5ef-9cf2-41c3-91e0-9ed9f4281769 cannot report to someone in their own |
| ✅ pass | Aadhaar is never shown in full (UI, CSV, agent) | code audit: the only query that selects it is masked on the spot; HR Reveal has no Aadhaar branch; CSV and agent have no such field (unit-tested) | selected only in: src/modules/employees/queries.ts |
| ✅ pass | A non-HR user opening /employees/<id> gets a 404 | code audit of the page guard (manual URL test also listed) |  |
| ✅ pass | The audit trail has recorded changes | audit_log rows exist (trigger fires on job/statutory edits) | 19 rows. If 0: change a designation in the app, then re-run |

## Attendance

| Result | Check | How it is proven | Detail |
|---|---|---|---|
| ✅ pass | A second attendance record for the same employee and day is impossible | unique(employee_id, date) | 23505 duplicate key value violates unique constraint "attendance_one_per_day" |
| ✅ pass | A state holiday added for Verna does not exist for Panaji | holidays are per location | 2026-04-24 |
| ✅ pass | Head office Sat+Sun off, plant only Sunday off | locations.weekly_off_days | {"Panaji":"0,6","Verna":"0"} |

## Leave

| Result | Check | How it is proven | Detail |
|---|---|---|---|
| ✅ pass | An employee who joined on 1 July sees pro-rated CL 4 and SL 3.5 | leave_accrued() in the database | Aditi Joshi: CL 4, SL 3.5 |
| ✅ pass | Friday to Monday at head office counts 2 days, not 4 | leave_count_days() in the database | 2 day(s) |
| ✅ pass | The same dates at the plant count 3 (Saturday is a working day) | leave_count_days() in the database | 3 day(s) |
| ✅ pass | A person cannot be the approver of their own leave | check constraint leave_not_self_approved | 23514 new row for relation "leave_requests" violates check constraint "leave_not_self_approved" |
| ✅ pass | Two live requests for the same dates are rejected | exclusion constraint leave_no_overlap | 23P01 conflicting key value violates exclusion constraint "leave_no_overlap" |
| ✅ pass | Leave more than 30 days in the past is rejected | check constraint leave_max_30_days_back | 23514 new row for relation "leave_requests" violates check constraint "leave_max_30_days_back" |
| ✅ pass | A half day over several dates is rejected | check constraint leave_half_day_single | 23514 new row for relation "leave_requests" violates check constraint "leave_half_day_single" |

## Security

| Result | Check | How it is proven | Detail |
|---|---|---|---|
| ✅ pass | Anonymous visitors cannot read employees | no grant for anon + RLS | permission denied for table employees |
| ✅ pass | Anonymous visitors cannot read employee_statutory | no grant for anon + RLS | permission denied for table employee_statutory |
| ✅ pass | Anonymous visitors cannot read employee_bank | no grant for anon + RLS | permission denied for table employee_bank |
| ✅ pass | Anonymous visitors cannot read leave_requests | no grant for anon + RLS | permission denied for table leave_requests |
| ✅ pass | Anonymous visitors cannot read attendance | no grant for anon + RLS | permission denied for table attendance |
| ✅ pass | Anonymous visitors cannot read agent_log | no grant for anon + RLS | permission denied for table agent_log |
| ✅ pass | Anonymous visitors cannot write to employees | no write grant | 42501 permission denied for table employees |
| ✅ pass | Anonymous visitors cannot call HR functions | EXECUTE revoked from anon | 42501 permission denied for function hr_update_employee |
| ✅ pass | No .env file is tracked by git | git ls-files |  |
| ✅ pass | .env.local was never committed, in any commit | git log --all --name-only |  |
| ✅ pass | No keys or tokens anywhere in the git history | scanned every commit for Clerk, JWT, Google and Brevo key shapes | scanned all commits |
| ✅ pass | .env.example has blank values only | file check | 14 variables |

## Live site

| Result | Check | How it is proven | Detail |
|---|---|---|---|
| ✅ pass | Signed-out request to /dashboard is refused | HTTP probe of the deployed app | HTTP 404 |
| ✅ pass | Signed-out request to /api/reports/month-end?month=2026-09 is refused | HTTP probe of the deployed app | HTTP 404 |
| ✅ pass | Signed-out request to /api/certificate?path=x is refused | HTTP probe of the deployed app | HTTP 404 |
| ✅ pass | Signed-out request to POST /api/agent is refused | HTTP probe of the deployed app | HTTP 404 |
| ✅ pass | Signed-out request to /api/cron/emails (no secret) is refused | HTTP probe of the deployed app | HTTP 401 |
| ✅ pass | Sign-in page loads | HTTP probe |  |

## Agent

| Result | Check | How it is proven | Detail |
|---|---|---|---|
| ✅ pass | No question ever used more than 5 tool calls | agent_log grouped by question | 23 logged questions, 23 tool calls, max 1 per question |
| ✅ pass | The 20 attack/behaviour prompts pass | tests/agent/prompts.md run on 2026-10-17 (re-run with npm run agent:test) | result recorded in prompts.md |
| ✅ pass | Drafts exist but were never auto-submitted | drafts stay "draft" until a person presses Confirm | 2 drafts |
