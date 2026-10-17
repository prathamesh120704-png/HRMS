// The ONLY module that touches time zones. All app times are IST (Asia/Kolkata).
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const IST = 'Asia/Kolkata';

/** Calendar date in IST, as 'YYYY-MM-DD'. */
export type ISODate = string;

export function toISTDate(d: Date | string): ISODate {
  return formatInTimeZone(d, IST, 'yyyy-MM-dd');
}

export function todayIST(now: Date = new Date()): ISODate {
  return toISTDate(now);
}

/** Seconds since midnight IST. */
export function istSecondsOfDay(d: Date | string): number {
  const [h, m, s] = formatInTimeZone(d, IST, 'HH:mm:ss').split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

export function formatIST(d: Date | string, pattern = 'dd MMM yyyy, hh:mm a'): string {
  return formatInTimeZone(d, IST, pattern);
}

export function formatDateIST(date: ISODate): string {
  return formatInTimeZone(`${date}T00:00:00Z`, 'UTC', 'dd MMM yyyy');
}

/** Build an instant from an IST date and 'HH:mm' (or 'HH:mm:ss'). */
export function istInstant(date: ISODate, time: string): Date {
  const t = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${t}`, IST);
}

function utc(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for an IST calendar date. */
export function dayOfWeek(date: ISODate): number {
  return utc(date).getUTCDay();
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

export function eachDate(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthRange(month: string): { first: ISODate; last: ISODate } {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}
