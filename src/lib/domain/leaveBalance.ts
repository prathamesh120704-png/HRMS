import type { ISODate } from '@/lib/time/ist';
import { accruedMonthly, proratedQuota } from './accrual';
import { computeBalance, type Balance } from './balance';

export interface LeaveTypeInfo {
  code: string;
  annualQuota: number;
  accrualMethod: 'upfront' | 'monthly' | 'on_request' | 'none';
}

/**
 * Accrued days for one leave type in a leave year (R20):
 *  - upfront (CL, SL): credited 1 Jan, pro-rated for joiners
 *  - monthly (EL): quota/12 per completed month (1.25 for 15 days)
 *  - on_request (Maternity, Paternity): the entitlement is available once HR/eligibility allows it
 *  - none (LOP): nothing accrues
 */
export function accruedFor(type: LeaveTypeInfo, joinDate: ISODate, year: number, asOf: ISODate): number {
  switch (type.accrualMethod) {
    case 'upfront': return proratedQuota(type.annualQuota, joinDate, year);
    case 'monthly': return accruedMonthly(joinDate, asOf, year, type.annualQuota / 12);
    case 'on_request': return type.annualQuota;
    default: return 0;
  }
}

/** The full opening / accrued / used / pending / available breakdown shown on My leave. */
export function balanceFor(args: {
  type: LeaveTypeInfo; joinDate: ISODate; year: number; asOf: ISODate;
  opening: number; adjustment: number; used: number; pending: number;
}): Balance {
  const { type, joinDate, year, asOf, opening, adjustment, used, pending } = args;
  return computeBalance({ opening, adjustment, accrued: accruedFor(type, joinDate, year, asOf), used, pending });
}
