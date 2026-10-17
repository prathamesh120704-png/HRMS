import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/lib/auth/session';
import { maskAadhaar, maskAccount, maskPAN } from '@/lib/mask';

export interface Option { value: string; label: string }

export async function referenceData(db: SupabaseClient) {
  const [depts, locs] = await Promise.all([
    db.from('departments').select('id,name').order('name'),
    db.from('locations').select('id,name,city,weekly_off_days').order('name'),
  ]);
  return {
    departments: (depts.data ?? []) as { id: string; name: string }[],
    locations: (locs.data ?? []) as { id: string; name: string; city: string; weekly_off_days: number[] }[],
  };
}

export interface DirectoryRow {
  id: string; employee_code: string; full_name: string; designation: string; status: string;
  department: { name: string } | null; location: { name: string } | null;
}

export async function listEmployees(db: SupabaseClient, f: { q?: string; dept?: string; loc?: string; status?: string }) {
  let q = db
    .from('employees')
    .select('id, employee_code, full_name, designation, status, department:departments(name), location:locations(name)')
    .order('employee_code')
    .limit(300);
  if (f.status === 'active' || f.status === 'inactive') q = q.eq('status', f.status);
  if (f.dept) q = q.eq('department_id', f.dept);
  if (f.loc) q = q.eq('location_id', f.loc);
  if (f.q) {
    // Strip characters that have meaning in PostgREST filter syntax before building the pattern.
    const term = f.q.replace(/[%,()*\\]/g, ' ').trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,employee_code.ilike.%${term}%`);
  }
  const { data } = await q;
  return (data ?? []) as unknown as DirectoryRow[];
}

export interface EmployeeDetail extends Employee {
  department: { name: string } | null;
  location: { name: string; city: string } | null;
  manager: { full_name: string; employee_code: string } | null;
}

/** RLS returns nothing for anyone who may not read this employee, so null means "not found". */
export async function getEmployeeDetail(db: SupabaseClient, id: string): Promise<EmployeeDetail | null> {
  const { data } = await db
    .from('employees')
    .select('*, department:departments(name), location:locations(name,city), manager:employees!reporting_manager_id(full_name,employee_code)')
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as EmployeeDetail) ?? null;
}

export interface MaskedSensitive {
  pan: string | null; aadhaar: string | null; uan: string | null;
  account: string | null; ifsc: string | null; bank_name: string | null;
}

/** Raw PAN/Aadhaar/account values are masked here and never leave this function (E7). */
export async function getMaskedSensitive(db: SupabaseClient, id: string): Promise<MaskedSensitive> {
  const [st, bk] = await Promise.all([
    db.from('employee_statutory').select('pan,aadhaar,uan').eq('employee_id', id).maybeSingle(),
    db.from('employee_bank').select('account_number,ifsc,bank_name').eq('employee_id', id).maybeSingle(),
  ]);
  return {
    pan: st.data?.pan ? maskPAN(st.data.pan) : null,
    aadhaar: st.data?.aadhaar ? maskAadhaar(st.data.aadhaar) : null,
    uan: st.data?.uan ?? null,
    account: bk.data?.account_number ? maskAccount(bk.data.account_number) : null,
    ifsc: bk.data?.ifsc ?? null,
    bank_name: bk.data?.bank_name ?? null,
  };
}

export async function managerOptions(db: SupabaseClient, excludeId?: string): Promise<Option[]> {
  const { data } = await db.from('employees').select('id, full_name, employee_code').eq('status', 'active').order('full_name');
  return (data ?? [])
    .filter((e: { id: string }) => e.id !== excludeId)
    .map((e: { id: string; full_name: string; employee_code: string }) => ({ value: e.id, label: `${e.full_name} (${e.employee_code})` }));
}

export async function managerMap(db: SupabaseClient): Promise<Map<string, string | null>> {
  const { data } = await db.from('employees').select('id, reporting_manager_id');
  return new Map((data ?? []).map((e: { id: string; reporting_manager_id: string | null }) => [e.id, e.reporting_manager_id]));
}

export async function auditFor(db: SupabaseClient, id: string) {
  const { data } = await db
    .from('audit_log')
    .select('id, field, old_value, new_value, action, changed_at, changed_by, actor:employees!changed_by(full_name)')
    .eq('record_id', id)
    .order('changed_at', { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as {
    id: number; field: string; old_value: string | null; new_value: string | null; action: string;
    changed_at: string; actor: { full_name: string } | null;
  }[];
}
