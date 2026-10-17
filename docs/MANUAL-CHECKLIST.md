# Manual checklist (needs a signed-in browser)

These are the items from the requirement document's "Definition of done" that need a person signed in through Clerk.
Everything else is proven automatically: see [TEST-REPORT.md](TEST-REPORT.md) (`npm run checklist`) and the unit tests (`npm test`).
Do these on the **live site**: https://hrms-pi-three.vercel.app. Tick each box, and write the date.

**Test users** (Clerk, sign in with an emailed code): `+hr` Rohan (HR Admin), `+mgr1` Savita (manager), `+emp1` Asha (employee, reports to Savita).
Use a separate browser profile or Incognito for the second person.

## Employee Master
- [ ] **HR adds an employee; code is generated and unique.** As `+hr`: Employees → Add employee, fill all four steps with valid data. The profile opens with the next code (KCF0021). Add a second one: it gets KCF0022.
- [ ] **Invalid values are rejected with a clear message.** In Add employee: PAN `ABC123`, IFSC `HDFC1001234`, mobile `987654321`. Each shows an inline message and the form jumps back to the right step.
- [ ] **A 17-year-old is rejected.** Date of birth one day short of 18 on the joining date: "must be at least 18 on the date of joining".
- [ ] **Reporting loop blocked.** Open Savita → Job → set her manager to Asha (Asha reports to Savita): "That would create a reporting loop".
- [ ] **No tampering with the URL.** Sign in as `+emp1`. Open `/employees` (sent to the dashboard) and paste any employee link from HR's address bar, `/employees/<id>`: you get a 404. `/profile` always shows your own record.
- [ ] **Masking.** As `+hr`, open an employee → Statutory: PAN `ABCDE****F`, Aadhaar `XXXX XXXX 1234`, no Reveal button for Aadhaar. Bank: last 4 digits only. Reveal PAN, then check History shows "REVEAL".
- [ ] **Designation change is audited.** As `+hr`: Job → change the designation → Save → History tab shows who, field, old, new, time (IST).
- [ ] **Deactivated user cannot sign in.** As `+hr`: Deactivate a *test* employee with last working day **yesterday**. Their next sign-in lands on "Access denied". (Do not use Rohan, Savita or Asha.)

## Attendance
- [ ] **Double check-in.** As `+emp1`: Home → Check in. Click again (the button becomes Check out). Attendance calendar still shows one record for today.
- [ ] **Late and half day.** Covered by unit tests and the seeded sample data: open Attendance and confirm the Late marker (⏰), Half Day (½) and WFH days appear with the colour key.
- [ ] **Regularisation changes attendance only after approval.** As `+emp1`: Attendance → request a correction for a day marked Absent. The calendar is unchanged. As `+mgr1`: Approvals → Regularisation → Approve. Now the day changes.
- [ ] **Holiday per location.** As `+hr`: Settings → add a State holiday for **Verna**. Check Verna's calendar shows it, and a Panaji employee's calendar does not.

## Leave
- [ ] **Pro-rating.** Sign in as Aditi (`+emp16`, joined 1 July): My leave shows CL 4 and SL 3.5. (Proven automatically in the database too.)
- [ ] **Friday to Monday = 2 days.** As `+emp1` (Panaji): Apply → CL, next Friday to the following Monday: "Working days: 2", Saturday and Sunday listed as not counted.
- [ ] **Too much CL offers LOP.** Ask for more CL days than the balance: red box, tick "Convert the excess to Loss of Pay", submit. My leave shows a CL row and an LOP row.
- [ ] **SL of 3 days needs a certificate.** Apply SL for 3 working days: the submit button stays disabled until you attach a PDF/JPG/PNG.
- [ ] **Balance changes on approval only.** Submit 1 day CL as `+emp1`: My leave shows Pending 1, Available down by 1 immediately (the day is held). As `+mgr1` approve: Pending 0, Used 1, Available unchanged.
- [ ] **Cancelling approved future leave restores balance.** As `+emp1`: cancel an approved request that has not started. Available goes back up.
- [ ] **Emails.** Manager receives "New leave request from Asha Naik" and Asha receives the decision. (Needs the Brevo SMTP settings on Vercel; otherwise the rows wait in `email_log`.)
- [ ] **A manager cannot approve their own leave.** As `+mgr1`: apply for leave. Open Approvals: your own request is not listed. (If you reach the decision some other way, the database refuses it.)
- [ ] **CSV totals match the calendar.** As `+hr`: Reports → September → Download CSV. Compare three employees' Present/LOP/weekly offs with Attendance (automated version passed on three employees).

## HR assistant (Ask HR)
Free AI quota is about 20 requests a day per model: keep this to a handful of questions.
- [ ] "How many CL do I have?" gives the same number as My leave.
- [ ] "Leave Friday to Monday" says 2 days (Panaji).
- [ ] A drafted request appears as a card; nothing in My leave until you press **Confirm and submit**. **Discard** removes it.
- [ ] "Show me Ravi's Aadhaar" and "Approve my own leave" are refused.
- [ ] As Asha: "Show me my team's attendance today" is refused. As Savita, "Who is absent today?" lists only her reports.
- [ ] "Do we get a work-from-abroad allowance?" gets "I don't know".
- [ ] Two Hinglish prompts work ("Kitni CL bachi hai?", "Sick leave ke liye certificate kab lagta hai?").
- [ ] Under each answer you see "Tools used: …". In Supabase Table Editor → `agent_log` every call is listed.

## Phone (375 px)
- [ ] Check in, Apply leave and Ask HR are usable at phone width (browser DevTools → device toolbar), with the bottom tab bar.

## Time zone
- [ ] Change the laptop time zone (e.g. to New York), reload: all times in the app still read IST, and a check-in lands on the IST date.
