'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireEmployee } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { istInstant } from '@/lib/time/ist';
import { toErrors, type ActionState } from '@/modules/employees/schema';

/** A1/A3: one click. The database takes "now" from its own clock and converts to the IST date; the browser's time is never used. */
export async function checkInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireEmployee();
  const { error } = await s.db.rpc('check_in', { p_wfh: fd.get('wfh') === '1' });
  if (error) return { message: friendlyDbError(error) };
  revalidatePath('/dashboard');
  revalidatePath('/attendance');
  return { ok: true };
}

export async function checkOutAction(_prev: ActionState): Promise<ActionState> {
  const s = await requireEmployee();
  const { error } = await s.db.rpc('check_out');
  if (error) return { message: friendlyDbError(error) };
  revalidatePath('/dashboard');
  revalidatePath('/attendance');
  return { ok: true };
}

const time = z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time like 09:30.');
const regSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the date to correct.'),
  requested_in: time,
  requested_out: time,
  reason: z.string().trim().min(3, 'Give a short reason.'),
}).refine((v) => v.requested_out > v.requested_in, { path: ['requested_out'], message: 'Out time must be later than in time.' });

/** A5: the request is only a request. Attendance changes after a manager approves it. */
export async function submitRegularisationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireEmployee();
  const parsed = regSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: toErrors(parsed.error), message: 'Please fix the highlighted fields.' };
  const v = parsed.data;
  const { error } = await s.db.rpc('submit_regularisation', {
    p_date: v.date,
    p_in: istInstant(v.date, v.requested_in).toISOString(),
    p_out: istInstant(v.date, v.requested_out).toISOString(),
    p_reason: v.reason,
  });
  if (error) {
    if (error.code === '23505') return { message: 'You already have a pending correction request for that date.' };
    return { message: friendlyDbError(error) };
  }
  revalidatePath('/attendance');
  return { ok: true, message: 'Request sent to your manager. Your attendance changes only after they approve.' };
}
