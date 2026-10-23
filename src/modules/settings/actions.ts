'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireHr } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { leaveTypeEditSchema, leaveTypeSchema } from '@/lib/validation/leaveType';
import { echoValues, toErrors, type ActionState } from '@/modules/employees/schema';

const holidaySchema = z.object({
  location_id: z.string().uuid('Pick a location.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  name: z.string().trim().min(2, 'Give the holiday a name.'),
  type: z.enum(['National', 'State', 'Optional'], { message: 'Pick a holiday type.' }),
});

/** A7: HR adds a holiday for ONE location. Holidays never leak across locations. */
export async function addHolidayAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const parsed = holidaySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: toErrors(parsed.error), message: 'Please fix the highlighted fields.' };
  const v = parsed.data;
  const { error } = await s.db.rpc('hr_add_holiday', { p_location: v.location_id, p_date: v.date, p_name: v.name, p_type: v.type });
  if (error) return { message: friendlyDbError(error) };
  revalidatePath('/settings');
  return { ok: true, message: `Added ${v.name} on ${v.date}.` };
}

export async function deleteHolidayAction(fd: FormData): Promise<void> {
  const s = await requireHr();
  const id = z.string().uuid().safeParse(fd.get('id'));
  if (!id.success) return;
  await s.db.rpc('hr_delete_holiday', { p_id: id.data });
  revalidatePath('/settings');
}

/** Same fields the form posts, as an object the schema can read (the checkbox is "on" or absent). */
function leaveTypeInput(fd: FormData) {
  return {
    id: fd.get('id'), code: fd.get('code'), name: fd.get('name'), annual_quota: fd.get('annual_quota'),
    accrual_method: fd.get('accrual_method'), carry_forward_max: fd.get('carry_forward_max'), half_day_allowed: fd.get('half_day_allowed') === 'on',
  };
}

function refreshLeavePages() {
  for (const path of ['/settings', '/leave', '/leave/apply', '/dashboard']) revalidatePath(path);
}

/** L1: HR changes a leave type. Balances are calculated live, so this takes effect for everyone straight away. */
export async function updateLeaveTypeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const parsed = leaveTypeEditSchema.safeParse(leaveTypeInput(fd));
  if (!parsed.success) return { errors: toErrors(parsed.error), values: echoValues(fd), message: 'Please fix the highlighted fields.' };
  const v = parsed.data;
  const { error } = await s.db.rpc('hr_update_leave_type', {
    p_id: v.id, p_name: v.name, p_annual_quota: v.annual_quota, p_accrual_method: v.accrual_method,
    p_carry_forward_max: v.carry_forward_max, p_half_day_allowed: v.half_day_allowed,
  });
  if (error) return { message: friendlyDbError(error), values: echoValues(fd) };
  refreshLeavePages();
  return { ok: true, message: 'Saved. Everyone\'s balances use the new rule from now on. The change is recorded in the audit log.' };
}

/** L1: HR adds a new leave type. Types are never deleted, because old requests and reports refer to them. */
export async function addLeaveTypeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireHr();
  const parsed = leaveTypeSchema.safeParse(leaveTypeInput(fd));
  if (!parsed.success) return { errors: toErrors(parsed.error), values: echoValues(fd), message: 'Please fix the highlighted fields.' };
  const v = parsed.data;
  const { error } = await s.db.rpc('hr_add_leave_type', {
    p_code: v.code, p_name: v.name, p_annual_quota: v.annual_quota, p_accrual_method: v.accrual_method,
    p_carry_forward_max: v.carry_forward_max, p_half_day_allowed: v.half_day_allowed,
  });
  if (error) {
    if (error.code === '23505') return { errors: { code: 'A leave type with this code already exists.' }, values: echoValues(fd), message: 'Please fix the highlighted fields.' };
    return { message: friendlyDbError(error), values: echoValues(fd) };
  }
  refreshLeavePages();
  return { ok: true, message: `Added ${v.code}. Employees can now apply for it.` };
}
