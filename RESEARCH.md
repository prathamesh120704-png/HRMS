# RESEARCH.md — Konkan Coastal Foods HRMS

Author: Prathamesh
Last updated: 2026-10-17

> Status (2026-10-23): drafted from the requirement document, the primary legal text (Goa Shops and Establishments Act, 1973) and secondary sources. **Still to do by the author:** check the Maternity Benefit Act figures and which Goa Act applies against official sources, and confirm the open questions in §11 with faculty. (The interview in §8 was done on 23 October 2026.) Items marked **[TO CONFIRM]** or **[TO DO]** need your own check before submission. Re-read every answer and rephrase anything you cannot defend in the viva.

---

## 1. Employee details kept by an Indian HR team

An HR team keeps five groups of data per employee:

| Group | Typical fields |
|---|---|
| Personal | Full name, date of birth, gender, mobile, personal email, current/permanent address, PIN, state, marital status |
| Job | Employee code, designation, department, location, reporting manager, date of joining, employment status, last working day |
| Statutory | PAN, Aadhaar, UAN (PF account) |
| Bank | Account number, IFSC, bank name (for salary credit by the payroll vendor) |
| Emergency contact | Name, relationship, phone |

**Mandatory vs optional**
- **PAN** — needed for income-tax (TDS) reporting by the employer. Mandatory.
- **Aadhaar** — commonly required for KYC and for linking PF/UAN. Mandatory in practice, 12 digits.
- **UAN** — the Provident Fund identifier. A new joiner may not have one yet (it is generated at first PF enrolment), so it is optional at joining and filled later. This matches the requirement document.
- **Bank details** — mandatory, because salary is paid by bank transfer.

**Sensitive data.** PAN, Aadhaar, bank account number and salary grade identify a person financially and are targets for fraud. Aadhaar is additionally protected under the Aadhaar Act, which restricts how it is stored and shown. Because of this, the app will:
- keep statutory and bank data in **separate tables** with row-level security;
- show PAN as `ABCDE****F`, Aadhaar as `XXXX XXXX 1234`, and the bank account as last 4 digits;
- allow an HR-only **Reveal** action that is written to a log;
- never send these fields to the AI model.

## 2. Employee codes

- **Formation.** A company prefix plus a running sequence, for example `KCF0001`, `KCF0002`. Some companies add a joining year or location code (e.g. `KCF-24-P-0012`). Konkan uses the simple prefix + zero-padded sequence form: `KCF` + 4 digits.
- **Why it must never change.** The code is the permanent key HR, payroll and statutory records use to refer to a person. Attendance, leave and audit history all point to it. If it changed (on transfer, promotion or rehire), old records would no longer match, and the payroll vendor's files would break. So: generated automatically by the system, unique (database unique constraint), and never editable or reused, even after the employee leaves.
- **Generation in the app.** A database sequence, so two HR users adding employees at the same moment cannot get the same code.

## 3. Leave types in Indian companies

