import { describe, expect, it } from 'vitest';
import { deriveDayStatus } from '@/lib/domain/dayStatus';
import { isLate, lopFromLates } from '@/lib/domain/lateRules';
import { monthSummary } from '@/lib/domain/monthSummary';
import { istInstant, toISTDate, formatIST } from '@/lib/time/ist';
import type { ApprovedLeave, WorkCalendar } from '@/lib/domain/types';

const panaji: WorkCalendar = { weeklyOffDays: [0, 6], holidays: [] };
const verna: WorkCalendar = { weeklyOffDays: [0], holidays: [] };
const at = (date: string, t: string) => istInstant(date, t);

describe('IST handling (R8)', () => {
  it('maps an instant to the IST date, not the UTC date', () => {
    // 23:30 IST on 16 Oct is 18:00 UTC on 16 Oct; 00:30 IST on 17 Oct is 19:00 UTC on 16 Oct.
    expect(toISTDate(new Date('2026-10-16T19:00:00Z'))).toBe('2026-10-17');
    expect(toISTDate(at('2026-10-16', '23:30'))).toBe('2026-10-16');
    expect(formatIST(new Date('2026-10-17T04:22:00Z'), 'hh:mm a')).toBe('09:52 AM');
  });
});

describe('Late rule (R12)', () => {
  it('10:20 AM is Late, exactly 10:15 is not, 10:15:01 is', () => {
    expect(isLate(at('2026-10-19', '10:20'))).toBe(true);
    expect(isLate(at('2026-10-19', '10:15:00'))).toBe(false);
    expect(isLate(at('2026-10-19', '10:15:01'))).toBe(true);
    expect(isLate(at('2026-10-19', '09:59'))).toBe(false);
  });
  it('every 3 Lates convert into a half-day of LOP', () => {
    expect([0, 2, 3, 5, 6].map(lopFromLates)).toEqual([0, 0, 0.5, 0.5, 1]);
  });
});

describe('day status (R11, R13b, R25-R28)', () => {
  const day = '2026-10-19'; // Monday
  const p = (inT: string, outT?: string) => ({ checkIn: at(day, inT), checkOut: outT ? at(day, outT) : null });

  it('8 hours is Present, 5 hours is Half Day, under 4 is Absent', () => {
    expect(deriveDayStatus({ date: day, cal: panaji, punch: p('09:00', '17:00') }).status).toBe('Present');
    expect(deriveDayStatus({ date: day, cal: panaji, punch: p('09:00', '14:00') }).status).toBe('Half Day');
    expect(deriveDayStatus({ date: day, cal: panaji, punch: p('09:00', '12:59') }).status).toBe('Absent');
    expect(deriveDayStatus({ date: day, cal: panaji, punch: p('09:00', '13:00') }).status).toBe('Half Day');
  });
  it('no punch is Absent; a missed check-out is Absent and flagged', () => {
    expect(deriveDayStatus({ date: day, cal: panaji }).status).toBe('Absent');
    const r = deriveDayStatus({ date: day, cal: panaji, punch: p('09:00') });
    expect(r.status).toBe('Absent');
    expect(r.missedPunch).toBe(true);
  });
  it("a plant employee's Saturday is a working day; head office Saturday is a weekly off", () => {
    expect(deriveDayStatus({ date: '2026-10-24', cal: verna }).status).toBe('Absent');
    expect(deriveDayStatus({ date: '2026-10-24', cal: panaji }).status).toBe('Weekly Off');
    expect(deriveDayStatus({ date: '2026-10-25', cal: verna }).status).toBe('Weekly Off');
  });
  it('a state holiday for Verna does not appear for Panaji', () => {
    const vernaHoliday: WorkCalendar = { ...verna, holidays: [{ date: day, name: 'Verna Fair', type: 'State' }] };
    expect(deriveDayStatus({ date: day, cal: vernaHoliday }).status).toBe('Holiday');
    expect(deriveDayStatus({ date: day, cal: panaji }).status).toBe('Absent');
  });
  it('approved leave wins over a punch (R13)', () => {
    const leave: ApprovedLeave = { from: day, to: day, isHalfDay: false, typeCode: 'CL', isLop: false };
    const r = deriveDayStatus({ date: day, cal: panaji, punch: p('09:00', '17:00'), leave });
    expect(r.status).toBe('On Leave');
    expect(r.leaveDays).toBe(1);
    expect(r.present).toBe(0);
  });
  it('half-day leave: other half worked 4h+ is 0.5 present, otherwise 0.5 LOP (R28)', () => {
    const leave: ApprovedLeave = { from: day, to: day, isHalfDay: true, typeCode: 'CL', isLop: false };
    const worked = deriveDayStatus({ date: day, cal: panaji, punch: p('09:00', '13:30'), leave });
    expect(worked).toMatchObject({ status: 'On Leave', halfLeave: true, leaveDays: 0.5, present: 0.5, lopDays: 0 });
    const notWorked = deriveDayStatus({ date: day, cal: panaji, leave });
    expect(notWorked).toMatchObject({ leaveDays: 0.5, present: 0, lopDays: 0.5 });
  });
  it('holiday on a weekly off shows as Holiday; a punch on a holiday keeps the status (R26)', () => {
    const cal: WorkCalendar = { ...panaji, holidays: [{ date: '2026-10-24', name: 'X', type: 'National' }] };
    expect(deriveDayStatus({ date: '2026-10-24', cal, punch: { checkIn: at('2026-10-24', '10:00'), checkOut: at('2026-10-24', '18:00') } }).status).toBe('Holiday');
  });
  it('Late does not count on a full-day leave (R27)', () => {
    const leave: ApprovedLeave = { from: day, to: day, isHalfDay: false, typeCode: 'CL', isLop: false };
    expect(deriveDayStatus({ date: day, cal: panaji, punch: p('11:00', '19:00'), leave }).isLate).toBe(false);
  });
});

