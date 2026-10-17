'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireEmployee, requireHr } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { wouldCreateLoop } from '@/lib/domain/reportingChain';
import {
  contactSchema, deactivateSchema, echoValues, employeeCreateSchema, employeeUpdateSchema, formToObject, toErrors,
  type ActionState,
} from './schema';
import { managerMap } from './queries';

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** E1: HR adds an employee. Code, opening balances and audit rows are created in the database. */
export async function createEmployeeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const parsed = employeeCreateSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { errors: toErrors(parsed.error), values: echoValues(fd), message: 'Please fix the highlighted fields.' };
  }
  const { data, error } = await s.db.rpc('hr_create_employee', { p: clean(parsed.data) });
  if (error) return { message: friendlyDbError(error), values: echoValues(fd) };
  revalidatePath('/employees');
  redirect(`/employees/${(data as { id: string }).id}?created=1`);
}

/** E3/E4/E8: HR edits job fields; blank statutory/bank inputs keep the current value. */
export async function updateEmployeeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const id = String(fd.get('employee_id') ?? '');
  const parsed = employeeUpdateSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { errors: toErrors(parsed.error), values: echoValues(fd), message: 'Please fix the highlighted fields.' };
  }
  const v = parsed.data;
  if (v.reporting_manager_id) {
    // Friendly pre-check; the database trigger enforces the same rule.
    const map = await managerMap(s.db);
    if (wouldCreateLoop(id, v.reporting_manager_id, map)) {
      return {
        errors: { reporting_manager_id: 'That would create a reporting loop: this person already manages the selected manager (directly or indirectly).' },
        values: echoValues(fd), message: 'Please fix the highlighted fields.',
      };
    }
  }
  const patch = clean({ ...v, reporting_manager_id: v.reporting_manager_id ?? '' });
  const { error } = await s.db.rpc('hr_update_employee', { p_id: id, p: patch });
  if (error) return { message: friendlyDbError(error), values: echoValues(fd) };
  revalidatePath(`/employees/${id}`);
  revalidatePath('/employees');
  return { ok: true, message: 'Saved. Changes to job and statutory fields are recorded in the history.' };
}

/** E5: employees edit only their own contact details. The function reads the caller from the token. */
export async function updateMyContactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireEmployee();
  const parsed = contactSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { errors: toErrors(parsed.error), values: echoValues(fd), message: 'Please fix the highlighted fields.' };
  }
  const v = parsed.data;
  const { error } = await s.db.rpc('update_my_contact', {
    p_mobile: v.mobile, p_address_line: v.address_line ?? null, p_city: v.city ?? null, p_state: v.state ?? null,
    p_pin: v.pin ?? null, p_emergency_name: v.emergency_name ?? null, p_emergency_relation: v.emergency_relation ?? null,
    p_emergency_phone: v.emergency_phone ?? null,
  });
  if (error) return { message: friendlyDbError(error), values: echoValues(fd) };
  revalidatePath('/profile');
  return { ok: true, message: 'Your contact details were updated.' };
}

/** E6: HR sets the last working day. The record is never deleted. */
export async function deactivateEmployeeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const parsed = deactivateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: toErrors(parsed.error), message: 'Enter the last working day.' };
  const { error } = await s.db.rpc('hr_deactivate_employee', {
    p_id: parsed.data.employee_id, p_last_working_day: parsed.data.last_working_day,
  });
  if (error) return { message: friendlyDbError(error) };
  revalidatePath(`/employees/${parsed.data.employee_id}`);
  revalidatePath('/employees');
  return { ok: true, message: `Last working day set to ${parsed.data.last_working_day}. They can no longer sign in after that date.` };
}

/** HR Reveal (PAN or bank account only; Aadhaar can never be revealed). The database logs every reveal. */
export async function revealAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const employeeId = String(fd.get('employee_id') ?? '');
  const field = String(fd.get('field') ?? '');
  if (field !== 'pan' && field !== 'account_number') return { message: 'This field cannot be revealed.' };
  const { data, error } = await s.db.rpc('hr_reveal', { p_employee: employeeId, p_field: field });
  if (error) return { message: friendlyDbError(error) };
  return { ok: true, revealed: String(data), message: 'Revealed once. This action was logged.' };
}
