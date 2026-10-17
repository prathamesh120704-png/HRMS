import { addDays, monthRange, type ISODate } from '@/lib/time/ist';

function joinParts(join: ISODate) {
  const [y, m, d] = join.split('-').map(Number);
  return { y, m, d };
}

/**
 * Pro-rated annual quota for a joiner (R20): months remaining = 12 - (joinMonth - 1) if joined on or
 * before the 15th, else the joining month is excluded. Rounded to the nearest 0.5 day.
 * Joined in an earlier year: full quota. Joins after the year: 0.
 */
export function proratedQuota(annualQuota: number, joinDate: ISODate, year: number): number {
  const { y, m, d } = joinParts(joinDate);
  if (y < year) return annualQuota;
  if (y > year) return 0;
  const months = d <= 15 ? 12 - (m - 1) : 12 - m;
  return Math.round(((annualQuota * months) / 12) * 2) / 2;
}

/**
 * EL accrual: perMonth for every COMPLETED calendar month of the year up to asOf (R20).
 * A month counts when the employee was there on its 1st and asOf has reached its last day.
 */
export function accruedMonthly(joinDate: ISODate, asOf: ISODate, year: number, perMonth = 1.25, cap?: number): number {
  let months = 0;
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    const { first, last } = monthRange(month);
    if (joinDate <= first && asOf >= last) months += 1;
  }
  const total = months * perMonth;
  return cap === undefined ? total : Math.min(total, cap);
}

/** EL carried into next year, capped (R35). CL and SL lapse (carry 0). */
export function carryForward(previousAvailable: number, max: number): number {
  return Math.min(Math.max(previousAvailable, 0), max);
}

export function lastDayOfYear(year: number): ISODate {
  return addDays(`${year + 1}-01-01`, -1);
}
