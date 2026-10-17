import { diffDays, type ISODate } from '@/lib/time/ist';

export interface LeaveTypeRules {
  code: string;
  halfDayAllowed: boolean;
  /** SL: certificate required when days exceed this (R16). */
  certificateAfterDays?: number | null;
  eligibleGender: 'any' | 'female' | 'male';
}

export interface LiveRange { from: ISODate; to: ISODate }

export interface LeaveValidationInput {
  today: ISODate;
  from: ISODate;
  to: ISODate;
  isHalfDay: boolean;
  /** Days as counted by countWorkingDays. */
  days: number;
  type: LeaveTypeRules;
  gender?: string | null;
  hasCertificate: boolean;
  /** The employee's pending and approved requests. */
  existing: LiveRange[];
}

/** Returns human-readable errors; empty means the request may be submitted (balance is handled separately). */
export function validateLeaveRequest(i: LeaveValidationInput): string[] {
  const errors: string[] = [];
  if (i.to < i.from) errors.push('The end date cannot be before the start date.');
  if (diffDays(i.from, i.today) > 30) errors.push('Leave cannot be applied for dates more than 30 days in the past.');
  if (i.isHalfDay && !i.type.halfDayAllowed) errors.push('Half day is not allowed for this leave type.');
  if (i.isHalfDay && i.from !== i.to) errors.push('A half day must be a single date.');
  if (i.days <= 0) errors.push('The selected dates have no working days.');
  if (i.type.certificateAfterDays != null && i.days > i.type.certificateAfterDays && !i.hasCertificate) {
    errors.push(`${i.type.code} of more than ${i.type.certificateAfterDays} days needs a medical certificate.`);
  }
  if (i.type.eligibleGender !== 'any' && i.gender?.toLowerCase() !== i.type.eligibleGender) {
    errors.push('This leave type is not available for your profile.');
  }
  if (i.existing.some((r) => i.from <= r.to && r.from <= i.to)) {
    errors.push('You already have leave on some of these dates.');
  }
  return errors;
}
