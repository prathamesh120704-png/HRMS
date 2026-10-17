'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireEmployee } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { toErrors, type ActionState } from '@/modules/employees/schema';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const applySchema = z.object({
  type_code: z.string().min(1, 'Pick a leave type.'),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the first day.'),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the last day.'),
  is_half_day: z.boolean(),
  reason: z.string().trim().min(3, 'Give a short reason.'),
  convert_lop: z.boolean(),
});

/**
 * L3: apply for leave. The browser preview is a convenience only: the database function `submit_leave` recounts
 * the working days, re-checks the balance under a lock and enforces every rule, so a tampered form cannot cheat.
 */
export async function submitLeaveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireEmployee();
  const parsed = applySchema.safeParse({
    type_code: fd.get('type_code'), from_date: fd.get('from_date'), to_date: fd.get('to_date'),
    is_half_day: fd.get('is_half_day') === 'on', reason: fd.get('reason'), convert_lop: fd.get('convert_lop') === 'on',
  });
  if (!parsed.success) return { errors: toErrors(parsed.error), message: 'Please fix the highlighted fields.' };
  const v = parsed.data;

  // Optional medical certificate (needed for SL over 2 days; the database decides whether it is required).
  let attachmentPath: string | null = null;
  const file = fd.get('certificate');
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.has(file.type)) return { errors: { certificate: 'Upload a PDF, JPG or PNG file.' }, message: 'Please fix the highlighted fields.' };
    if (file.size > MAX_BYTES) return { errors: { certificate: 'The file must be 2 MB or smaller.' }, message: 'Please fix the highlighted fields.' };
    // Path begins with the employee id: the storage policy only lets you write into your own folder.
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
    attachmentPath = `${s.employee.id}/${randomUUID()}/${safe}`;
    const up = await s.db.storage.from('leave-certificates').upload(attachmentPath, file, { contentType: file.type, upsert: false });
    if (up.error) return { message: 'Could not upload the certificate. Please try again.' };
  }

  const { error } = await s.db.rpc('submit_leave', {
    p_type_code: v.type_code, p_from: v.from_date, p_to: v.to_date, p_half: v.is_half_day, p_reason: v.reason,
    p_attachment_path: attachmentPath, p_convert_excess_to_lop: v.convert_lop,
  });
  if (error) {
    if (attachmentPath) await s.db.storage.from('leave-certificates').remove([attachmentPath]);
    return { message: friendlyDbError(error) === 'Something went wrong. Please try again.' ? error.message : friendlyDbError(error) };
  }
  revalidatePath('/leave');
  revalidatePath('/dashboard');
  redirect('/leave?submitted=1');
}

/** L5: cancel pending leave, or approved leave that has not started. Cancels the whole request (all linked rows). */
export async function cancelLeaveAction(fd: FormData): Promise<void> {
  const s = await requireEmployee();
  const group = z.string().uuid().safeParse(fd.get('group'));
  if (!group.success) return;
  const { error } = await s.db.rpc('cancel_leave', { p_group: group.data });
  revalidatePath('/leave');
  revalidatePath('/dashboard');
  redirect(error ? `/leave?error=${encodeURIComponent(friendlyDbError(error))}` : '/leave?cancelled=1');
}

/** R31: pick or drop an Optional holiday (max 2 a year, enforced by the database). */
export async function toggleOptionalHolidayAction(fd: FormData): Promise<void> {
  const s = await requireEmployee();
  const id = z.string().uuid().safeParse(fd.get('holiday'));
  if (!id.success) return;
  const { error } = await s.db.rpc(fd.get('pick') === '1' ? 'pick_optional_holiday' : 'unpick_optional_holiday', { p_holiday: id.data });
  revalidatePath('/leave');
  redirect(error ? `/leave?error=${encodeURIComponent(error.message)}` : '/leave');
}
