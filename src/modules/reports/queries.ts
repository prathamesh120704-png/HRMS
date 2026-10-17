import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/lib/auth/session';
import type { ReportRow } from '@/lib/csv';
import type { Punch } from '@/lib/domain/dayStatus';
import { monthSummary } from '@/lib/domain/monthSummary';
import type { ApprovedLeave } from '@/lib/domain/types';
import { addDays, monthRange, type ISODate } from '@/lib/time/ist';
import { calendars } from '@/modules/attendance/queries';

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

/** Reads every page of a query. 180 people x 31 days is 5,580 attendance rows, well over one page. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export interface MonthEnd { rows: ReportRow[]; leaveCodes: string[]; countedThrough: ISODate | null }

type Emp = {
  id: string; employee_code: string; full_name: string; date_of_joining: string; last_working_day: string | null;
  location_id: string; location: { name: string } | { name: string }[] | null;
};

/**
 * Month-end summary (L8). Scope: HR sees everyone, a manager sees direct reports ("own team").
 * Counted through YESTERDAY when the month is still running, because today is not finished and would show
 * everyone as Absent. All maths is monthSummary (R24): the same function the calendar relies on.
 */
export async function monthEnd(db: SupabaseClient, me: Employee, isHr: boolean, month: string, today: ISODate): Promise<MonthEnd> {
  const { first, last } = monthRange(month);
  const through = last < today ? last : addDays(today, -1);

  const { data: types } = await db.from('leave_types').select('code').neq('code', 'LOP');
  const order = ['CL', 'SL', 'EL', 'ML', 'PL'];
  const rank = (c: string) => (order.includes(c) ? order.indexOf(c) : 99);
  const leaveCodes = ((types ?? []) as { code: string }[]).map((t) => t.code).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  let q = db.from('employees')
    .select('id, employee_code, full_name, date_of_joining, last_working_day, location_id, location:locations(name)')
    .lte('date_of_joining', last)
    .or(`last_working_day.is.null,last_working_day.gte.${first}`)
    .order('employee_code');
  if (!isHr) q = q.eq('reporting_manager_id', me.id);
  const { data: emps } = await q;
  const people = (emps ?? []) as unknown as Emp[];
  if (people.length === 0 || through < first) return { rows: [], leaveCodes, countedThrough: through < first ? null : through };

  const ids = people.map((p) => p.id);
  const calFor = await calendars(db, [...new Set(people.map((p) => p.location_id))], ids, first, last);

  const att = await fetchAll<{ employee_id: string; date: string; check_in: string | null; check_out: string | null; is_wfh: boolean }>((a, b) =>
    db.from('attendance').select('employee_id, date, check_in, check_out, is_wfh').in('employee_id', ids)
      .gte('date', first).lte('date', last).order('date').range(a, b));
  const leaves = await fetchAll<{ employee_id: string; from_date: string; to_date: string; is_half_day: boolean; leave_types: { code: string } | { code: string }[] | null }>((a, b) =>
    db.from('leave_requests').select('employee_id, from_date, to_date, is_half_day, leave_types(code)').in('employee_id', ids)
      .eq('status', 'approved').lte('from_date', last).gte('to_date', first).order('from_date').range(a, b));

  const punchBy = new Map<string, Map<ISODate, Punch>>();
  for (const r of att) {
    const m = punchBy.get(r.employee_id) ?? new Map<ISODate, Punch>();
    m.set(r.date, { checkIn: r.check_in ? new Date(r.check_in) : null, checkOut: r.check_out ? new Date(r.check_out) : null, isWfh: r.is_wfh });
    punchBy.set(r.employee_id, m);
  }
  const leaveBy = new Map<string, ApprovedLeave[]>();
  for (const r of leaves) {
    const code = (Array.isArray(r.leave_types) ? r.leave_types[0] : r.leave_types)?.code ?? 'LV';
    leaveBy.set(r.employee_id, [
      ...(leaveBy.get(r.employee_id) ?? []),
      { from: r.from_date, to: r.to_date, isHalfDay: r.is_half_day, typeCode: code, isLop: code === 'LOP' },
    ]);
  }

  const rows: ReportRow[] = people.map((p) => ({
    code: p.employee_code,
    name: p.full_name,
    location: (Array.isArray(p.location) ? p.location[0] : p.location)?.name ?? '',
    summary: monthSummary({
      month,
      cal: calFor({ id: p.id, location_id: p.location_id, date_of_joining: p.date_of_joining, last_working_day: p.last_working_day }),
      punches: punchBy.get(p.id) ?? new Map(),
      leaves: leaveBy.get(p.id) ?? [],
      joinDate: p.date_of_joining,
      lastWorkingDay: p.last_working_day,
      today: through,
    }),
  }));
  return { rows, leaveCodes, countedThrough: through };
}
