# SQL vs TypeScript parity cases

`leave_count_days` / `leave_accrued` (SQL, migration 0002) must give the same answers as `countWorkingDays` /
`proratedQuota` / `accruedMonthly` (TypeScript, `src/lib/domain`). Run these against a real database once it
exists and compare. The TypeScript side is already covered by `tests/domain`.

| Case | Expected |
|---|---|
| Panaji, Fri 2026-10-23 to Mon 2026-10-26 | 2 |
| Verna, Fri 2026-10-23 to Mon 2026-10-26 | 3 |
| Panaji half day on a working day / on a Saturday | 0.5 / 0 |
| Verna holiday on 2026-10-26, range 23-26 Oct | 2 |
| Maternity/Paternity (calendar days), 23-26 Oct | 4 |
| Joined 2026-07-01: CL, SL (upfront) | 4.0, 3.5 |
| Joined 2026-07-16: CL | 3.5 |
| Joined 2026-07-01: EL as of 2026-12-31 | 7.5 |
| Joined 2026-07-10: EL as of 2026-12-31 | 6.25 |
| Joined 2026-01-01: EL as of 2026-03-30 | 2.5 |

## Result (2026-10-17)
Ran against the live Supabase database for all 20 seeded employees: accrual for every leave type at three dates, and
working-day counts for 7 date ranges (full day, half day, calendar-days) at both locations, including holidays.
**640 checks, 0 mismatches.** Re-run after any change to `leave_count_days`, `leave_accrued`, `countWorkingDays`
or `accruedFor`.
