import 'server-only';
import { tool } from 'ai';
import { z } from 'zod';
import { searchPolicy } from '@/lib/domain/policySearch';
import { validateLeaveRequest } from '@/lib/domain/leaveRules';
import { countWorkingDays } from '@/lib/domain/workingDays';
import { addDays, dayOfWeek, formatDateIST, monthRange, type ISODate } from '@/lib/time/ist';
import { teamToday } from '@/modules/attendance/queries';
import { pendingLeave } from '@/modules/approvals/queries';
import { applyContext, balancesFor, leaveTypesFor } from '@/modules/leave/queries';
import { monthEnd } from '@/modules/reports/queries';
import type { AgentContext, DraftCard, ToolTrace } from './context';
import { allowedTools, redact, untrusted } from './guardrails';


const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A real calendar date in YYYY-MM-DD form. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, 'Not a real date');

export interface AgentRun { traces: ToolTrace[]; drafts: DraftCard[] }

/**
 * Builds the tools for ONE question. Every tool is wrapped so that it: counts against the 5-call limit, runs on the
 * server with the signed-in user's session, has its result redacted, and is written to agent_log before the model sees
 * it. Only tools allowed for the user's role are created, so an employee's model never learns that manager or HR tools exist.
 */
export function buildTools(ctx: AgentContext, run: AgentRun) {
  const wrap = <I, O>(name: string, summarise: (i: I) => string, fn: (i: I) => Promise<O>) =>
    async (input: I): Promise<unknown> => {
      if (!ctx.limiter.take()) return { error: 'Tool-call limit reached (5 per question). Answer with what you already have.' };
      let result: unknown;
      try { result = await fn(input); } catch (e) { result = { error: e instanceof Error ? e.message : 'Tool failed' }; }
      const safe = redact(result);
      // Fail closed: if the call cannot be written to agent_log, the model never sees the result.
      if (!(await ctx.log(name, redact(input), safe))) return { error: 'This action could not be recorded, so it was stopped.' };
      run.traces.push({ name, summary: summarise(input) });
      return safe;
    };

  const all = {
    get_my_leave_balance: tool({
      description: 'Returns the signed-in user\'s leave balance per leave type for a year: opening, accrued, used, pending and available days. Use it for ANY question about how much leave they have. Never state a balance without calling this.',
      inputSchema: z.object({ year: z.number().int().min(2020).max(2100).optional().describe('Leave year; defaults to the current year') }),
      execute: wrap('get_my_leave_balance', (i: { year?: number }) => `year ${i.year ?? ctx.today.slice(0, 4)}`, async ({ year }: { year?: number }) => {
        const y = year ?? Number(ctx.today.slice(0, 4));
        const rows = await balancesFor(ctx.db, ctx.employee, y, ctx.today);
        return {
          year: y,
          balances: rows.filter((r) => r.type.accrualMethod !== 'none').map((r) => ({
            code: r.type.code, name: r.type.name, available: r.balance.available, opening: r.balance.opening,
            accrued: r.balance.accrued, used: r.balance.used, pending: r.balance.pending,
          })),
        };
      }),
    }),

    get_holidays: tool({
      description: 'Lists the holidays at the signed-in user\'s work location for one month (National, State and Optional). Use it to answer "is X a holiday" or "which holidays are in October".',
      inputSchema: z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100) }),
      execute: wrap('get_holidays', (i: { month: number; year: number }) => `${i.year}-${String(i.month).padStart(2, '0')}`, async ({ month, year }: { month: number; year: number }) => {
        const { first, last } = monthRange(`${year}-${String(month).padStart(2, '0')}`);
        const { data } = await ctx.db.from('holidays').select('date, name, type').eq('location_id', ctx.employee.location_id)
          .gte('date', first).lte('date', last).order('date');
        return { holidays: ((data ?? []) as { date: string; name: string; type: string }[]).map((h) => ({ ...h, weekday: DAY_NAMES[dayOfWeek(h.date)] })) };
      }),
    }),

    count_working_days: tool({
      description: 'Counts how many leave days a date range costs for the signed-in user, excluding weekly offs and holidays at THEIR location (there is no sandwich rule). Use it for any question like "how many days if I take Friday to Monday". Dates are inclusive, as YYYY-MM-DD.',
      inputSchema: z.object({
        from_date: isoDate, to_date: isoDate,
        is_half_day: z.boolean().optional().describe('Only for a single date'),
        leave_type_code: z.string().optional().describe('Maternity (ML) and Paternity (PL) count calendar days'),
      }),
      execute: wrap('count_working_days', (i: { from_date: string; to_date: string }) => `${i.from_date} to ${i.to_date}`, async (i: { from_date: string; to_date: string; is_half_day?: boolean; leave_type_code?: string }) => {
        if (i.to_date < i.from_date) throw new Error('to_date is before from_date');
        if (i.to_date > addDays(i.from_date, 400)) throw new Error('Range too long');
        const types = await leaveTypesFor(ctx.db, ctx.employee.gender);
        const calendarDays = types.find((t) => t.code === i.leave_type_code)?.countsCalendarDays ?? false;
        const { cal } = await applyContext(ctx.db, ctx.employee, ctx.today);
        const r = countWorkingDays({ from: i.from_date, to: i.to_date, isHalfDay: !!i.is_half_day, cal, calendarDays });
        return {
          from: i.from_date, to: i.to_date, days: r.days,
          not_counted: r.excluded.map((x) => ({ date: x.date, weekday: DAY_NAMES[dayOfWeek(x.date)], reason: x.reason === 'weekly_off' ? 'weekly off' : 'holiday' })),
        };
      }),
    }),

    explain_policy: tool({
      description: 'Looks up the company\'s stored leave, attendance and holiday policy text. Use it for ANY policy question (quotas, carry forward, certificates, Late rules, hours). It returns only text from the stored policy. If found is false, tell the user you do not know and suggest asking HR; never answer from general knowledge.',
      inputSchema: z.object({ question: z.string().min(2).max(300) }),
      execute: wrap('explain_policy', (i: { question: string }) => i.question.slice(0, 60), async ({ question }: { question: string }) => {
        const { data } = await ctx.db.from('policy_documents').select('slug, title, body');
        const hits = searchPolicy((data ?? []) as { slug: string; title: string; body: string }[], question);
        return hits.length ? { found: true, passages: hits } : { found: false, note: 'No stored policy text covers this. Say you do not know.' };
      }),
    }),

    draft_leave_request: tool({
      description: 'Prepares a leave request as a DRAFT for the signed-in user. NOTHING is submitted: the user must press the Confirm button themselves. Call count_working_days first if you are unsure of the dates. Sick leave over 2 days cannot be drafted because it needs a certificate upload on the Apply screen.',
      inputSchema: z.object({
        leave_type_code: z.string().describe('CL, SL, EL, ML, PL or LOP'),
        from_date: isoDate, to_date: isoDate,
        is_half_day: z.boolean().default(false),
        reason: z.string().min(3).max(300),
      }),
      execute: wrap('draft_leave_request', (i: { leave_type_code: string; from_date: string; to_date: string }) => `${i.leave_type_code} ${i.from_date} to ${i.to_date}`,
        async (i: { leave_type_code: string; from_date: string; to_date: string; is_half_day: boolean; reason: string }) => {
          const code = i.leave_type_code.toUpperCase();
          const year = Number(i.from_date.slice(0, 4));
          const [types, ctxData, balances] = await Promise.all([
            leaveTypesFor(ctx.db, ctx.employee.gender), applyContext(ctx.db, ctx.employee, ctx.today), balancesFor(ctx.db, ctx.employee, year, ctx.today),
          ]);
          const type = types.find((t) => t.code === code);
          if (!type) return { drafted: false, errors: [`Leave type ${code} is not available for this user.`] };
          const half = i.is_half_day && i.from_date === i.to_date;
          const counted = countWorkingDays({ from: i.from_date, to: i.to_date, isHalfDay: half, cal: ctxData.cal, calendarDays: type.countsCalendarDays });
          const errors = validateLeaveRequest({
            today: ctx.today, from: i.from_date, to: i.to_date, isHalfDay: half, days: counted.days,
            type: { code, halfDayAllowed: type.halfDayAllowed, certificateAfterDays: type.certificateAfterDays, eligibleGender: type.eligibleGender },
            gender: ctx.employee.gender, hasCertificate: false, existing: ctxData.existing,
          });
          if (errors.length) return { drafted: false, errors, days: counted.days };

          const bal = balances.find((b) => b.type.code === code)?.balance.available ?? 0;
          const unlimited = type.accrualMethod === 'none';
          // Same whole-day split as the database: floor(available) days use the type, the rest become Loss of Pay.
          const short = !unlimited && counted.days > bal;
          const leavePart = short ? Math.min(Math.floor(Math.max(bal, 0)), counted.days) : counted.days;
          const lopExcess = short ? counted.days - leavePart : 0;
          const payload = { type_code: code, from_date: i.from_date, to_date: i.to_date, is_half_day: half, reason: i.reason, convert_lop: lopExcess > 0 };
          const id = await ctx.saveDraft('leave_request', payload);
          if (!id) throw new Error('Could not save the draft');

          const lines = [
            `${formatDateIST(i.from_date)}${i.to_date !== i.from_date ? ` to ${formatDateIST(i.to_date)}` : ''}${half ? ' (half day)' : ''}`,
            `${counted.days} working day(s)`,
            unlimited ? 'Loss of Pay' : `${code} balance after: ${Math.max(bal - leavePart, 0).toFixed(1)}`,
            ...(lopExcess > 0 ? [`Not enough ${code}: ${lopExcess} day(s) would become Loss of Pay`] : []),
            `Reason: ${i.reason}`,
          ];
          run.drafts.push({ id: String(id), kind: 'leave_request', title: `Draft ${code} request`, lines, confirmLabel: lopExcess > 0 ? `Confirm (${lopExcess} day(s) become LOP)` : 'Confirm and submit' });
          return {
            drafted: true, draft_id: id, days: counted.days, available_before: bal, lop_excess_days: lopExcess,
            message: 'Draft saved. Tell the user to review it and press the Confirm button. Nothing has been submitted.',
          };
        }),
    }),

    get_team_today: tool({
      description: 'Managers and HR only. Shows who in the signed-in manager\'s team (direct reports) is present, on leave, absent or not yet in today. HR without reports sees everyone. Use it for "who is absent today".',
      inputSchema: z.object({}),
      execute: wrap('get_team_today', () => 'today', async () => {
        if (!ctx.isManager && !ctx.isHr) throw new Error('Only managers and HR can see team attendance.');
        const rows = await teamToday(ctx.db, ctx.isManager ? { managerId: ctx.employee.id } : {}, ctx.today);
        return { date: ctx.today, team: rows.map((r) => ({ name: r.name, code: r.code, status: r.status, late: r.isLate, work_from_home: r.wfh })) };
      }),
    }),

    summarise_pending_approvals: tool({
      description: 'Managers and HR only. Lists leave requests waiting for the signed-in person to decide, with the employee\'s balance and clash warnings. You can describe them but you CANNOT approve or reject; tell them to use the Approvals screen.',
      inputSchema: z.object({}),
      execute: wrap('summarise_pending_approvals', () => 'pending', async () => {
        if (!ctx.isManager && !ctx.isHr) throw new Error('Only managers and HR can see approvals.');
        const rows = await pendingLeave(ctx.db, ctx.employee, ctx.today);
        return {
          pending: rows.map((r) => ({
            employee: r.employee.name, code: r.employee.code, leave: r.parts.map((p) => `${p.code} ${p.days}`).join(' + '),
            from: r.from, to: r.to, reason: untrusted(r.reason),
            balance_before: r.balance?.before, balance_after: r.balance?.after, clashes_with: r.clashWith,
          })),
        };
      }),
    }),

    month_end_check: tool({
      description: 'HR only. Month-end attendance check: finds employees with 3 or more Late marks or missed punches (checked in but never checked out) in a month, and prepares a reminder email as a DRAFT for HR to confirm. Nothing is sent until HR presses Confirm.',
      inputSchema: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().describe('YYYY-MM; defaults to the current month') }),
      execute: wrap('month_end_check', (i: { month?: string }) => i.month ?? ctx.today.slice(0, 7), async ({ month }: { month?: string }) => {
        if (!ctx.isHr) throw new Error('Only HR can run the month-end check.');
        const m = month ?? ctx.today.slice(0, 7);
        const { first, last } = monthRange(m);
        const { rows } = await monthEnd(ctx.db, ctx.employee, true, m, ctx.today);
        const { data: att } = await ctx.db.from('attendance').select('employee_id, date').not('check_in', 'is', null).is('check_out', null)
          .gte('date', first).lte('date', last).lt('date', ctx.today);
        const { data: emps } = await ctx.db.from('employees').select('id, employee_code, full_name').in('employee_code', rows.map((r) => r.code));
        const byCode = new Map(((emps ?? []) as { id: string; employee_code: string; full_name: string }[]).map((e) => [e.employee_code, e]));
        const missed = new Map<string, string[]>();
        for (const a of (att ?? []) as { employee_id: string; date: string }[]) missed.set(a.employee_id, [...(missed.get(a.employee_id) ?? []), a.date]);

        const flagged = rows.flatMap((r) => {
          const e = byCode.get(r.code);
          const dates = e ? missed.get(e.id) ?? [] : [];
          return e && (r.summary.lateCount >= 3 || dates.length > 0)
            ? [{ id: e.id, name: r.name, code: r.code, late_marks: r.summary.lateCount, missed_punch_dates: dates }] : [];
        });
        let draftId: string | null = null;
        if (flagged.length) {
          const label = new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
          const payload = {
            recipients: flagged.map((f) => f.id),
            subject: `Please review your attendance for ${label}`,
            body: `Our records show repeated Late marks or missed punches for ${label}. Please open Tarang > Attendance and request a correction for any missed punch. Every 3 Late marks in a month count as half a day of Loss of Pay.`,
          };
          draftId = await ctx.saveDraft('reminder_email', payload);
          if (draftId) {
            run.drafts.push({
              id: draftId, kind: 'reminder_email', title: `Reminder email to ${flagged.length} employee(s)`,
              lines: [payload.subject, ...flagged.map((f) => `${f.name} (${f.code}): ${f.late_marks} Late, ${f.missed_punch_dates.length} missed punch(es)`)],
              confirmLabel: 'Confirm and queue emails',
            });
          }
        }
        return { month: m, flagged: flagged.map(({ id: _id, ...rest }) => rest), draft_id: draftId, message: draftId ? 'Draft reminder prepared. HR must press Confirm to queue the emails.' : 'Nobody needs a reminder this month.' };
      }),
    }),
  };

  const allowed = new Set(allowedTools({ isManager: ctx.isManager, isHr: ctx.isHr }));
  return Object.fromEntries(Object.entries(all).filter(([name]) => allowed.has(name))) as Partial<typeof all>;
}
