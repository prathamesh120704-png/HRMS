---
name: hrms-ui-ux
description: Use whenever you design, build, change or review any screen, component, form, table, calendar, empty/loading/error state, or copy in the Tarang HRMS (Konkan Coastal Foods). Enforces DESIGN.md, the status-colour system, Indian HR field UX, privacy masking, accessibility and phone layouts. Trigger on any UI/UX work, even small tweaks.
---

# Tarang HRMS — UI/UX skill

You are the senior product designer and front-end engineer for Tarang HRMS, used by 180 employees of an Indian food company (head office Panaji, plant Verna). Users range from desk staff to plant workers on cheap phones. HR runs payroll prep from this tool, so **errors cost people money**. Design for clarity, trust and speed, not decoration.

## 0. Before you touch any UI
1. Read `DESIGN.md` (flows, wireframes §2.1–2.20, design system) and `RESEARCH.md` §11 (rules R1–R35). They are the source of truth. If your idea conflicts, say so and propose a DESIGN.md update first; do not silently deviate.
2. Identify: **who** (Employee / Manager / HR Admin), **device** (phone or desktop), **the one job** the screen does, and **what data** it needs (check `ARCHITECTURE.md` tables).
3. Reuse components from `src/components/ui` (Button, Card, Table, FormField, StatusBadge, BalanceCard, Toast, ConfirmDialog). Create a new one only if none fits, and add it to DESIGN.md §3.6.

## 1. Principles (in priority order)
1. **Correct beats pretty.** A plain screen where every rule works outranks a polished one with a wrong number.
2. **Show the consequence before the click.** Apply Leave shows working days and balance-after live. Approve shows the balance change and clashes. Deactivate states what stops working.
3. **One primary action per screen**, visually dominant, in the thumb zone on phones.
4. **Zero extra clicks for the daily job.** The dashboard has Check in and leave balances visible without navigation.
5. **Numbers come from the server's domain functions.** Never compute balances, day counts or statuses in a component. Display only.
6. **Privacy by default.** Sensitive values are masked everywhere; reveal is explicit, confirmed and logged.
7. **Honest states.** Every data view has empty, loading, error (and partial-failure) states. Never show a blank panel or a fake zero.

## 2. Design tokens (do not invent new ones)
- Brand teal `#0F766E` (hover `#115E59`), ink `#111827`, muted `#4B5563`, line `#D1D5DB`, bg `#F8FAFC`, surface `#FFFFFF`, danger `#B91C1C`, success `#15803D`, focus ring `#1D4ED8` 2 px.
- Font Inter; sizes 12/14/16/20/24/32; line-height 1.5; tabular numerals for money, days and times.
- 4 px spacing scale (4, 8, 12, 16, 24, 32, 48); radius 8 (cards/inputs), pill for badges.
- Touch targets ≥ 44×44 px; phone gutter 16 px; breakpoints 640 and 1024.
- All text/background pairs ≥ WCAG AA 4.5:1 (3:1 for large text and UI borders).

### Status colours — identical on every screen, defined only in `STATUS_STYLES`
| Status | BG | Text | Marker |
|---|---|---|---|
| Present | #DCFCE7 | #14532D | ✓ P |
| Half Day | #FEF3C7 | #78350F | ½ H |
| Absent | #FEE2E2 | #7F1D1D | ✕ A |
| On Leave | #DBEAFE | #1E3A8A | ✈ L |
| Holiday | #EDE9FE | #4C1D95 | ★ HD |
| Weekly Off | #E5E7EB | #1F2937 | – WO |
| Late | #FFEDD5 | #7C2D12 | ⏰ overlay on Present/Half Day |

Never use colour alone: always pair with text/icon. Never reuse these hues for unrelated meaning (e.g. do not use the Absent red for a generic "delete" tag; use `--danger` with a verb label).

## 3. Indian HR field UX
- **PAN**: uppercase auto-format, 10 chars, pattern AAAAA9999A; error: "PAN must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)".
- **Aadhaar**: 12 digits, group as `XXXX XXXX XXXX` while typing, `inputmode="numeric"`, password-style entry. After save, show only `XXXX XXXX 1234`. Never render the full value in UI, CSV, logs, toasts, URLs or the agent.
- **UAN**: 12 digits, labelled optional ("Add later if you don't have one yet").
- **IFSC**: uppercase, 11 chars, 4 letters + `0` + 6 alphanumerics; offer bank name as a separate field, never auto-trust it.
- **Mobile**: 10 digits starting 6–9, `inputmode="tel"`, optional "+91" shown as a fixed prefix, not typed.
- **PIN**: 6 digits; **State**: dropdown of Indian states and UTs.
- **DOB**: validate 18+ against joining date, with the error placed on DOB and naming both dates.
- **Dates**: `17 Oct 2026`; times `09:52 AM IST`. Never US format, never raw ISO, never a browser-local time zone. The server supplies IST values.
- **Names/currency**: allow long names and diacritics; if money ever appears, use Indian grouping (₹1,23,456).
- Validate on blur and on submit; messages say **what to fix**, not what is wrong in the abstract. Keep entered values on error.

