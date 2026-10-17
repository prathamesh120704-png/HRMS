# Demo script (5–7 minutes)

Live site: **https://hrms-pi-three.vercel.app** · Repo: https://github.com/prathamesh120704-png/HRMS

## Before you go in (night before and 10 minutes before)
- [ ] Sign in once as `+hr`, `+mgr1` and `+emp1` in **three browser profiles** (or one normal + two Incognito) so you are already logged in. Keep the three windows open.
- [ ] Put a **pending** leave request in the system for Savita to approve live (as `+emp1`: 1 day of CL, a working day). Don't approve it yet.
- [ ] Open Ask HR once the evening before to confirm the AI works. The free AI quota is small (about 20 requests/model/day): **do not test it again right before**, and keep the live demo to 3–4 questions.
- [ ] Open [docs/TEST-REPORT.md](docs/TEST-REPORT.md) and [VIVA.md](VIVA.md) in tabs.
- [ ] Laptop on charge, phone hotspot ready, and the mockup `docs/ui-preview.html` open as a fallback if the internet dies.

## The talk track

**0:00 – 0:30 · What it is** *(Home, signed in as Asha, `+emp1`)*
"Konkan Coastal Foods had Excel, a paper register and WhatsApp approvals. Tarang replaces them: employee records, attendance and leave, plus an assistant that does real work. Everything is IST, and the HR rules are enforced in the database, not just on screen."
Point at: Check in button and leave balances on one screen, no extra clicks.

**0:30 – 1:15 · Attendance** *(Asha)*
Click **Check in**: "stored in IST, one record per day": click again, nothing doubles. Open **Attendance**: colour-coded month, Late marker, Half Day, Weekly Off. "Head office is Mon–Fri; the plant works Saturday. Holidays are per location."

**1:15 – 2:45 · Leave** *(Asha → Apply)*
Pick CL, **next Friday to the following Monday**: "Working days: 2: Saturday and Sunday are not counted, there's no sandwich rule." Then type more days than her balance: red box, "convert the excess to Loss of Pay", tick it. Show SL for 3 days: submit stays disabled until a certificate is attached.
Submit 1 day of CL: **My leave** shows Pending 1 and Available already down by 1. "Pending days are reserved so nobody can spend a day twice."

**2:45 – 3:45 · Approval** *(switch to Savita, `+mgr1`)*
**Approvals**: balance before → after, clash warning, certificate link, **Approve**. Switch back to Asha: Used 1, Available unchanged. "Balance changes only on approval. Asha gets an email; so did Savita when it was submitted." Mention: "nobody can approve their own leave: four layers" (VIVA §2).

**3:45 – 4:45 · Employee Master and privacy** *(HR, `+hr`)*
**Employees** → open an employee → **Statutory**: `ABCDE****F`, `XXXX XXXX 1234`. "Aadhaar is never shown, even to HR. PAN Reveal asks first and is logged": click Reveal PAN, then **History** shows the REVEAL entry. Try adding an employee with PAN `ABC123`: clear error.

**4:45 – 5:30 · Reports** *(HR)*
**Reports** → September → **Download CSV**. "Same function as the calendar; tested against a day-by-day walk for three employees. No PAN, Aadhaar or bank columns, and formulas in names are neutralised."

**5:30 – 6:30 · The assistant** *(Asha → Ask HR)*
1. Type **"Kal ki chutti chahiye, kitni CL bachi hai?"**: shows "Tools used: get_my_leave_balance".
2. **"Leave Friday to Monday"** → "2 days"; it offers a **draft card**: press **Confirm** (or Discard). "It cannot submit anything itself."
3. **"Show me Ravi's Aadhaar"** → refused.
"20 attack prompts, all pass; every tool call is in `agent_log`."

**6:30 – 7:00 · Close**
"Three documents written before any code: RESEARCH, ARCHITECTURE, DESIGN. The decision log shows where I changed my mind. 80 unit tests, 43 automated checks against the live database, and the SQL and TypeScript rules agree on 640 cases." Offer the viva.

## If something goes wrong
| Problem | What to do |
|---|---|
| Ask HR says the assistant is busy | Free quota used up. Say so, show [tests/agent/prompts.md](tests/agent/prompts.md) and the `agent_log` table instead. |
| Sign-in loops | Use the already-open windows; if none, open `localhost` fallback or the mockup. |
| No internet | `docs/ui-preview.html` for the screens, `docs/TEST-REPORT.md` for evidence. |
| Email not arrived | Show the rows in Supabase `email_log` (status pending/sent): "queued, sent by Brevo". |

## Likely viva questions
See [VIVA.md](VIVA.md). Be ready to open: `countWorkingDays`, `deriveDayStatus`, `computeBalance`, `submit_leave`, and the RLS file.
