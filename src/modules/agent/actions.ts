'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireEmployee } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { flushEmailsSafely } from '@/lib/email/send';

export interface DraftResult { ok: boolean; message: string }

const leavePayload = z.object({
  type_code: z.string(), from_date: z.string(), to_date: z.string(), is_half_day: z.boolean(), reason: z.string(), convert_lop: z.boolean(),
});

/**
 * The ONLY way a drafted action happens: the person presses Confirm. A leave draft goes through the same
 * submit_leave database function as the Apply screen (so every rule and the balance lock apply). The model has no
 * way to call this; it is a server action bound to a button the user clicks.
 */
export async function confirmDraftAction(draftId: string): Promise<DraftResult> {
  const s = await requireEmployee();
  if (!z.string().uuid().safeParse(draftId).success) return { ok: false, message: 'Draft not found.' };
  const { data: d } = await s.db.from('agent_drafts').select('id, kind, payload, status').eq('id', draftId).maybeSingle();
  if (!d || d.status !== 'draft') return { ok: false, message: 'This draft was already handled.' };

  if (d.kind === 'leave_request') {
    const p = leavePayload.safeParse(d.payload);
    if (!p.success) return { ok: false, message: 'The draft is not valid any more.' };
    const v = p.data;
    const { error } = await s.db.rpc('submit_leave', {
      p_type_code: v.type_code, p_from: v.from_date, p_to: v.to_date, p_half: v.is_half_day, p_reason: v.reason,
      p_attachment_path: null, p_convert_excess_to_lop: v.convert_lop,
    });
    if (error) return { ok: false, message: friendlyDbError(error) === 'Something went wrong. Please try again.' ? error.message : friendlyDbError(error) };
    await s.db.rpc('set_agent_draft_status', { p_id: draftId, p_status: 'confirmed' });
    await flushEmailsSafely();
    revalidatePath('/leave');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Submitted. Your manager has been notified. See My leave.' };
  }

  if (d.kind === 'reminder_email') {
    if (!s.isHr) return { ok: false, message: 'Only HR can send reminders.' };
    const { data: n, error } = await s.db.rpc('hr_queue_reminders', { p_draft: draftId });
    if (error) return { ok: false, message: friendlyDbError(error) };
    await flushEmailsSafely();
    return { ok: true, message: `Reminder queued for ${n} employee(s).` };
  }
  return { ok: false, message: 'Unknown draft.' };
}

export async function discardDraftAction(draftId: string): Promise<DraftResult> {
  const s = await requireEmployee();
  if (!z.string().uuid().safeParse(draftId).success) return { ok: false, message: 'Draft not found.' };
  const { error } = await s.db.rpc('set_agent_draft_status', { p_id: draftId, p_status: 'discarded' });
  return error ? { ok: false, message: 'Could not discard this draft.' } : { ok: true, message: 'Draft discarded.' };
}