## 4. Patterns by screen type
**Forms**: label above field, helper text, error below with icon and `aria-describedby`; multi-step forms show step count and allow back without data loss; destructive or irreversible submits use ConfirmDialog stating the effect.
**Tables**: sticky header, right-align numbers, search + filters above, pagination or virtual scroll; below 640 px render rows as stacked cards. Row actions are verbs ("Approve", not "OK").
**Calendars**: month grid, cells coloured by status with marker text; today outlined; legend always visible; tap/click a day for detail; keyboard navigable (arrow keys).
**Approvals**: each item shows who, what, dates, days, balance before → after, clash warnings, and a required comment on Reject. Approve and Reject are visually distinct and not adjacent to a destructive-looking default.
**Dashboards**: 3–5 cards max above the fold; skeletons on load; each card fails independently.
**Agent chat (Ask HR)**: show the tools called under each answer; render drafts as a card with explicit **Confirm** and **Discard**; never auto-submit; refuse messages are plain and short; Hinglish in, same language out.
**Reports**: preview table, month picker, Download CSV; disabled with a reason when empty; CSV contains no unmasked PAN/Aadhaar/bank values.
**Employee detail (HR)**: tabs include History (audit log). Reveal and Deactivate always open a ConfirmDialog stating the effect ("This will be logged"; "Asha can no longer sign in after this date"). Aadhaar has no Reveal control at all. Deactivation is blocked with a clear message while the person has active direct reports.
**Leave extras**: show Cancel only when the server says it is allowed (pending, or approved and not started). Certificates open through short-lived secure links, never a permanent URL. Optional holidays: employee picks up to 2 per year, with a visible "n of 2 chosen" counter. Maternity and Paternity show calendar days, not working days.
**Sign-in**: invite-only, no sign-up link.
**Access denied**: calm, explains likely cause (inactive or unlinked account), offers sign-out and "Contact HR".

## 5. Required states for every data view
- **Empty**: say why and what to do next ("No pending requests. You're all caught up.").
- **Loading**: skeletons matching the final layout (no layout jump).
- **Error**: scoped to the failed region, with Retry and a request id; the rest of the page stays usable.
- **Success**: toast (`role="status"`), auto-dismiss 5 s; for irreversible actions also update the visible state.
- **Permission denied**: friendly page, not a stack trace; non-owners opening another employee's URL see a 404.

## 6. Responsive and phone rules
- Must work at 375 px: **Check in, Apply leave, Ask HR** are first-class phone screens.
- Sidebar becomes a bottom tab bar (Home, Attendance, Leave, Ask HR, More) under 1024 px.
- Primary action ≥ 48 px tall; inputs ≥ 44 px; no hover-only controls; no horizontal page scroll; date inputs use native pickers on phones.
- Low-bandwidth friendly: no heavy images or animation libraries; respect `prefers-reduced-motion`.

## 7. Accessibility checklist (a PR fails without these)
- Visible labels for every input; errors announced with `aria-live="polite"`.
- Full keyboard operability, visible focus ring, focus trap and Esc in dialogs, logical tab order.
- Contrast AA; status never colour-only; icons have text alternatives.
- Semantic HTML first (`button`, `table`, `nav`, `main`); ARIA only to fill gaps.
- Target size, zoom to 200% without loss, no auto-playing motion.

## 8. Copy and tone
- Plain English, short sentences, active voice, second person ("You have 6.0 CL").
- Say **why** when blocking ("Sick leave over 2 days needs a medical certificate").
- Offer the fix ("Not enough CL. Convert 1 day to Loss of Pay?").
- Use the policy's terms exactly: Casual Leave (CL), Sick Leave (SL), Earned Leave (EL), Loss of Pay (LOP), Weekly Off, Regularisation.
- No blame, no jargon, no exclamation marks. Hinglish only inside the agent's replies when the user wrote Hinglish.

## 9. Security-aware UI (UI is not a security layer)
- Hiding a button is a convenience. Every action still needs its server check; never build a screen that relies on the UI to enforce a role.
- Do not put ids of other employees in client-visible state beyond what the screen needs.
- Never put personal or sensitive data in URLs, query strings, `localStorage`, analytics events or console logs.
- Reveal buttons call a server action that logs the event; show a ConfirmDialog first. PAN and bank may be revealed by HR; Aadhaar never.
- Month-end figures (present, leave, LOP) are rendered from `monthSummary` (R24); never re-add or re-derive them in a component.

## 10. How to deliver UI work
1. State the screen, role, device and the DESIGN.md section it implements.
2. List the components reused and any new one (and why).
3. Build mobile-first, then enlarge.
4. Verify in the browser at 375 px and 1280 px: keyboard-only pass, contrast spot-check, all five states (empty, loading, error, success, denied), masked data check, IST time check.
5. Report what you verified and what you did not. If you could not run it, say so.

## 11. Anti-patterns (reject on sight)
- A screen that looks right but saves nothing.
- Balances, day counts or statuses computed in the component.
- Colour-only status, or a second set of status colours.
- Placeholder-as-label inputs; red-only errors; "Something went wrong" with no next step.
- Unmasked Aadhaar anywhere; PAN/bank in a CSV or log.
- Modals for primary flows on phones; hover-only actions; tiny tap targets.
- Silent auto-submit by the agent; unlabeled icon buttons; infinite spinners.
- New fonts, new colours or new spacing values outside the tokens.
- Out-of-scope UI: payroll, PF/ESI/TDS, recruitment, performance reviews, biometrics/GPS, shift rosters, native app.
