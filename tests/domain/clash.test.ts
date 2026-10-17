import { describe, expect, it } from 'vitest';
import { clashes } from '@/lib/domain/clash';

const team = [
  { employeeId: 'b', name: 'Ravi', from: '2026-10-21', to: '2026-10-22' },
  { employeeId: 'c', name: 'Meera', from: '2026-10-26', to: '2026-10-30' },
  { employeeId: 'a', name: 'Asha', from: '2026-10-20', to: '2026-10-21' },
];

describe('leave clash warning (L7)', () => {
  it('names the teammates away during the requested dates', () => {
    expect(clashes({ employeeId: 'a', from: '2026-10-20', to: '2026-10-21' }, team)).toEqual(['Ravi']);
  });
  it('touching a single boundary day is a clash', () => {
    expect(clashes({ employeeId: 'a', from: '2026-10-22', to: '2026-10-23' }, team)).toEqual(['Ravi']);
  });
  it('no overlap means no warning, and a person never clashes with themselves', () => {
    expect(clashes({ employeeId: 'a', from: '2026-10-23', to: '2026-10-24' }, team)).toEqual([]);
    expect(clashes({ employeeId: 'a', from: '2026-10-20', to: '2026-10-21' }, [team[2]])).toEqual([]);
  });
});
