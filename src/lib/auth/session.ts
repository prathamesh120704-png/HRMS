import 'server-only';
import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { userClient } from '@/lib/supabase/userClient';

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  mobile: string;
  dob: string;
  gender: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pin: string | null;
  date_of_joining: string;
  last_working_day: string | null;
  designation: string;
  department_id: string;
  location_id: string;
  reporting_manager_id: string | null;
  salary_grade: string | null;
  is_hr_admin: boolean;
  status: 'active' | 'inactive';
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
}

export interface Session {
  employee: Employee;
  db: SupabaseClient;
  isHr: boolean;
  /** Derived: appears as reporting_manager_id for at least one active employee (never stored). */
  isManager: boolean;
}

/**
 * Check point (1) in ARCHITECTURE.md: Clerk user -> employees row -> role from the DATABASE.
 * Returns null when the user is signed out, not linked to an employee, inactive, or past the last working day.
 * Clerk is never trusted for authorization; this runs on every request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const db = userClient(() => getToken());

  const link = await db.rpc('link_clerk_user');
  if (link.error || !link.data) return null;

  const { data: employee } = await db.from('employees').select('*').eq('id', link.data as string).maybeSingle();
  // RLS hides the row from an inactive employee (current_employee_id() is null), so this is the "deactivated" check.
  if (!employee || employee.status !== 'active') return null;

  const { count } = await db
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('reporting_manager_id', employee.id)
    .eq('status', 'active');

  return { employee: employee as Employee, db, isHr: employee.is_hr_admin, isManager: (count ?? 0) > 0 };
});

export async function requireEmployee(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/access-denied');
  return s;
}

/** (2) HR Admin only. Non-HR users are sent to the dashboard. */
export async function requireHr(): Promise<Session> {
  const s = await requireEmployee();
  if (!s.isHr) redirect('/dashboard');
  return s;
}

/** Managers (derived) and HR. */
export async function requireManagerOrHr(): Promise<Session> {
  const s = await requireEmployee();
  if (!s.isHr && !s.isManager) redirect('/dashboard');
  return s;
}
