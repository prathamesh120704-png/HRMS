import { describe, expect, it } from 'vitest';
import { ACCRUAL_METHODS, leaveTypeEditSchema, leaveTypeSchema } from '@/lib/validation/leaveType';

const base = { code: 'CO', name: 'Comp Off', annual_quota: 4, accrual_method: 'upfront', carry_forward_max: 0, half_day_allowed: true };
const ok = (v: unknown) => leaveTypeSchema.safeParse(v).success;
const msg = (v: unknown) => {
  const r = leaveTypeSchema.safeParse(v);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' | ');
};

describe('leave type configuration (L1)', () => {
  it('accepts a normal type and normalises the code to capitals', () => {
    const r = leaveTypeSchema.safeParse({ ...base, code: ' co ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('CO');
  });

  it('the four accrual methods are exactly the ones the rules engine understands', () => {
    expect([...ACCRUAL_METHODS]).toEqual(['upfront', 'monthly', 'on_request', 'none']);
    expect(ok({ ...base, accrual_method: 'weekly' })).toBe(false);
  });

  it('quota must be 0 to 366 in steps of 0.5', () => {
    expect(ok({ ...base, annual_quota: 8.5 })).toBe(true);
    expect(ok({ ...base, annual_quota: -1 })).toBe(false);
    expect(ok({ ...base, annual_quota: 367 })).toBe(false);
    expect(msg({ ...base, annual_quota: 7.3 })).toMatch(/0\.5/);
  });

  it('numbers typed as text in a form are accepted; junk is not', () => {
    expect(ok({ ...base, annual_quota: '12', carry_forward_max: '0' })).toBe(true);
    expect(ok({ ...base, annual_quota: 'lots' })).toBe(false);
    expect(ok({ ...base, annual_quota: '' })).toBe(false);
  });

  it('code is 2 to 6 capital letters', () => {
    for (const bad of ['C', 'TOOLONGCODE', 'C1', 'C L', '']) expect(ok({ ...base, code: bad })).toBe(false);
    expect(ok({ ...base, code: 'COMPOFF' })).toBe(false); // 7 letters
    expect(ok({ ...base, code: 'COMP' })).toBe(true);
  });

  it('a type with no accrual (like Loss of Pay) cannot have a quota or carry-forward', () => {
    expect(ok({ ...base, accrual_method: 'none', annual_quota: 0, carry_forward_max: 0 })).toBe(true);
    expect(msg({ ...base, accrual_method: 'none', annual_quota: 5 })).toMatch(/no accrual/i);
    expect(ok({ ...base, accrual_method: 'none', annual_quota: 0, carry_forward_max: 5 })).toBe(false);
  });

  it('an "on request" type (Maternity, Paternity) cannot carry leave forward', () => {
    expect(ok({ ...base, accrual_method: 'on_request', carry_forward_max: 0 })).toBe(true);
    expect(msg({ ...base, accrual_method: 'on_request', carry_forward_max: 10 })).toMatch(/carry/i);
  });

  it('earned leave: monthly accrual with a 30-day carry-forward is valid', () => {
    expect(ok({ code: 'EL', name: 'Earned Leave', annual_quota: 15, accrual_method: 'monthly', carry_forward_max: 30, half_day_allowed: false })).toBe(true);
  });

  it('a name is required', () => {
    expect(ok({ ...base, name: '  ' })).toBe(false);
    expect(ok({ ...base, name: 'x'.repeat(61) })).toBe(false);
  });

  it('editing never changes the code: the edit schema has no code field and needs the id', () => {
    const { code: _code, ...rest } = base;
    void _code;
    expect(leaveTypeEditSchema.safeParse({ ...rest, id: '5562ba7e-cfaa-4af3-b005-5d627346ebd0' }).success).toBe(true);
    expect(leaveTypeEditSchema.safeParse({ ...rest, id: 'not-a-uuid' }).success).toBe(false);
    expect('code' in leaveTypeEditSchema.shape).toBe(false);
  });
});
