export interface BalanceInputs {
  opening: number;
  adjustment?: number;
  accrued: number;
  /** Sum of `days` on APPROVED requests in the leave year. */
  used: number;
  /** Sum of `days` on PENDING requests (reserved, R21). */
  pending: number;
}

export interface Balance extends Required<BalanceInputs> { available: number }

/** The one balance formula (R21): available = opening + adjustment + accrued - used - pending. */
export function computeBalance(i: BalanceInputs): Balance {
  const adjustment = i.adjustment ?? 0;
  return { ...i, adjustment, available: i.opening + adjustment + i.accrued - i.used - i.pending };
}

/** When a request exceeds the balance, the excess can be converted to LOP (R15). */
export function splitForLop(requestedDays: number, available: number): { leaveDays: number; lopDays: number } {
  const usable = Math.max(available, 0);
  const leaveDays = Math.min(requestedDays, usable);
  return { leaveDays, lopDays: requestedDays - leaveDays };
}
