import { describe, expect, it } from 'vitest';
import { countWorkingDays, nextWorkingDay } from '@/lib/domain/workingDays';
import { accruedMonthly, carryForward, proratedQuota } from '@/lib/domain/accrual';
import { computeBalance, splitForLop } from '@/lib/domain/balance';
import { validateLeaveRequest, type LeaveTypeRules } from '@/lib/domain/leaveRules';
import type { WorkCalendar } from '@/lib/domain/types';

const panaji: WorkCalendar = { weeklyOffDays: [0, 6], holidays: [] };
const verna: WorkCalendar = { weeklyOffDays: [0], holidays: [] };

describe('working-day count (R17, R18)', () => {
  it('Friday to Monday at head office counts 2 days, not 4', () => {
    const r = countWorkingDays({ from: '2026-10-23', to: '2026-10-26', cal: panaji });
    expect(r.days).toBe(2);
    expect(r.excluded.map((e) => e.reason)).toEqual(['weekly_off', 'weekly_off']);
  });

  it('Saturday is a working day at the plant', () => {
    expect(countWorkingDays({ from: '2026-10-23', to: '2026-10-26', cal: verna }).days).toBe(3);
  });

  it('a holiday inside the range is not counted, and a holiday for another location does not apply', () => {
    const withHoliday: WorkCalendar = { ...verna, holidays: [{ date: '2026-10-26', name: 'Local', type: 'State' }] };
    expect(countWorkingDays({ from: '2026-10-23', to: '2026-10-26', cal: withHoliday }).days).toBe(2);
    expect(countWorkingDays({ from: '2026-10-23', to: '2026-10-26', cal: panaji }).days).toBe(2);
  });

  it('an unpicked Optional holiday is a working day; a picked one is not (R31)', () => {
    const h = [{ date: '2026-10-22', name: 'Optional', type: 'Optional' as const }];
    expect(countWorkingDays({ from: '2026-10-22', to: '2026-10-22', cal: { ...panaji, holidays: h } }).days).toBe(1);
    expect(
      countWorkingDays({ from: '2026-10-22', to: '2026-10-22', cal: { ...panaji, holidays: h, pickedOptional: ['2026-10-22'] } }).days,
    ).toBe(0);
  });

  it('half day counts 0.5 on a working day and 0 on a weekly off', () => {
    expect(countWorkingDays({ from: '2026-10-23', to: '2026-10-23', isHalfDay: true, cal: panaji }).days).toBe(0.5);
    expect(countWorkingDays({ from: '2026-10-24', to: '2026-10-24', isHalfDay: true, cal: panaji }).days).toBe(0);
  });

  it('Maternity/Paternity count calendar days (R30)', () => {
    expect(countWorkingDays({ from: '2026-10-23', to: '2026-10-26', cal: panaji, calendarDays: true }).days).toBe(4);
  });
});

describe('pro-rating and accrual (R20, R35)', () => {
  it('joined 1 July: CL 4.0 and SL 3.5', () => {
    expect(proratedQuota(8, '2026-07-01', 2026)).toBe(4);
    expect(proratedQuota(7, '2026-07-01', 2026)).toBe(3.5);
  });
  it('joined after the 15th excludes the joining month', () => {
    expect(proratedQuota(8, '2026-07-16', 2026)).toBe(3.5); // 5/12 * 8 = 3.33 -> 3.5
    expect(proratedQuota(8, '2026-07-15', 2026)).toBe(4);
  });
  it('joined in an earlier year gets the full quota; later year gets 0', () => {
    expect(proratedQuota(8, '2025-03-10', 2026)).toBe(8);
    expect(proratedQuota(8, '2027-01-01', 2026)).toBe(0);
  });
  it('EL accrues 1.25 per completed month: joined 1 July has 7.5 by 31 Dec', () => {
    expect(accruedMonthly('2026-07-01', '2026-12-31', 2026)).toBe(7.5);
  });
  it('EL does not count a month until it ends, nor a partly worked joining month', () => {
    expect(accruedMonthly('2026-01-01', '2026-03-30', 2026)).toBe(2.5);
    expect(accruedMonthly('2026-07-10', '2026-12-31', 2026)).toBe(6.25);
  });
  it('EL carry-forward is capped at 30; negatives become 0', () => {
    expect(carryForward(35, 30)).toBe(30);
    expect(carryForward(12, 30)).toBe(12);
    expect(carryForward(-2, 30)).toBe(0);
  });
});

