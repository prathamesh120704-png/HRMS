import type { ISODate } from '@/lib/time/ist';

export type HolidayType = 'National' | 'State' | 'Optional';
export interface Holiday { date: ISODate; name: string; type: HolidayType }

/** Everything about a location that decides whether a date is a working day for one employee. */
export interface WorkCalendar {
  /** 0 = Sunday ... 6 = Saturday */
  weeklyOffDays: number[];
  /** Holidays for THIS location only. */
  holidays: Holiday[];
  /** Optional holidays this employee picked (R31). Unpicked Optional holidays are working days. */
  pickedOptional?: ISODate[];
}

export type DayStatus = 'Present' | 'Half Day' | 'Absent' | 'On Leave' | 'Holiday' | 'Weekly Off';

export interface ApprovedLeave {
  from: ISODate;
  to: ISODate;
  isHalfDay: boolean;
  typeCode: string;
  /** LOP-type leave counts as LOP days, not leave days (R24). */
  isLop: boolean;
}
