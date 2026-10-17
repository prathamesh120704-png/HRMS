import { describe, expect, it } from 'vitest';
import { aadhaarSchema, ifscSchema, isAtLeast18OnJoining, mobileSchema, panSchema, pinSchema, stateSchema, uanSchema } from '@/lib/validation/indian';
import { maskAadhaar, maskAccount, maskPAN } from '@/lib/mask';
import { wouldCreateLoop } from '@/lib/domain/reportingChain';

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;

describe('Indian field validation (R1-R7)', () => {
  it('PAN: ABCDE1234F ok; ABC123 and lowercase-with-bad-shape rejected', () => {
    expect(ok(panSchema, 'ABCDE1234F')).toBe(true);
    expect(ok(panSchema, 'abcde1234f')).toBe(true); // normalised to upper case
    expect(ok(panSchema, 'ABC123')).toBe(false);
    expect(ok(panSchema, 'ABCDE12345')).toBe(false);
  });
  it('IFSC: 4 letters, 0, 6 alphanumerics', () => {
    expect(ok(ifscSchema, 'HDFC0001234')).toBe(true);
    expect(ok(ifscSchema, 'HDFC1001234')).toBe(false);
    expect(ok(ifscSchema, 'HDF0001234')).toBe(false);
  });
  it('Mobile: 10 digits starting 6-9; a 9-digit number is rejected with a clear message', () => {
    expect(ok(mobileSchema, '9876543210')).toBe(true);
    expect(ok(mobileSchema, '5876543210')).toBe(false);
    const r = mobileSchema.safeParse('987654321');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/10 digits/);
  });
  it('Aadhaar 12 digits (spaces allowed on input); UAN 12 digits; PIN 6 digits', () => {
    expect(ok(aadhaarSchema, '1234 1234 1234')).toBe(true);
    expect(ok(aadhaarSchema, '12341234123')).toBe(false);
    expect(ok(uanSchema, '123456789012')).toBe(true);
    expect(ok(uanSchema, '12345')).toBe(false);
    expect(ok(pinSchema, '403001')).toBe(true);
    expect(ok(pinSchema, '40300')).toBe(false);
  });
  it('State must come from the Indian states and UTs list', () => {
    expect(ok(stateSchema, 'Goa')).toBe(true);
    expect(ok(stateSchema, 'Atlantis')).toBe(false);
  });
  it('an employee aged 17 on the joining date is rejected; exactly 18 is accepted', () => {
    expect(isAtLeast18OnJoining('2009-10-18', '2026-10-17')).toBe(false);
    expect(isAtLeast18OnJoining('2008-10-17', '2026-10-17')).toBe(true);
    expect(isAtLeast18OnJoining('2008-10-18', '2026-10-17')).toBe(false);
    expect(isAtLeast18OnJoining('2008-02-29', '2026-02-27')).toBe(false); // same rule as the DB check: turns 18 on 28 Feb
    expect(isAtLeast18OnJoining('2008-02-29', '2026-02-28')).toBe(true);
  });
});

describe('masking (E7)', () => {
  it('PAN ABCDE****F, Aadhaar XXXX XXXX 1234, account last 4 only', () => {
    expect(maskPAN('ABCDE1234F')).toBe('ABCDE****F');
    expect(maskAadhaar('123412341234')).toBe('XXXX XXXX 1234');
    expect(maskAccount('123456789012')).toBe('••••••••9012');
  });
  it('the masked Aadhaar never contains the other 8 digits', () => {
    expect(maskAadhaar('987654321098')).not.toMatch(/9876|5432/);
  });
});

describe('reporting structure (E4)', () => {
  const managerOf = new Map<string, string | null>([['A', null], ['B', 'A'], ['C', 'B']]);
  it('cannot report to self', () => expect(wouldCreateLoop('A', 'A', managerOf)).toBe(true));
  it('A under B is blocked when B reports to A', () => expect(wouldCreateLoop('A', 'B', managerOf)).toBe(true));
  it('A under C is blocked (indirect loop)', () => expect(wouldCreateLoop('A', 'C', managerOf)).toBe(true));
  it('a valid move is allowed', () => {
    expect(wouldCreateLoop('C', 'A', managerOf)).toBe(false);
    expect(wouldCreateLoop('C', null, managerOf)).toBe(false);
  });
});
