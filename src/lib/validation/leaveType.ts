import { z } from 'zod';

/** The four accrual methods the rules engine and the database functions understand (RESEARCH.md R20). */
export const ACCRUAL_METHODS = ['upfront', 'monthly', 'on_request', 'none'] as const;
export type AccrualMethod = (typeof ACCRUAL_METHODS)[number];

export const ACCRUAL_LABEL: Record<AccrualMethod, string> = {
  upfront: 'Credited at the start of the year (pro-rated for joiners)',
  monthly: 'Earned each completed month',
  on_request: 'Granted on request (an entitlement per event)',
  none: 'No balance (unlimited, unpaid)',
};

const half = (what: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : v),
    z.number({ message: `Enter ${what} as a number.` })
      .min(0, `${what[0].toUpperCase()}${what.slice(1)} cannot be negative.`)
      .max(366, `${what[0].toUpperCase()}${what.slice(1)} cannot be more than 366.`)
      .refine((n) => Number.isFinite(n) && (n * 2) % 1 === 0, `${what[0].toUpperCase()}${what.slice(1)} must be in steps of 0.5 days.`),
  );

const fields = {
  name: z.string({ message: 'Give the leave type a name.' }).trim().min(3, 'Give the leave type a name (at least 3 letters).').max(60, 'Keep the name under 60 characters.'),
  annual_quota: half('the annual quota'),
  accrual_method: z.enum(ACCRUAL_METHODS, { message: 'Pick how this leave is earned.' }),
  carry_forward_max: half('the carry-forward limit'),
  half_day_allowed: z.boolean(),
};

/** Rules that depend on more than one field. They mirror the checks inside the database functions. */
function crossRules(v: { accrual_method?: string; annual_quota?: number; carry_forward_max?: number }, ctx: z.RefinementCtx) {
  if (v.accrual_method === 'none') {
    if ((v.annual_quota ?? 0) !== 0) ctx.addIssue({ code: 'custom', path: ['annual_quota'], message: 'A leave type with no accrual has no quota. Set it to 0 (or pick another accrual method).' });
    if ((v.carry_forward_max ?? 0) !== 0) ctx.addIssue({ code: 'custom', path: ['carry_forward_max'], message: 'A leave type with no accrual cannot carry leave forward. Set it to 0.' });
  }
  if (v.accrual_method === 'on_request' && (v.carry_forward_max ?? 0) !== 0) {
    ctx.addIssue({ code: 'custom', path: ['carry_forward_max'], message: 'Leave granted on request cannot carry forward. Set it to 0.' });
  }
}

export const leaveTypeSchema = z.object({
  code: z.string({ message: 'Enter a code.' }).trim().toUpperCase().regex(/^[A-Z]{2,6}$/, 'Code must be 2 to 6 capital letters, for example CL.'),
  ...fields,
}).superRefine(crossRules);

/** Editing: the code is fixed for life (it appears in history and reports), so it is not part of the form. */
export const leaveTypeEditSchema = z.object({
  id: z.string({ message: 'Missing leave type.' }).uuid('Missing leave type.'),
  ...fields,
}).superRefine(crossRules);
