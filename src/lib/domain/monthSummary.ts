import { eachDate, monthRange, type ISODate } from '@/lib/time/ist';
import { deriveDayStatus, type Punch } from './dayStatus';
import { lopFromLates } from './lateRules';
import type { ApprovedLeave, WorkCalendar } from './types';

export interface MonthSummary {
  month: string;
  present: number;
  wfh: number;
  leaveByType: Record<string, number>;
  lop: number;
  holidays: number;
  weeklyOffs: number;
  lateCount: number;
  lateLop: number;
}

/**
 * Month-end buckets using the single table in R24. Used by the calendar, the report, the CSV and the agent.
 * Days before joining, after the last working day, or after `today` are not counted.
 */
export function monthSummary(args: {
  month: string; // 'YYYY-MM'
  cal: WorkCalendar;
  punches: Map<ISODate, Punch>;
  leaves: ApprovedLeave[];
  joinDate: ISODate;
  lastWorkingDay?: ISODate | null;
  today: ISODate;
}): MonthSummary {
  const { month, cal, punches, leaves, joinDate, lastWorkingDay, today } = args;
  const { first, last } = monthRange(month);
  const s: MonthSummary = {
    month, present: 0, wfh: 0, leaveByType: {}, lop: 0, holidays: 0, weeklyOffs: 0, lateCount: 0, lateLop: 0,
  };

  for (const date of eachDate(first, last)) {
    if (date < joinDate || date > today || (lastWorkingDay && date > lastWorkingDay)) continue;
    const leave = leaves.find((l) => date >= l.from && date <= l.to) ?? null;
    const punch = punches.get(date) ?? null;
    const r = deriveDayStatus({ date, cal, punch, leave });

    if (r.status === 'Holiday') { s.holidays += 1; continue; }
    if (r.status === 'Weekly Off') { s.weeklyOffs += 1; continue; }

    s.present += r.present;
    s.lop += r.lopDays;
    if (r.leaveDays && r.leaveTypeCode) {
      s.leaveByType[r.leaveTypeCode] = (s.leaveByType[r.leaveTypeCode] ?? 0) + r.leaveDays;
    }
    if (punch?.isWfh && r.present > 0) s.wfh += 1;
    if (r.isLate && r.status !== 'On Leave') s.lateCount += 1;
  }
  s.lateLop = lopFromLates(s.lateCount);
  s.lop += s.lateLop;
  return s;
}
