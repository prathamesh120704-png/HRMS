import { describe, expect, it } from 'vitest';
import { accruedFor, balanceFor, type LeaveTypeInfo } from '@/lib/domain/leaveBalance';

const CL: LeaveTypeInfo = { code: 'CL', annualQuota: 8, accrualMethod: 'upfront' };
const SL: LeaveTypeInfo = { code: 'SL', annualQuota: 7, accrualMethod: 'upfront' };
const EL: LeaveTypeInfo = { code: 'EL', annualQuota: 15, accrualMethod: 'monthly' };
const LOP: LeaveTypeInfo = { code: 'LOP', annualQuota: 0, accrualMethod: 'none' };

describe('leave balance breakdown (L2, R20, R21)', () => {
  it('an employee who joined on 1 July sees pro-rated CL 4.0 and SL 3.5', () => {
    expect(accruedFor(CL, '2026-07-01', 2026, '2026-10-17')).toBe(4);
    expect(accruedFor(SL, '2026-07-01', 2026, '2026-10-17')).toBe(3.5);
  });
  it('a full-year employee gets the full CL/SL quota on 1 January', () => {
    expect(accruedFor(CL, '2024-02-01', 2026, '2026-01-01')).toBe(8);
  });
  it('EL accrues 1.25 per completed month: 9 completed months by 17 Oct 2026 = 11.25', () => {
    expect(accruedFor(EL, '2024-02-01', 2026, '2026-10-17')).toBe(11.25);
  });
  it('LOP never accrues', () => expect(accruedFor(LOP, '2024-02-01', 2026, '2026-10-17')).toBe(0));

  it('pending reserves days, approved moves them to used, available follows R21', () => {
    const base = { type: CL, joinDate: '2024-02-01', year: 2026, asOf: '2026-10-17', opening: 0, adjustment: 0 };
    expect(balanceFor({ ...base, used: 0, pending: 0 }).available).toBe(8);
    expect(balanceFor({ ...base, used: 0, pending: 2 }).available).toBe(6); // pending: balance already reduced
    expect(balanceFor({ ...base, used: 2, pending: 0 }).available).toBe(6); // approved: same available, moved to used
  });
  it('EL opening carry-forward adds to available', () => {
    const b = balanceFor({ type: EL, joinDate: '2024-02-01', year: 2026, asOf: '2026-01-31', opening: 5, adjustment: 0, used: 1, pending: 0 });
    expect(b.accrued).toBe(1.25);
    expect(b.available).toBe(5.25);
  });
});
