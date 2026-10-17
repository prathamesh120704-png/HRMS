import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveDayStatus, type DayResult, type Punch } from '@/lib/domain/dayStatus';
import type { ApprovedLeave, Holiday, WorkCalendar } from '@/lib/domain/types';
import { dayOfWeek, eachDate, monthRange, type ISODate } from '@/lib/time/ist';

interface Who { id: string; location_id: string; date_of_joining: string; last_working_day: string | null }

interface AttRow { employee_id: string; date: string; check_in: string | null; check_out: string | null; is_wfh: boolean }
interface LeaveRow { employee_id: string; from_date: string; to_date: string; is_half_day: boolean; leave_types: { code: string } | { code: string }[] | null }

const toPunch = (r: AttRow): Punch => ({
  checkIn: r.check_in ? new Date(r.check_in) : null,
  checkOut: r.check_out ? new Date(r.check_out) : null,
  isWfh: r.is_wfh,
});

function toLeave(r: LeaveRow): ApprovedLeave {
  const t = Array.isArray(r.leave_types) ? r.leave_types[0] : r.leave_types;
  const code = t?.code ?? 'LV';
  return { from: r.from_date, to: r.to_date, isHalfDay: r.is_half_day, typeCode: code, isLop: code === 'LOP' };
}

/** Calendars for a set of locations and the optional holidays each employee picked, for a date range. Shared with reports. */
export async function calendars(db: SupabaseClient, locationIds: string[], employeeIds: string[], from: ISODate, to: ISODate) {
  const [locs, hols, picks] = await Promise.all([
    db.from('locations').select('id, weekly_off_days').in('id', locationIds),
    db.from('holidays').select('id, location_id, date, name, type').in('location_id', locationIds).gte('date', from).lte('date', to),
    db.from('employee_optional_holidays').select('employee_id, holidays(date)').in('employee_id', employeeIds),
  ]);
  const weekly = new Map<string, number[]>((locs.data ?? []).map((l: { id: string; weekly_off_days: number[] }) => [l.id, l.weekly_off_days]));
  const byLoc = new Map<string, Holiday[]>();
  for (const h of (hols.data ?? []) as { location_id: string; date: string; name: string; type: Holiday['type'] }[]) {
    byLoc.set(h.location_id, [...(byLoc.get(h.location_id) ?? []), { date: h.date, name: h.name, type: h.type }]);
  }
  const picked = new Map<string, ISODate[]>();
  for (const p of (picks.data ?? []) as unknown as { employee_id: string; holidays: { date: string } | { date: string }[] | null }[]) {
    const h = Array.isArray(p.holidays) ? p.holidays[0] : p.holidays;
    if (h) picked.set(p.employee_id, [...(picked.get(p.employee_id) ?? []), h.date]);
  }
  return (who: Who): WorkCalendar => ({
    weeklyOffDays: weekly.get(who.location_id) ?? [0],
    holidays: byLoc.get(who.location_id) ?? [],
    pickedOptional: picked.get(who.id) ?? [],
  });
}

export interface MonthDay { date: ISODate; result: DayResult; holidayName?: string }

/** A: month calendar for one employee, using the same deriveDayStatus as every other screen. */
export async function monthFor(db: SupabaseClient, who: Who, month: string, today: ISODate): Promise<MonthDay[]> {
  const { first, last } = monthRange(month);
  const [calFor, att, leaves] = await Promise.all([
    calendars(db, [who.location_id], [who.id], first, last),
    db.from('attendance').select('employee_id, date, check_in, check_out, is_wfh').eq('employee_id', who.id).gte('date', first).lte('date', last),
    db.from('leave_requests').select('employee_id, from_date, to_date, is_half_day, leave_types(code)')
      .eq('employee_id', who.id).eq('status', 'approved').lte('from_date', last).gte('to_date', first),
  ]);
  const cal = calFor(who);
  const punches = new Map<string, Punch>(((att.data ?? []) as AttRow[]).map((r) => [r.date, toPunch(r)]));
  const approved = ((leaves.data ?? []) as unknown as LeaveRow[]).map(toLeave);
  return eachDate(first, last).map((date) => {
    const result = deriveDayStatus({ date, cal, punch: punches.get(date), leave: approved.find((l) => date >= l.from && date <= l.to) ?? null });
    return { date, result, holidayName: cal.holidays.find((h) => h.date === date)?.name };
  });
}

export async function todayRecord(db: SupabaseClient, employeeId: string, today: ISODate) {
  const { data } = await db.from('attendance').select('check_in, check_out, is_wfh, is_late').eq('employee_id', employeeId).eq('date', today).maybeSingle();
  return data as { check_in: string | null; check_out: string | null; is_wfh: boolean; is_late: boolean } | null;
}

export interface TeamRow {
  id: string; name: string; code: string; designation: string;
  status: DayResult['status'] | 'Not yet in'; isLate: boolean; checkIn: string | null; checkOut: string | null; wfh: boolean;
}

/**
 * A6: who is present, on leave or absent today. Managers see direct reports (RLS enforces it); HR sees everyone.
 * A person who has not punched in yet today is "Not yet in", not Absent, until the day is over.
 */
export async function teamToday(db: SupabaseClient, scope: { managerId?: string }, today: ISODate): Promise<TeamRow[]> {
  let q = db.from('employees')
    .select('id, full_name, employee_code, designation, location_id, date_of_joining, last_working_day')
    .eq('status', 'active').order('full_name');
  if (scope.managerId) q = q.eq('reporting_manager_id', scope.managerId);
  const { data } = await q;
  const people = (data ?? []) as (Who & { full_name: string; employee_code: string; designation: string })[];
  if (people.length === 0) return [];

  const ids = people.map((p) => p.id);
  const [calFor, att, leaves] = await Promise.all([
    calendars(db, [...new Set(people.map((p) => p.location_id))], ids, today, today),
    db.from('attendance').select('employee_id, date, check_in, check_out, is_wfh').in('employee_id', ids).eq('date', today),
    db.from('leave_requests').select('employee_id, from_date, to_date, is_half_day, leave_types(code)')
      .in('employee_id', ids).eq('status', 'approved').lte('from_date', today).gte('to_date', today),
  ]);
  const attBy = new Map(((att.data ?? []) as AttRow[]).map((r) => [r.employee_id, r]));
  const leaveBy = new Map(((leaves.data ?? []) as unknown as LeaveRow[]).map((r) => [r.employee_id, toLeave(r)]));

  return people.map((p) => {
    const a = attBy.get(p.id);
    const r = deriveDayStatus({ date: today, cal: calFor(p), punch: a ? toPunch(a) : null, leave: leaveBy.get(p.id) ?? null });
    const notYetIn = r.status === 'Absent' && !a;
    return {
      id: p.id, name: p.full_name, code: p.employee_code, designation: p.designation,
      status: notYetIn ? 'Not yet in' : r.status, isLate: r.isLate, checkIn: a?.check_in ?? null, checkOut: a?.check_out ?? null, wfh: !!a?.is_wfh,
    };
  });
}

export { dayOfWeek };
