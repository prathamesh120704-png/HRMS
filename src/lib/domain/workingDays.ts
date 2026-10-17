import { dayOfWeek, eachDate, type ISODate } from '@/lib/time/ist';
import type { WorkCalendar } from './types';

export type NonWorkingReason = 'weekly_off' | 'holiday';

/** Why a date is not a working day for this calendar, or null if it is one. Holiday wins over weekly off. */
export function nonWorkingReason(date: ISODate, cal: WorkCalendar): NonWorkingReason | null {
  const h = cal.holidays.find((x) => x.date === date);
  if (h && (h.type !== 'Optional' || cal.pickedOptional?.includes(date))) return 'holiday';
  if (cal.weeklyOffDays.includes(dayOfWeek(date))) return 'weekly_off';
  return null;
}

export interface WorkingDayResult {
  days: number;
  excluded: { date: ISODate; reason: NonWorkingReason }[];
}

/**
 * Leave days between two dates (inclusive), excluding weekly offs and holidays.
 * No sandwich rule (R18): offs inside the range are simply not counted.
 * `calendarDays` is for Maternity/Paternity (R30): every day counts.
 */
export function countWorkingDays(args: {
  from: ISODate;
  to: ISODate;
  isHalfDay?: boolean;
  cal: WorkCalendar;
  calendarDays?: boolean;
}): WorkingDayResult {
  const { from, to, isHalfDay = false, cal, calendarDays = false } = args;
  if (to < from) throw new Error('to_date must not be before from_date');
  const excluded: WorkingDayResult['excluded'] = [];
  let days = 0;
  for (const d of eachDate(from, to)) {
    const reason = calendarDays ? null : nonWorkingReason(d, cal);
    if (reason) excluded.push({ date: d, reason });
    else days += 1;
  }
  if (isHalfDay) {
    if (from !== to) throw new Error('A half day must be a single date');
    days = days > 0 ? 0.5 : 0;
  }
  return { days, excluded };
}
