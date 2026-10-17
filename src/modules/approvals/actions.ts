'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireManagerOrHr } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/dbErrors';
import { flushEmailsSafely } from '@/lib/email/send';
import { toErrors, type ActionState } from '@/modules/employees/schema';

const decisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
  comment: z.string().trim().max(500).optional(),
}).refine((v) => v.decision === 'approve' || (v.comment && v.comment.length > 0), {
  path: ['comment'], message: 'A comment is required when rejecting.',
});

function parse(fd: FormData) {
  return decisionSchema.safeParse({ id: fd.get('id'), decision: fd.get('decision'), comment: String(fd.get('comment') ?? '') });
}

/**
 * L4: approve or reject. The database function re-checks that the caller is the employee's manager or HR and is not
 * the requester, that the request is still pending, and writes the decision in one transaction. The balance changes
 * ONLY here: pending days (already reserved) become used.
 */
export async function decideLeaveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireManagerOrHr();
  const p = parse(fd);
  if (!p.success) return { errors: toErrors(p.error), message: 'Please fix the highlighted fields.' };
  const { error } = await s.db.rpc('decide_leave', { p_group: p.data.id, p_approve: p.data.decision === 'approve', p_comment: p.data.comment ?? null });
  if (error) return { message: friendlyDbError(error) === 'Something went wrong. Please try again.' ? error.message : friendlyDbError(error) };
  await flushEmailsSafely(); // employee is emailed the decision
  revalidatePath('/approvals');
  revalidatePath('/dashboard');
  redirect(`/approvals?done=${p.data.decision === 'approve' ? 'approved' : 'rejected'}`);
}

/** A5: approving a correction is the only way attendance changes. */
export async function decideRegularisationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireManagerOrHr();
  const p = parse(fd);
  if (!p.success) return { errors: toErrors(p.error), message: 'Please fix the highlighted fields.' };
  const { error } = await s.db.rpc('decide_regularisation', { p_id: p.data.id, p_approve: p.data.decision === 'approve', p_comment: p.data.comment ?? null });
  if (error) return { message: friendlyDbError(error) === 'Something went wrong. Please try again.' ? error.message : friendlyDbError(error) };
  await flushEmailsSafely();
  revalidatePath('/approvals');
  revalidatePath('/attendance');
  redirect(`/approvals?tab=regularisation&done=${p.data.decision === 'approve' ? 'approved' : 'rejected'}`);
}
