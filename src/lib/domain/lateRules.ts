import { istSecondsOfDay } from '@/lib/time/ist';

const LATE_AFTER_SECONDS = 10 * 3600 + 15 * 60; // 10:15:00 AM IST

/** Late means strictly after 10:15:00 IST; exactly 10:15 is on time (R12). */
export function isLate(checkIn: Date): boolean {
  return istSecondsOfDay(checkIn) > LATE_AFTER_SECONDS;
}

/** Every 3 Late marks in a calendar month = 1 half-day of LOP (R12). 3 -> 0.5, 6 -> 1.0. */
export function lopFromLates(lateCount: number): number {
  return Math.floor(lateCount / 3) * 0.5;
}
