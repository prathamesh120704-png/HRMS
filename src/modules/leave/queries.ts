import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/lib/auth/session';
import type { Balance } from '@/lib/domain/balance';
import { balanceFor, type LeaveTypeInfo } from '@/lib/domain/leaveBalance';
import type { Holiday, WorkCalendar } from '@/lib/domain/types';
import type { ISODate } from '@/lib/time/ist';

export interface LeaveType extends LeaveTypeInfo {
  id: string;
  name: string;
  halfDayAllowed: boolean;
  certificateAfterDays: number | null;
  eligibleGender: 'any' | 'female' | 'male';
  countsCalendarDays: boolean;
}

interface TypeRow {
  id: string; code: string; name: string; annual_quota: number; accrual_method: LeaveType['accrualMethod'];
  half_day_allowed: boolean; requires_certificate_after_days: number | null;
  eligible_gender: LeaveType['eligibleGender']; counts_calendar_days: boolean;
}

/** Leave types this employee may use (gender-restricted types are hidden from everyone else). */
export async function leaveTypesFor(db: SupabaseClient, gender: string | null): Promise<LeaveType[]> {
  const { data } = await db.from('leave_types').select('*').order('code');
  return ((data ?? []) as TypeRow[])
    .filter((t) => t.eligible_gender === 'any' || t.eligible_gender === gender)
    .map((t) => ({
      id: t.id, code: t.code, name: t.name, annualQuota: Number(t.annual_quota), accrualMethod: t.accrual_method,
      halfDayAllowed: t.half_day_allowed, certificateAfterDays: t.requires_certificate_after_days === null ? null : Number(t.requires_certificate_after_days),
      eligibleGender: t.eligible_gender, countsCalendarDays: t.counts_calendar_days,
    }));
}

export interface TypeBalance { type: LeaveType; balance: Balance }

/**
 * L2: opening, accrued, used, pending and available per leave type. The formula is the single pure function
 * in src/lib/domain; this only gathers the inputs. The database's leave_available() is the enforcer at submit
 * time, so we cross-check it here and warn loudly if the two ever disagree.
 */
export async function balancesFor(db: SupabaseClient, e: Employee, year: number, asOf: ISODate): Promise<TypeBalance[]> {
  await db.rpc('ensure_balances', { p_emp: e.id, p_year: year });
  const [types, bal, reqs] = await Promise.all([
    leaveTypesFor(db, e.gender),
    db.from('leave_balances').select('leave_type_id, opening, adjustment').eq('employee_id', e.id).eq('year', year),
    db.from('leave_requests').select('leave_type_id, days, status, from_date').eq('employee_id', e.id)
      .in('status', ['approved', 'pending']).gte('from_date', `${year}-01-01`).lte('from_date', `${year}-12-31`),
  ]);
  const opening = new Map(((bal.data ?? []) as { leave_type_id: string; opening: number; adjustment: number }[])
    .map((b) => [b.leave_type_id, b]));
  const sums = new Map<string, { used: number; pending: number }>();
  for (const r of (reqs.data ?? []) as { leave_type_id: string; days: number; status: string }[]) {
    const s = sums.get(r.leave_type_id) ?? { used: 0, pending: 0 };
    if (r.status === 'approved') s.used += Number(r.days); else s.pending += Number(r.days);
    sums.set(r.leave_type_id, s);
  }

  const out: TypeBalance[] = [];
  for (const type of types) {
    const o = opening.get(type.id);
    const s = sums.get(type.id) ?? { used: 0, pending: 0 };
    const balance = balanceFor({
      type, joinDate: e.date_of_joining, year, asOf,
      opening: Number(o?.opening ?? 0), adjustment: Number(o?.adjustment ?? 0), used: s.used, pending: s.pending,
    });
    out.push({ type, balance });
    if (type.accrualMethod !== 'none') {
      const { data } = await db.rpc('leave_available', { p_emp: e.id, p_type: type.id, p_year: year, p_as_of: asOf });
      if (data !== null && Math.abs(Number(data) - balance.available) > 0.001) {
        console.warn(`PARITY MISMATCH ${type.code}: TypeScript ${balance.available} vs SQL ${data} for ${e.employee_code}`);
      }
    }
  }
  return out;
}

/** Compact balance cards for the dashboard (same numbers as My leave). */
export async function balanceCards(db: SupabaseClient, e: Employee, year: number, asOf: ISODate) {
  const all = await balancesFor(db, e, year, asOf);
  return all
    .filter((b) => ['CL', 'SL', 'EL'].includes(b.type.code))
    .map((b) => ({
      code: b.type.code, name: b.type.name, available: b.balance.available, quota: b.type.annualQuota,
      // What this person has been granted so far this year (opening + adjustment + accrued): the bar shows how much of it is left.
      granted: b.balance.opening + b.balance.adjustment + b.balance.accrued,
    }));
}

export interface LeaveRequestRow {
  id: string; request_group_id: string; from_date: string; to_date: string; is_half_day: boolean; days: number;
  reason: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; approver_comment: string | null;
  attachment_path: string | null; created_at: string; leave_types: { code: string; name: string } | null;
}

export async function myRequests(db: SupabaseClient, employeeId: string): Promise<LeaveRequestRow[]> {
  const { data } = await db
    .from('leave_requests')
    .select('id, request_group_id, from_date, to_date, is_half_day, days, reason, status, approver_comment, attachment_path, created_at, leave_types(code,name)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as LeaveRequestRow[];
}

/** Everything the Apply form needs to preview working days in the browser. All plain, serializable data. */
export async function applyContext(db: SupabaseClient, e: Employee, today: ISODate) {
  const year = Number(today.slice(0, 4));
  const [loc, hols, picks, live] = await Promise.all([
    db.from('locations').select('weekly_off_days').eq('id', e.location_id).single(),
    db.from('holidays').select('date, name, type').eq('location_id', e.location_id)
      .gte('date', `${year - 1}-12-01`).lte('date', `${year + 1}-12-31`),
    db.from('employee_optional_holidays').select('holidays(date)').eq('employee_id', e.id),
    db.from('leave_requests').select('from_date, to_date').eq('employee_id', e.id).in('status', ['pending', 'approved']),
  ]);
  const picked = ((picks.data ?? []) as unknown as { holidays: { date: string } | { date: string }[] | null }[])
    .map((p) => (Array.isArray(p.holidays) ? p.holidays[0]?.date : p.holidays?.date)).filter(Boolean) as string[];
  const cal: WorkCalendar = {
    weeklyOffDays: (loc.data?.weekly_off_days as number[]) ?? [0],
    holidays: (hols.data ?? []) as Holiday[],
    pickedOptional: picked,
  };
  const existing = ((live.data ?? []) as { from_date: string; to_date: string }[]).map((r) => ({ from: r.from_date, to: r.to_date }));
  return { cal, existing };
}

export async function optionalHolidays(db: SupabaseClient, e: Employee, year: number) {
  const [hols, picks] = await Promise.all([
    db.from('holidays').select('id, date, name').eq('location_id', e.location_id).eq('type', 'Optional')
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`).order('date'),
    db.from('employee_optional_holidays').select('holiday_id').eq('employee_id', e.id),
  ]);
  const picked = new Set(((picks.data ?? []) as { holiday_id: string }[]).map((p) => p.holiday_id));
  return ((hols.data ?? []) as { id: string; date: string; name: string }[]).map((h) => ({ ...h, picked: picked.has(h.id) }));
}
