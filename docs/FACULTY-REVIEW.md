# Faculty review pack (ARCHITECTURE.md and DESIGN.md sign-off)

The brief says architecture and design are reviewed and signed off, and the grade (15%) checks that the built app matches them and that
every change is in the decision log. This pack makes that a 20-minute meeting.

## 1. Send this before the meeting
Links to open (the repo is public):
- Architecture: https://github.com/prathamesh120704-png/HRMS/blob/main/ARCHITECTURE.md
- Design: https://github.com/prathamesh120704-png/HRMS/blob/main/DESIGN.md
- Research (rules R1 to R35): https://github.com/prathamesh120704-png/HRMS/blob/main/RESEARCH.md
- Live app: https://hrms-pi-three.vercel.app · Repo: https://github.com/prathamesh120704-png/HRMS

### Draft booking message (edit, then send it yourself)
> Hello Praveen,
>
> My HRMS project (Tarang, for Konkan Coastal Foods) is built and deployed. Could I book 20 minutes for the architecture and design review and sign-off?
> I can do: **[slot 1]**, **[slot 2]** or **[slot 3]**.
>
> Documents (please skim before we meet): ARCHITECTURE.md, DESIGN.md and RESEARCH.md (the interview is in section 8) at https://github.com/prathamesh120704-png/HRMS ; live app https://hrms-pi-three.vercel.app
>
> I have 11 short decisions I need your view on (listed in docs/FACULTY-REVIEW.md in the repo), mainly the LOP definition, Aadhaar reveal, and maternity leave.
>
> Thank you,
> Prathamesh

## 2. The 20-minute plan
| Minutes | What | Show |
|---|---|---|
| 0–3 | **Architecture in one picture** | The system diagram (ARCHITECTURE.md §2): browser, Next.js on Vercel, Clerk (identity only), Supabase (rules in the database), email, AI. Say where the role checks are (§2 table) |
| 3–7 | **The three decisions that matter most** | (1) Role lives in my database, checked on the server, plus row-level security. (2) No direct table writes: every write is a role-checking database function. (3) The balance is **calculated, not stored** |
| 7–10 | **Data model** | The ER diagram (§3.1) and the constraints that enforce the rules (unique attendance per day, no overlapping leave, immutable employee code, no reporting loop) |
| 10–13 | **Design** | DESIGN.md: the four flows, the colour system, then **§7, where the built app differs from the wireframes** (say the gaps yourself) |
| 13–18 | **The decisions below** | Walk through the table in section 3 and write the answers down |
| 18–20 | **Sign-off** | Fill in the record in section 4 together |

If asked "does the app match the documents?": point at the **decision log** (ARCHITECTURE.md §11): every change from the first plan is dated with the reason.

## 3. Decisions I need from faculty (11)
These are cases the brief leaves open. For each, I made a choice and recorded it. Please confirm or change.

| # | Question | What the app does now | Where |
|---|---|---|---|
| 1 | **Aadhaar Reveal.** The brief has a Reveal action but also says Aadhaar is never shown unmasked. | Aadhaar is **never** revealable, even by HR. HR can reveal PAN and the bank account (each logged) | R2, `hr_reveal()` |
| 2 | **What is LOP?** The brief reports "LOP days" but does not define them. | An Absent day = 1 LOP, a Half Day = 0.5 present + 0.5 LOP, LOP leave = LOP, every 3 Late marks = 0.5 LOP | R24 |
| 3 | **Maternity leave.** | 182 calendar days (26 weeks) for the first two children and 84 days after; Paternity 5 days; both counted in calendar days; only the right gender can apply | R30, RESEARCH §10 |
| 4 | **Sick leave quota.** The company policy gives 7 days; the Goa Shops and Establishments Act, 1973 (s. 23) gives 9. | The app follows the company policy (7) and says so | RESEARCH §5 |
| 5 | **Which Goa Act applies?** A source says a 2025 Act replaced the 1973 one. | The research follows the 1973 text; I could not confirm the 2025 one | RESEARCH §5 |
| 6 | **Pro-rating** (not in the brief). | Joined on or before the 15th: the joining month counts; after the 15th it does not. Rounded to the nearest 0.5. Joined 1 July: CL 4, SL 3.5 | R20 |
| 7 | **Optional holidays.** | Employee-picked, up to 2 a year; an unpicked optional holiday is a normal working day | R31 |
| 8 | **Leave types, departments, locations** cannot be edited in the app (only holidays can). The brief says HR configures leave types (L1). | Set by the seed. Known gap, documented. **Should I build the Settings screen, or is the seed-only setup acceptable?** | DESIGN §7 |
| 9 | **HR's own leave.** Nobody can decide their own request, and the seed has one HR Admin. | HR's own leave cannot be approved. Demo uses employee requests. Should the seed have a second HR Admin? | R34 |
| 10 | **Demo and the AI.** The free AI tier is about 20 requests a day per model. | Four models are tried in turn; the demo keeps to a few questions | ARCHITECTURE §7 |
| 11 | **EL carry-forward.** The company policy caps it at 30 days. The Goa Act, 1973 s.23 allows building up to 45 days; reports say the new national Labour Code caps it at 30. | The app uses the policy's 30 (R35). Which law governs? | RESEARCH §8a, §5 |

## 4. Sign-off record (fill in at the meeting)
| Document | Version | Reviewed by | Date | Decision | Changes requested |
|---|---|---|---|---|---|
| ARCHITECTURE.md | v0.3 | | | ☐ signed off ☐ changes requested | |
| DESIGN.md | v0.3 | | | ☐ signed off ☐ changes requested | |
| RESEARCH.md (rules R1–R35) | | | | ☐ agreed ☐ changes requested | |

After the meeting: copy the result into the **Sign-off** block at the end of ARCHITECTURE.md and DESIGN.md, change their header from
"awaiting faculty sign-off" to "signed off on [date] by [name]", and put any requested change in the decision log **before** you change the code.