describe('balance (R21) and LOP conversion (R15)', () => {
  it('pending reserves days; approval moves them to used', () => {
    const base = { opening: 0, accrued: 8, used: 0, pending: 0 };
    expect(computeBalance(base).available).toBe(8);
    expect(computeBalance({ ...base, pending: 2 }).available).toBe(6);
    expect(computeBalance({ ...base, used: 2 }).available).toBe(6);
  });
  it('cancelling an approved request restores the balance', () => {
    expect(computeBalance({ opening: 0, accrued: 8, used: 0, pending: 0 }).available).toBe(8);
  });
  it('excess over available converts to LOP', () => {
    expect(splitForLop(5, 3)).toEqual({ leaveDays: 3, lopDays: 2 });
    expect(splitForLop(2, 3)).toEqual({ leaveDays: 2, lopDays: 0 });
    expect(splitForLop(2, 0)).toEqual({ leaveDays: 0, lopDays: 2 });
  });
});

describe('leave request validation', () => {
  const sl: LeaveTypeRules = { code: 'SL', halfDayAllowed: true, certificateAfterDays: 2, eligibleGender: 'any' };
  const cl: LeaveTypeRules = { code: 'CL', halfDayAllowed: true, certificateAfterDays: null, eligibleGender: 'any' };
  const base = { today: '2026-10-17', from: '2026-10-19', to: '2026-10-21', isHalfDay: false, days: 3, hasCertificate: false, existing: [] };

  it('SL of 3 days cannot be submitted without a certificate', () => {
    expect(validateLeaveRequest({ ...base, type: sl })).toContain('SL of more than 2 days needs a medical certificate.');
    expect(validateLeaveRequest({ ...base, type: sl, hasCertificate: true })).toEqual([]);
  });
  it('SL of 2 days needs no certificate', () => {
    expect(validateLeaveRequest({ ...base, days: 2, type: sl })).toEqual([]);
  });
  it('rejects leave more than 30 days in the past, allows exactly 30', () => {
    expect(validateLeaveRequest({ ...base, from: '2026-09-16', to: '2026-09-16', days: 1, type: cl })).toHaveLength(1);
    expect(validateLeaveRequest({ ...base, from: '2026-09-17', to: '2026-09-17', days: 1, type: cl })).toEqual([]);
  });
  it('rejects overlap with an existing pending or approved request', () => {
    const errs = validateLeaveRequest({ ...base, type: cl, existing: [{ from: '2026-10-21', to: '2026-10-22' }] });
    expect(errs).toContain('You already have leave on some of these dates.');
  });
  it('enforces gender eligibility for Maternity/Paternity', () => {
    const mat: LeaveTypeRules = { code: 'ML', halfDayAllowed: false, eligibleGender: 'female' };
    expect(validateLeaveRequest({ ...base, type: mat, gender: 'male' })).not.toEqual([]);
    expect(validateLeaveRequest({ ...base, type: mat, gender: 'female' })).toEqual([]);
  });
  it('half day only where allowed', () => {
    const el: LeaveTypeRules = { code: 'EL', halfDayAllowed: false, eligibleGender: 'any' };
    expect(validateLeaveRequest({ ...base, from: '2026-10-19', to: '2026-10-19', isHalfDay: true, days: 0.5, type: el })).toContain(
      'Half day is not allowed for this leave type.',
    );
  });
});

describe('default date for forms', () => {
  it('Saturday at head office opens on Monday; at the plant it stays Saturday', () => {
    expect(nextWorkingDay('2026-10-17', panaji)).toBe('2026-10-19');
    expect(nextWorkingDay('2026-10-17', verna)).toBe('2026-10-17');
  });
  it('skips a holiday that follows a weekly off', () => {
    const cal: WorkCalendar = { ...panaji, holidays: [{ date: '2026-10-19', name: 'X', type: 'State' }] };
    expect(nextWorkingDay('2026-10-17', cal)).toBe('2026-10-20');
  });
});
