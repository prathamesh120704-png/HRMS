'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireHr } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { toErrors, type ActionState } from '@/modules/employees/schema';

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
