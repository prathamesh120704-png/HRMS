import { toISTDate, type ISODate } from '@/lib/time/ist';
import { isLate } from './lateRules';
import { nonWorkingReason } from './workingDays';
import type { ApprovedLeave, DayStatus, WorkCalendar } from './types';

export interface Punch { checkIn?: Date | null; checkOut?: Date | null; isWfh?: boolean }

export interface DayResult {
  status: DayStatus;
  isLate: boolean;
  hours: number;
  /** Checked in but never checked out; day is Absent until regularised (R25). */
  missedPunch: boolean;
  halfLeave: boolean;
  /** Month-end buckets for this day (R24). */
  present: number;
  leaveDays: number;
  lopDays: number;
  leaveTypeCode?: string;
}

function hoursWorked(p?: Punch): number {
  if (!p?.checkIn || !p.checkOut) return 0;
  return Math.max(0, (p.checkOut.getTime() - p.checkIn.getTime()) / 3_600_000);
}

/**
 * Single source of truth for a day's status and its month-end buckets.
 * Precedence: Holiday / Weekly Off -> On Leave -> worked hours (R13b).
 *   >= 8h Present, 4h to < 8h Half Day, < 4h or no punch Absent (R11).
 */
export function deriveDayStatus(args: {
  date: ISODate;
  cal: WorkCalendar;
  punch?: Punch | null;
  leave?: ApprovedLeave | null;
}): DayResult {
  const { date, cal, punch, leave } = args;
  const hours = hoursWorked(punch ?? undefined);
  const base = { hours, isLate: false, missedPunch: false, halfLeave: false, present: 0, leaveDays: 0, lopDays: 0 };

  const off = nonWorkingReason(date, cal);
  if (off) return { ...base, status: off === 'holiday' ? 'Holiday' : 'Weekly Off' };

  const missedPunch = !!punch?.checkIn && !punch.checkOut;
  const late = !!punch?.checkIn && isLate(punch.checkIn);

  if (leave) {
    if (!leave.isHalfDay) {
      return {
        ...base, status: 'On Leave', leaveTypeCode: leave.typeCode,
        leaveDays: leave.isLop ? 0 : 1, lopDays: leave.isLop ? 1 : 0,
      };
    }
    // Half-day leave: the other half follows the hours worked (R28).
    const workedOtherHalf = hours >= 4;
    return {
      ...base, status: 'On Leave', halfLeave: true, leaveTypeCode: leave.typeCode,
      leaveDays: leave.isLop ? 0 : 0.5,
      lopDays: (leave.isLop ? 0.5 : 0) + (workedOtherHalf ? 0 : 0.5),
      present: workedOtherHalf ? 0.5 : 0,
    };
  }

  if (hours >= 8) return { ...base, status: 'Present', isLate: late, present: 1 };
  if (hours >= 4) return { ...base, status: 'Half Day', isLate: late, present: 0.5, lopDays: 0.5 };
  return { ...base, status: 'Absent', isLate: late, missedPunch, lopDays: 1 };
}

/** The IST calendar date a punch belongs to. */
export function attendanceDateFor(checkIn: Date): ISODate {
  return toISTDate(checkIn);
}