| Type | What it is |
|---|---|
| Casual Leave (CL) | Short-notice personal leave, a few days a year |
| Sick Leave (SL) | Leave for illness or injury; long spells usually need a medical certificate |
| Earned / Privilege Leave (EL/PL) | Leave earned by service, accrues over time, often can be carried forward or encashed |
| Maternity Leave | Leave for childbirth, protected by law |
| Paternity Leave | Leave for new fathers; no central private-sector law, so it is company policy |
| Loss of Pay (LOP) | Unpaid leave, taken when no balance remains or on absence |
| Comp-off | A day off given in return for working on a weekly off or holiday (not in Konkan's policy) |

**Statutory entitlement vs company policy.**
- *Statutory* leave is set by law and a company cannot offer less. Examples: maternity leave (Maternity Benefit Act, 1961) and the leave in the state Shops and Establishments Act.
- *Company policy* is what the employer chooses to offer on top (or where no law applies), such as paternity leave of 5 days at Konkan or the CL/SL/EL quotas. A company can give more than the law but not less.

**Check against the Goa Act.** Section 23 of the Goa Shops and Establishments Act, 1973 gives: 15 days leave with wages after 240 days of service in 12 months (accumulation up to 45 days), 9 days sick leave, and 6 days casual leave a year. Konkan's policy (CL 8, SL 7, EL 15) meets or exceeds the casual-leave figure and the earned-leave figure. **Note:** SL 7 is below the Act's 9 days and the Act's text should be raised with faculty. See Section 12 and Open Questions.

## 4. Leave accrual and year end

**Accrual methods**
1. *Credited upfront* at the start of the year (CL, SL at Konkan: credited 1 January).
2. *Monthly accrual*: a fixed amount per completed month (EL at Konkan: 1.25 days per completed month, 15 days per year).
3. *Pro-rated for joiners*: a mid-year joiner gets only the share of the year left.

**Year end options**
- *Lapse* — unused leave disappears (CL, SL at Konkan).
- *Carry forward* — unused leave moves to next year, usually with a cap (EL at Konkan: up to 30 days).
- *Encashment* — unused leave is paid out in money, usually on exit or at year end for EL. Not part of Konkan's rules here; payroll is out of scope.

**Why balance is calculated, not stored.** A stored "available" number can drift from reality if an approval, cancellation or backdated correction is missed. Calculating `opening + accrued − used − pending-approval` from the underlying rows means the figure is always consistent with the records.

## 5. Shops and Establishments Act — Goa

Source: Goa, Daman and Diu Shops and Establishments Act, 1973 (as applied in Goa), primary text.

**Working hours (s. 11).** No employee in an establishment may work more than **8 hours a day and 48 hours a week**. Overtime is permitted on payment of overtime wages, up to **6 extra hours in a week**; for stock-taking and accounts, up to 15 days a year with a 24-hour aggregate cap, with prior intimation to the Inspector.

**Rest interval (s. 12).** No more than **5 hours** of work without a rest interval of at least **1 hour**.

**Spread-over (s. 13).** Work plus rest must fit within **12 hours** a day.

**Weekly off (s. 14).** Every employee gets **one whole day off every week**. No wage deduction for it, and the employer cannot call the employee in on that day.

**Leave (s. 23).**
- 15 days leave with wages per year after 240 days of service; may accumulate up to 45 days.
- Up to 9 days sick leave and 6 days casual leave with wages per year.

**Holidays (s. 24).** Seven paid holidays a year: 26 January, 1 May, 15 August, 2 October, 19 December (Goa Liberation Day), plus two chosen by the establishment in the first month of the year.

**Maternity (ss. 18–19).** Six weeks before and six weeks after delivery after 6 months of continuous service. The central Maternity Benefit Act (Section 10) gives a better entitlement.

**Second caveat (added 2026-10-23): the national Labour Codes.** Reports in 2026 say the Occupational Safety, Health and Working Conditions Code, 2020 covers working hours and **earned leave** nationally (8-hour day, a 30-day carry-forward cap) and that it overlaps with state Shops Acts, which mostly still exist. The sources disagree on whether the code is fully in force, and the code is silent on sick and casual leave, which stay with the state Act. See §8a and [Supreme Today](https://supremetoday.ai/indias-employers-face-legal-dilemma-as-osh-code-and-state-shops-acts-clash-20260825108). Treat the Goa 1973 figures above as the **state-law floor** and confirm with faculty which regime governs.

**Caveat on current status.** A secondary source reports that a new Goa Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2025 was notified on 1 October 2025 to replace the 1973 Act, with its start date to be announced. **[TO CONFIRM]** with the Goa Labour Department which Act currently applies. This project follows the 1973 text.

**Implication for the app.** The 8-hour Present threshold in Konkan's policy matches the 8-hour legal day. Head office (Mon–Fri) and plant (Mon–Sat, Sun off) each give at least one full weekly off, as s. 14 requires.

## 6. Holiday types

| Type | Meaning | Example |
|---|---|---|
| National holiday | Applies across India for everyone | Republic Day (26 Jan), Independence Day (15 Aug), Gandhi Jayanti (2 Oct) |
| State holiday | Declared by the state government and applies to that state | Goa Liberation Day (19 Dec) |
| Restricted / Optional holiday | A list of extra days from which an employee may choose a limited number (commonly 2–3 a year); the rest are working days | Regional or religious festivals |

**In the app.** The `holidays` table is tied to a **location**, with a type column (National / State / Optional). A state holiday added for Verna does not show for Panaji. Optional holidays do not automatically close the day; they apply only to employees who choose them. **Decision (R31):** Optional holidays are employee-selected (max 2 a year); an unpicked Optional holiday is a normal working day.

## 7. Late arrivals, half days, WFH and missed punches

Common industry practice, and the rule used here:

| Case | Common practice | Konkan rule in this app |
|---|---|---|
| Late arrival | Grace period, then warnings; repeated lates deduct leave or pay | Check-in after 10:15 AM is Late. 3 Lates in a calendar month = 1 half-day LOP |
| Half day | Worked about half the shift | 4h to under 8h = Half Day |
| Absent | No punch or very short work | Under 4h or no punch = Absent |
| Work from home | Marked by employee or approved by manager | Employee marks WFH; counts as Present |
| Missed punch | Employee requests correction with a reason; manager approves | Regularisation request; attendance changes only after manager approval |

## 8. Interview with a working professional

*Interview done and written up by the author on 23 October 2026. The quotes are the interviewee's own words as noted during the call.*

### 1. Who, date and format
* **Interviewee:** A relative (Operations Executive at a company of about 220 employees in Goa, in manufacturing and distribution, with a corporate office and a plant on an industrial estate).
* **Date:** 23 October 2026
* **Format:** 15-minute phone call. Notes were taken live and summarised straight after.

### 2. What they told me
At his company, employees use an older web-based HR portal to apply for leave, and a punch machine paired with the same portal to record daily attendance. To apply for leave he has to log in on a desktop browser, choose the dates and submit the form. He then still sends a WhatsApp message to his reporting manager, because the portal does not send clear alerts and approvals otherwise take two to three days.

Leave balances are often confusing: *"It shows one single balance number, and I never know if the leave I applied for last week is already deducted from it or still pending until HR reconciles it at month-end."*

If someone forgets to punch out, or works from home, the system automatically marks them Absent. Fixing it means emailing HR and waiting until the next payroll cycle to see whether it was corrected. The office works Monday to Friday and the factory Monday to Saturday, so employees are often unsure how many days will be deducted when they apply across a weekend.

### 3. What they dislike most
His biggest complaint is the lack of real-time clarity about leave balances and pending requests, together with having to chase managers on WhatsApp after already filling in a formal leave form. In his words: *"What makes me groan is that applying on the portal is only half the job. If I don't text my manager on WhatsApp, it just sits there in pending forever, and meanwhile I can't tell how many actual Casual Leaves I have left to use."*

### 4. What surprised me
I was surprised that even a company that pays for dedicated HR software still relies on WhatsApp messages to get leave approved and to know who is in the office today. I also did not expect employees to feel anxious about applying for Friday-to-Monday leave just because the form does not say upfront how many working days will be deducted before they press submit.

### 5. What I changed or decided because of this

| What I heard | What I did in my HRMS | Where |
|---|---|---|
| **One balance number: is a pending request already taken off?** | **My leave** shows five numbers for every leave type: **Opening, Accrued, Used, Pending and Available**. Pending days are held at once, so Available already has them taken off, and Used changes **only when the manager approves**. The Home screen shows the Available balance per type, so the headline number is never inflated by a request that is still pending | L2, L4; rule R21 |
| **Not knowing how many days a weekend or holiday will cost** | On **Apply leave**, choosing the dates immediately shows the exact **working days** and the **balance after**, before submitting. Weekly offs (Saturday and Sunday for Panaji, Sunday only for Verna) and holidays at the person's own location are left out, and there is no sandwich rule | L3; rules R17, R18 |
| **Managers miss portal requests, so people chase on WhatsApp** | The manager's Home screen shows a **count of requests waiting** with a link to the **Approvals inbox**, and an **email** goes to the manager as soon as a request is submitted and to the employee as soon as it is decided | L6; Approvals inbox |
| **Missed punches mean Absent and slow emails to HR** | A self-service **correction request**: on **My attendance**, below the calendar, the employee picks the missed day, enters the in and out times and a reason, and it goes straight to their manager, who approves from the inbox. Attendance changes only after approval | A5; rule R33 |
| **Working from home marks the person Absent** | A **Work from home** button on the Home screen records the day and counts it as **Present** | A3; rule R13a |
| **The portal is hard to use on a phone when someone is ill at home** | Phone layouts for **Check in, Apply leave and Ask HR**, with a bottom tab bar, so a person can check a balance, apply for leave, or ask the assistant in Hinglish from a phone browser without a laptop | Responsive requirement; Ask HR |

**Where my app still falls short of what he asked for:** Tarang sends **emails**, not WhatsApp messages, and an email can also go unread, so the waiting-requests count on the manager's Home screen is the second reminder. A manager can only approve or reject a whole request, and a missed punch still needs a manager's approval.

## 8a. Desk research: what published sources say users dislike (not the interview)

> Added 2026-10-23. This is **secondary research** from public sources. It does **not** replace the interview in §8, which must be a real conversation with a real person. Most sources are HR-software vendors or one organisation's published orders, so they show **common patterns, not measured rates**. I read the two labour-code articles in full; the others I know from search summaries, so open each link before the viva.

| # | Theme | What the sources say (in my words) | Sources |
|---|---|---|---|
| 1 | **Nobody is sure of the real balance** | Manual leave tracking causes disputes because employees do not know their current balance and managers are not told about approved leave in time. In the Indian Railways HRMS, a union complained that the balance shown was not updated properly, so supervisors had to calculate and upload it by hand | [uKnowva](https://uknowva.com/blogs/challenges-of-leave-management-module), [Railway HRMS clarification](https://www.gconnect.in/orders-in-brief/railways-orders-in-brief/operationalization-leave-management-module-hrms-indian-railway.html) |
| 2 | **Approvals are slow, get lost, or are skipped** | Requests sent by email, word of mouth or paper get buried or handled inconsistently. A 2023 Railway Board order notes that some staff apply in the system and then go on leave before it is sanctioned. The same system could not sanction fewer days than were applied for, so people could not plan travel | [uKnowva](https://uknowva.com/blogs/challenges-of-leave-management-module), [Railway Board order, Nov 2023](https://www.staffnews.in/2023/11/implementation-of-leave-management-module-of-hrms.html) |
| 3 | **Missed punches turn into pay disputes** | Pay in India depends on days worked, so an uncorrected punch can cut salary. Causes include forgotten punches, device failure, work from home, field visits and network sync. The usual fix is: employee request, then manager approval, then HR check, then payroll, with a cut-off date and a record of who changed what. Email and Excel handling loses requests and forces re-typing | [IndPayroll](https://www.indpayroll.com/blog/attendance-regularization-how-to-fix-missed-punches-without-payroll-errors), [Petpooja](https://blog.petpooja.com/operations-workflows/attendance-regularisation-meaning-process-best-practices), [Mynd](https://www.myndsolution.com/making-attendance-fair-and-easy-a-guide-to-regularization-policies/), [Digisme](https://www.digisme.in/blog/what-to-do-when-employees-miss-punch-in-biometric-attendance/) |
| 4 | **Hard to use on a phone or a slow connection** | A case study describes a legacy portal that worked only on the office network or VPN, with a clumsy leave request, unusable on the move. Vendors argue Indian HR tools should be built for phones first and stay light on slow internet; managers want to approve leave and see the team calendar from a phone | [UX case study](https://uxplanet.org/case-study-of-employee-self-services-mobile-app-19c752e05c15), [Darwinbox](https://darwinbox.com/blog/mobile-hrms-india), [Aspire Systems case study](https://www.aspiresys.com/casestudies/enabling-a-self-service-hr-mobile-application-for-an-electronics-giant-powered-by-eQuipMe.pdf) |
| 5 | **The legal rules are moving** | Reports say the new Labour Codes set one national cap of **30 days** of earned-leave carry-forward (earlier state rules allowed up to 45), let workers encash the excess every year, and accrue leave at 1 day per 20 days worked. The sources **disagree on whether the codes are fully in force**, several states have not notified their rules, and states still have their own Shops Acts, so the two regimes can overlap and conflict. Employers are advised to apply the more generous provision | [People Matters, Apr 2026](https://www.peoplematters.in/news/strategic-hr/leave-carry-forward-and-encashment-rules-set-for-nationwide-standardisation-49221), [Supreme Today](https://supremetoday.ai/indias-employers-face-legal-dilemma-as-osh-code-and-state-shops-acts-clash-20260825108), [Outlook Money](https://www.outlookmoney.com/news/new-labour-codes-change-heres-how-you-earn-carry-and-encash-leave) |

### What this suggests for Tarang (and where it falls short)
| Theme | What Tarang does about it | Honest limit |
|---|---|---|
| 1 Balance | One formula (R21) shows opening, accrued, used, pending and available. Pending days are held at once, so nobody can spend a day twice. Ask HR gets the number from the same function as the screen | Balances are calculated live, never typed in, so HR cannot "fix" one by hand: they use an adjustment |
| 2 Approvals | The approver sees a count on the home screen, a request inbox with balance and clash warnings, and an email on every submit and decision. A day taken without approval stays **Absent and costs 1 LOP** (R24); it is never silently treated as leave | Like the Railway system, a manager can only approve or reject the **whole** request, not fewer days. Not built |
| 3 Missed punch | A check-in with no check-out is flagged "missed punch" and counts Absent until corrected (R25). The employee asks for a correction with a reason, the manager approves, only the last 30 days are allowed (R33: the cut-off), and every change is recorded | Corrections need a manager. There is no automatic fix for a device failure because there is no biometric device (out of scope) |
| 4 Phone | Phone layouts and a bottom tab bar for Check in, Apply and Ask HR; light pages with no heavy images; Ask HR understands Hinglish | Needs an internet connection. No SMS or feature-phone path |
| 5 Law | EL carry-forward is capped at 30 days (R35), which matches the reported national cap | **The Goa Act, 1973 s.23 lets leave build up to 45 days**, so the 30-day company cap is *less* than the Goa Act, though equal to the reported national code. Which law governs is an open question for faculty (see §11). Annual encashment is payroll, which is out of scope |

## 9. Sandwich rule

A **sandwich rule** (sandwich leave policy) counts weekly offs and holidays that fall *between* two leave days as leave too. Example: leave on Friday and Monday at a Mon–Fri office; under a sandwich rule the Saturday and Sunday in between are also deducted, so 4 days are charged. Without it, only the 2 working days are charged.

- It is a company policy, not a rule imposed by labour law (sources describe it as an employer-level practice common in the private sector).
- **Konkan has no sandwich rule.** So Friday–Monday at head office costs **2** days, and weekly offs/holidays inside a leave range are never counted.

## 10. Maternity Benefit Act, 1961 — verified figures

Per the Maternity Benefit (Amendment) Act, 2017 (in force 1 April 2017), from secondary sources:
- **26 weeks** of paid maternity leave for the first two surviving children, with no more than 8 weeks before the expected delivery date.
- **12 weeks** for a woman with two or more surviving children (not more than 6 weeks before delivery).
- **12 weeks** for adoptive and commissioning mothers.
- Applies to establishments with 10 or more employees; crèche facility required at 50 or more employees.

**[TO DO]** Confirm against the official Act text (indiacode.nic.in) before submission. Eligibility conditions (e.g. 80 days of work in the preceding 12 months) should also be checked there.

Konkan has 180 employees, so the Act applies. The app's maternity leave type will use **26 weeks (182 days)** for first two children and allow HR to grant 12 weeks otherwise, applied "on request". **[TO CONFIRM]** how to handle weeks vs working days (calendar days include weekly offs).

## 11. Leave policy to implement (as rules)

### Employee data
- R1. PAN: 5 letters, 4 digits, 1 letter — `^[A-Z]{5}[0-9]{4}[A-Z]$`.
- R2. Aadhaar: 12 digits, stored but never shown unmasked anywhere (UI, CSV, agent).
- R3. UAN: 12 digits, optional for new joiners.
- R4. IFSC: 4 letters, then `0`, then 6 letters or digits — `^[A-Z]{4}0[A-Z0-9]{6}$`.
- R5. Mobile: 10 digits starting with 6, 7, 8 or 9 — `^[6-9][0-9]{9}$`.
- R6. PIN code: 6 digits; state chosen from a dropdown of Indian states and UTs.
- R7. Date of birth must make the employee at least 18 on the date of joining.
- R7a. An employee cannot report to themselves or to anyone in their own reporting chain (no loops).

### Attendance
- R8. All times stored and shown in IST (Asia/Kolkata), independent of server time zone.
- R9. Head office (Panaji): Mon–Fri working; Sat, Sun weekly off.
- R10. Plant (Verna): Mon–Sat working; Sun weekly off.
- R11. Worked 8h or more = Present; 4h to under 8h = Half Day; under 4h or no punch = Absent.
- R12. Check-in after 10:15 AM = Late (exactly 10:15 is not late). Every 3 Late marks in a calendar month = 1 half-day LOP (so 3 → 1 half day, 6 → 2 half days).
- R13. A day with approved leave is On Leave, even if the employee also punched in.
- R13a. WFH counts as Present. One attendance row per employee per date (unique constraint).
- R13b. Day-status precedence: Holiday / Weekly Off → On Leave → Present/Half Day/Absent from hours.

### Leave
| Type | Quota | Accrual | Carry forward | Half day |
|---|---|---|---|---|
| CL | 8 | Credited 1 Jan, pro-rated for joiners | Lapses 31 Dec | Yes |
| SL | 7 | Credited 1 Jan, pro-rated for joiners | Lapses 31 Dec | Yes |
| EL | 15 | 1.25 per completed month | Up to 30 | No |
| Maternity | 26 weeks (first two children) / 12 weeks (third or later) per Maternity Benefit Act | On request | N/A | No |
| Paternity | 5 | On request | N/A | No |
| LOP | Unlimited | N/A | N/A | Yes |

- R14. Leave year is January–December.
- R15. Insufficient balance: the request is blocked, and the app offers to convert the excess to LOP.
- R16. SL of more than 2 consecutive days needs a medical certificate upload before submit.
- R17. Leave days are working days only; Saturday is a working day at the plant and not at head office.
- R18. Weekly offs and holidays inside a leave period are never counted (no sandwich rule).
- R19. Leave cannot be applied for dates more than 30 days in the past.
- R20. **Pro-rating** (proposed; confirm with faculty):
  - Months remaining = 12 − (joining month − 1) if the employee joins on or before the 15th; otherwise the joining month is excluded.
  - Pro-rated quota = annual quota × months remaining ÷ 12, rounded to the nearest 0.5 day.
  - *Example, joined 1 July:* 6 months remain. CL = 8 × 6/12 = **4.0**; SL = 7 × 6/12 = **3.5**.
  - *EL:* 1.25 × completed months. Joined 1 July: July is complete on 31 July, so by 31 Dec the employee has 6 completed months = **7.5** days (credited at each month end).
- R21. Balance (not stored): `available = opening + accrued − used − pending`. Pending requests reserve days; the balance used changes only on approval (L4), and is restored on cancellation.
- R22. A manager cannot approve their own leave; an HR Admin's leave is approved by their reporting manager.
- R23. Half-day leave counts as 0.5 and only for leave types where half day is allowed.

### Added rules (v0.2) — gaps found in the architecture review
These fill gaps the requirement document leaves open. They are **proposed decisions**; confirm with faculty.

- **R24. Month-end buckets (what counts as present, leave and LOP).**

  | Day situation | Present days | Leave days | LOP days |
  |---|---|---|---|
  | Present (incl. WFH) | 1 | 0 | 0 |
  | Half Day | 0.5 | 0 | 0.5 |
  | Absent (working day, no approved leave) | 0 | 0 | 1 |
  | On Leave, full day, type CL/SL/EL/Maternity/Paternity | 0 | 1 (by type) | 0 |
  | On Leave, LOP type (incl. converted excess) | 0 | 0 | 1 |
  | Half-day leave + other half worked 4h or more | 0.5 | 0.5 (by type) | 0 |
  | Half-day leave + other half not worked | 0 | 0.5 (by type) | 0.5 |
  | Holiday / Weekly Off | not counted | not counted | 0 (shown in their own columns) |
  | Late marks | – | – | +0.5 LOP for every 3 Lates in the month (floor(lates ÷ 3) × 0.5) |

  Month-end LOP = sum of the LOP column + Late LOP. The calendar, CSV, My leave and the agent all use this one table.
- **R25. Missed punch.** A check-in with no check-out by end of day has no completed hours, so the day is Absent (flagged "missed punch") until a regularisation is approved.
- **R26. Punch on a Holiday or Weekly Off.** Allowed and recorded; the day's status stays Holiday / Weekly Off. No comp-off in this version.
- **R27. Late rule scope.** Late applies to WFH check-ins too. A Late mark is not counted on a day that is On Leave (full day), a Holiday or a Weekly Off.
- **R28. Half-day leave day.** Shown as "On Leave (½)". The other half follows the R24 table based on hours worked.
- **R29. Status vs approvals.** Approving leave sets covered days to On Leave even if a punch exists; cancelling approved leave recomputes those days from punches.
- **R30. Maternity and Paternity.** Only eligible genders can apply (Maternity female, Paternity male). Both are counted in **calendar days** (weekly offs and holidays inside the period are included), unlike CL/SL/EL. Maternity quota is 182 days (26 weeks) for the first two children and 84 days (12 weeks) after; HR sets the entitlement on the employee before the request. Paternity 5 days.
- **R31. Optional holidays.** Employee-selected, maximum 2 per calendar year, from the Optional holidays of the employee's own location. An Optional holiday that the employee did not pick is a normal working day.
- **R32. No overlapping leave.** A date can be covered by at most one pending or approved request. This includes half days (a second half-day request on the same date is rejected).
- **R33. Regularisation limits.** Only for dates within the last 30 days, and not for a date with approved leave.
- **R34. Who approves.** The reporting manager, if active and not the requester; otherwise an HR Admin other than the requester. HR may decide any pending request. Nobody decides their own request. A manager with active direct reports cannot be deactivated until the reports are reassigned.
- **R35. Year rollover.** On 1 January: CL and SL opening = 0 (lapse); EL opening = min(previous year's available EL, 30). Carry-forward is computed by an idempotent function, so a missed run cannot leave anyone without a balance.

### Open questions to bring to faculty
1. SL quota of 7 is below the Goa Act's 9 days (s. 23(4)(a)). Follow the document's policy or flag?
2. R24: is an Absent day 1 LOP, and a Half Day 0.5 present + 0.5 LOP? The brief reports "LOP days" but does not define them.
3. Maternity: 182 calendar days (26 weeks) as the entitlement; confirm.
4. Which Act applies in Goa now (1973 vs 2025)?
5. May HR reveal full Aadhaar? The brief says Reveal exists but R2 says never show unmasked; this design says never.
6. **EL carry-forward.** The company policy caps it at 30 days (R35). The Goa Act, 1973 s.23 lets leave accumulate up to 45 days, and reports say the new national Labour Code caps it at 30. Which law governs, and is the 30-day company cap acceptable? (§8a, §5)

---

## 12. Sources

1. Goa, Daman and Diu Shops and Establishments Act, 1973 (PRS India copy) — https://prsindia.org/files/bills_acts/acts_states/goa/1974/1974GOA13.pdf (ss. 11–14, 18–19, 23–24)
2. Goa Labour Department, Shops and Establishments Act, 1973 — https://labour.goa.gov.in/wp-content/uploads/2020/07/7475-31-SI-EOG-1-GDD-Shops-Establishment-Act-1973-31-10-1974.pdf
3. Lawrbit, Goa Shops and Establishments (2025 Act summary) — https://www.lawrbit.com/article/goa-shops-and-establishments-act-2025/
4. Mondaq, The Maternity Benefit (Amendment) Act, 2017 — https://mondaq.com/india/employee-benefits-compensation/584500/the-maternity-benefit-amendment-act-2017
5. S.S. Rana, Government throws light on the Maternity Benefit (Amendment) Act, 2017 — https://ssrana.in/articles/government-throws-light-on-the-maternity-benefit-amendment-act-2017/
6. FactoHR, Sandwich Leave Policy — https://factohr.com/policy/sandwich-leave-policy/
7. Keka, Sandwich Leave Policy — https://www.keka.com/sandwich-leave-policy
8. PocketHRMS, Sandwich Leave Policy: Meaning, Examples and Rules — https://www.pockethrms.com/blog/what-is-sandwich-leave-policy/

9. uKnowva, Challenges of the leave management module — https://uknowva.com/blogs/challenges-of-leave-management-module
10. Railway Board order on the HRMS leave module, 23 Nov 2023 — https://www.staffnews.in/2023/11/implementation-of-leave-management-module-of-hrms.html
11. Operationalisation of the Leave Management Module of HRMS in Indian Railways (clarification) — https://www.gconnect.in/orders-in-brief/railways-orders-in-brief/operationalization-leave-management-module-hrms-indian-railway.html
12. IndPayroll, Attendance regularization: how to fix missed punches without payroll errors — https://www.indpayroll.com/blog/attendance-regularization-how-to-fix-missed-punches-without-payroll-errors
13. Petpooja, Attendance regularisation: meaning, process, best practices — https://blog.petpooja.com/operations-workflows/attendance-regularisation-meaning-process-best-practices
14. Mynd Solution, A guide to regularization policies — https://www.myndsolution.com/making-attendance-fair-and-easy-a-guide-to-regularization-policies/
15. Digisme, What to do when employees miss punch in biometric attendance — https://www.digisme.in/blog/what-to-do-when-employees-miss-punch-in-biometric-attendance/
16. UX Planet, Case study of an employee self-services mobile app — https://uxplanet.org/case-study-of-employee-self-services-mobile-app-19c752e05c15
17. Darwinbox, Why India's HRMS must be mobile-first — https://darwinbox.com/blog/mobile-hrms-india
18. Aspire Systems, Self-service HR mobile application case study — https://www.aspiresys.com/casestudies/enabling-a-self-service-hr-mobile-application-for-an-electronics-giant-powered-by-eQuipMe.pdf
19. People Matters, Leave carry-forward and encashment rules set for nationwide standardisation (14 Apr 2026) — https://www.peoplematters.in/news/strategic-hr/leave-carry-forward-and-encashment-rules-set-for-nationwide-standardisation-49221 (read in full)
20. Supreme Today, OSH Code and State Shops Acts clash (2026) — https://supremetoday.ai/indias-employers-face-legal-dilemma-as-osh-code-and-state-shops-acts-clash-20260825108 (read in full)
21. Outlook Money, New labour codes: how you earn, carry and encash leave — https://www.outlookmoney.com/news/new-labour-codes-change-heres-how-you-earn-carry-and-encash-leave

**Note on sources.** Items 4–5 and 6–8 are secondary sources (law-firm notes and HR vendor pages), not the Act text. Items 9–18 are vendor blogs, case studies and one organisation's published orders, used for **patterns of complaint, not statistics**. Items 19–20 were read in full; the rest were summarised from search results and should be opened before the viva. Verify legal points against official text (indiacode.nic.in) where marked.