describe('month-end summary (R24) and three Lates', () => {
  it('third Late in a month creates a half-day LOP; buckets add up', () => {
    // Week of 12-16 Oct 2026 (Mon-Fri) at head office, all 8h days; three of them check in late.
    const punches = new Map<string, { checkIn: Date; checkOut: Date; isWfh?: boolean }>();
    const times: [string, string, string, boolean?][] = [
      ['2026-10-12', '10:20', '18:30'], ['2026-10-13', '10:30', '18:40'], ['2026-10-14', '10:16', '18:20'],
      ['2026-10-15', '09:00', '17:00'], ['2026-10-16', '09:00', '17:00', true],
    ];
    for (const [d, i, o, wfh] of times) punches.set(d, { checkIn: at(d, i), checkOut: at(d, o), isWfh: wfh });
    const s = monthSummary({
      month: '2026-10', cal: panaji, punches, leaves: [], joinDate: '2026-10-12', today: '2026-10-16',
    });
    expect(s.present).toBe(5);
    expect(s.wfh).toBe(1);
    expect(s.lateCount).toBe(3);
    expect(s.lateLop).toBe(0.5);
    expect(s.lop).toBe(0.5);
  });

  it('counts leave by type, LOP leave as LOP, absences as LOP, and offs in their own columns', () => {
    const cl: ApprovedLeave = { from: '2026-10-19', to: '2026-10-19', isHalfDay: false, typeCode: 'CL', isLop: false };
    const lop: ApprovedLeave = { from: '2026-10-20', to: '2026-10-20', isHalfDay: false, typeCode: 'LOP', isLop: true };
    const punches = new Map([['2026-10-21', { checkIn: at('2026-10-21', '09:00'), checkOut: at('2026-10-21', '17:00') }]]);
    const s = monthSummary({
      month: '2026-10', cal: panaji, punches, leaves: [cl, lop], joinDate: '2026-10-19', today: '2026-10-25',
    });
    // 19 CL, 20 LOP leave, 21 Present, 22 and 23 Absent, 24 and 25 weekly off.
    expect(s.leaveByType).toEqual({ CL: 1 });
    expect(s.present).toBe(1);
    expect(s.lop).toBe(3); // 1 (LOP leave) + 2 (Absent days)
    expect(s.weeklyOffs).toBe(2);
    expect(s.holidays).toBe(0);
  });

  it('days before joining and after today are not counted', () => {
    const s = monthSummary({
      month: '2026-10', cal: panaji, punches: new Map(), leaves: [], joinDate: '2026-10-26', today: '2026-10-27',
    });
    expect(s.lop).toBe(2); // 26 and 27 Oct only
  });
});
