import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/lib/auth/session';
import { clashes, type LeaveSpan } from '@/lib/domain/clash';
import type { ISODate } from '@/lib/time/ist';
import { balancesFor } from '@/modules/leave/queries';

interface Emp { id: string; full_name: string; employee_code: string; gender: string | null; date_of_joining: string; reporting_manager_id: string | null; location_id: string }

interface PendingRow {
  id: string; request_group_id: string; employee_id: string; from_date: string; to_date: string; is_half_day: boolean;
  days: number; reason: string; attachment_path: string | null; created_at: string;
  leave_types: { code: string; name: string } | null; employee: Emp | null;
}

export interface LeaveApproval {
  group: string;
  employee: { id: string; name: string; code: string };
  parts: { code: string; name: string; days: number; from: ISODate; to: ISODate; half: boolean }[];
  from: ISODate; to: ISODate; totalDays: number; reason: string; certificate: string | null; submittedAt: string;
  /** Balance of the (non-LOP) type before this request and after approval; null for pure LOP. */
  balance: { code: string; before: number; after: number } | null;
  clashWith: string[];
  isTeamManager: boolean;
}

/**
 * Pending leave the signed-in person may decide. RLS already limits the rows (a manager sees direct reports, HR
 * sees everyone); we additionally drop the person's own requests, because nobody decides their own leave (R34).
 */
export async function pendingLeave(db: SupabaseClient, me: Employee, today: ISODate): Promise<LeaveApproval[]> {
  const { data } = await db
    .from('leave_requests')
    .select('id, request_group_id, employee_id, from_date, to_date, is_half_day, days, reason, attachment_path, created_at, leave_types(code,name), employee:employees!employee_id(id, full_name, employee_code, gender, date_of_joining, reporting_manager_id, location_id)')
    .eq('status', 'pending')
    .neq('employee_id', me.id)
    .order('created_at');
  const rows = (data ?? []) as unknown as PendingRow[];
  if (rows.length === 0) return [];

  // Everyone's live leave in the window, to warn about clashes within the same team.
  const minFrom = rows.reduce((m, r) => (r.from_date < m ? r.from_date : m), rows[0].from_date);
  const maxTo = rows.reduce((m, r) => (r.to_date > m ? r.to_date : m), rows[0].to_date);
  const { data: live } = await db
    .from('leave_requests')
    .select('employee_id, from_date, to_date, employee:employees!employee_id(full_name, reporting_manager_id)')
    .in('status', ['pending', 'approved']).lte('from_date', maxTo).gte('to_date', minFrom);
  const liveRows = (live ?? []) as unknown as { employee_id: string; from_date: string; to_date: string; employee: { full_name: string; reporting_manager_id: string | null } | null }[];

  const year = Number(today.slice(0, 4));
  const balanceCache = new Map<string, Awaited<ReturnType<typeof balancesFor>>>();
  const groups = new Map<string, PendingRow[]>();
  for (const r of rows) groups.set(r.request_group_id, [...(groups.get(r.request_group_id) ?? []), r]);

  const out: LeaveApproval[] = [];
  for (const [group, parts] of groups) {
    const first = parts[0];
    const emp = first.employee;
    if (!emp) continue;
    const from = parts.reduce((m, r) => (r.from_date < m ? r.from_date : m), parts[0].from_date);
    const to = parts.reduce((m, r) => (r.to_date > m ? r.to_date : m), parts[0].to_date);

    const main = parts.find((p) => p.leave_types?.code !== 'LOP');
    let balance: LeaveApproval['balance'] = null;
    if (main?.leave_types) {
      if (!balanceCache.has(emp.id)) {
        balanceCache.set(emp.id, await balancesFor(db, { ...(emp as unknown as Employee) }, year, today));
      }
      const b = balanceCache.get(emp.id)!.find((x) => x.type.code === main.leave_types!.code);
      // Pending days are already reserved, so approving does not change `available`: it moves pending -> used.
      if (b) balance = { code: b.type.code, before: b.balance.available + Number(main.days), after: b.balance.available };
    }

    const teamLeave: LeaveSpan[] = liveRows
      .filter((l) => l.employee?.reporting_manager_id === emp.reporting_manager_id)
      .map((l) => ({ employeeId: l.employee_id, name: l.employee?.full_name ?? '', from: l.from_date, to: l.to_date }));

    out.push({
      group,
      employee: { id: emp.id, name: emp.full_name, code: emp.employee_code },
      parts: parts.map((p) => ({ code: p.leave_types?.code ?? '', name: p.leave_types?.name ?? '', days: Number(p.days), from: p.from_date, to: p.to_date, half: p.is_half_day })),
      from, to, totalDays: parts.reduce((t, p) => t + Number(p.days), 0), reason: first.reason,
      certificate: parts.find((p) => p.attachment_path)?.attachment_path ?? null, submittedAt: first.created_at,
      balance, clashWith: clashes({ employeeId: emp.id, from, to }, teamLeave), isTeamManager: emp.reporting_manager_id === me.id,
    });
  }
  return out;
}

export interface RegularisationApproval {
  id: string; employee: { name: string; code: string }; date: ISODate;
  recordedIn: string | null; recordedOut: string | null; requestedIn: string | null; requestedOut: string | null; reason: string;
}

export async function pendingRegularisations(db: SupabaseClient, me: Employee): Promise<RegularisationApproval[]> {
  const { data } = await db
    .from('regularisation_requests')
    .select('id, date, requested_in, requested_out, reason, employee_id, employee:employees!employee_id(full_name, employee_code)')
    .eq('status', 'pending').neq('employee_id', me.id).order('created_at');
  const rows = (data ?? []) as unknown as { id: string; date: string; requested_in: string | null; requested_out: string | null; reason: string; employee_id: string; employee: { full_name: string; employee_code: string } | null }[];
  if (rows.length === 0) return [];
  const { data: att } = await db.from('attendance').select('employee_id, date, check_in, check_out')
    .in('employee_id', rows.map((r) => r.employee_id)).in('date', rows.map((r) => r.date));
  const rec = new Map(((att ?? []) as { employee_id: string; date: string; check_in: string | null; check_out: string | null }[]).map((a) => [`${a.employee_id}|${a.date}`, a]));
  return rows.map((r) => {
    const a = rec.get(`${r.employee_id}|${r.date}`);
    return {
      id: r.id, employee: { name: r.employee?.full_name ?? '', code: r.employee?.employee_code ?? '' }, date: r.date,
      recordedIn: a?.check_in ?? null, recordedOut: a?.check_out ?? null, requestedIn: r.requested_in, requestedOut: r.requested_out, reason: r.reason,
    };
  });
}

/** Team leave for the month calendar (L7): approved and pending, with the person's name. */
export async function teamLeaveInMonth(db: SupabaseClient, first: ISODate, last: ISODate) {
  const { data } = await db
    .from('leave_requests')
    .select('employee_id, from_date, to_date, status, is_half_day, leave_types(code), employee:employees!employee_id(full_name)')
    .in('status', ['pending', 'approved']).lte('from_date', last).gte('to_date', first);
  return ((data ?? []) as unknown as { employee_id: string; from_date: string; to_date: string; status: 'pending' | 'approved'; is_half_day: boolean; leave_types: { code: string } | { code: string }[] | null; employee: { full_name: string } | { full_name: string }[] | null }[])
    .map((r) => ({
      employeeId: r.employee_id, from: r.from_date, to: r.to_date, status: r.status, half: r.is_half_day,
      code: (Array.isArray(r.leave_types) ? r.leave_types[0] : r.leave_types)?.code ?? '',
      name: (Array.isArray(r.employee) ? r.employee[0] : r.employee)?.full_name ?? '',
    }));
}
