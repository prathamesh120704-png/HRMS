import { describe, expect, it } from 'vitest';
import { buildMonthEndCsv, csvCell, fmt, type ReportRow } from '@/lib/csv';
import { deriveDayStatus, type Punch } from '@/lib/domain/dayStatus';
import { monthSummary } from '@/lib/domain/monthSummary';
import { lopFromLates } from '@/lib/domain/lateRules';
import type { ApprovedLeave, WorkCalendar } from '@/lib/domain/types';
import { eachDate, istInstant, monthRange } from '@/lib/time/ist';

const panaji: WorkCalendar = { weeklyOffDays: [0, 6], holidays: [{ date: '2026-10-02', name: 'Gandhi Jayanti', type: 'National' }] };
const verna: WorkCalendar = { weeklyOffDays: [0], holidays: [{ date: '2026-10-02', name: 'Gandhi Jayanti', type: 'National' }] };
const at = (d: string, t: string) => istInstant(d, t);

/** Independent day-by-day walk of the calendar: the "calendar" the CSV totals must agree with. */
function walk(cal: WorkCalendar, punches: Map<string, Punch>, leaves: ApprovedLeave[], join: string, today: string) {
  const { first, last } = monthRange('2026-10');
  const t = { present: 0, lop: 0, holidays: 0, offs: 0, lates: 0, cl: 0 };
  for (const date of eachDate(first, last)) {
    if (date < join || date > today) continue;
    const r = deriveDayStatus({ date, cal, punch: punches.get(date), leave: leaves.find((l) => date >= l.from && date <= l.to) ?? null });
    if (r.status === 'Holiday') t.holidays++;
    else if (r.status === 'Weekly Off') t.offs++;
    else {
      t.present += r.present; t.lop += r.lopDays; t.cl += r.leaveTypeCode === 'CL' ? r.leaveDays : 0;
      if (r.isLate && r.status !== 'On Leave') t.lates++;
    }
  }
  t.lop += lopFromLates(t.lates);
  return t;
}

const full = (d: string, i: string, o: string, wfh = false): [string, Punch] => [d, { checkIn: at(d, i), checkOut: at(d, o), isWfh: wfh }];

describe('month-end totals match the calendar (three sample employees)', () => {
  const cases: { name: string; cal: WorkCalendar; punches: [string, Punch][]; leaves: ApprovedLeave[]; join: string }[] = [
    {
      name: 'head office, mixed month with 3 Lates, WFH and CL',
      cal: panaji, join: '2025-01-01',
      punches: [full('2026-10-01', '10:20', '18:30'), full('2026-10-05', '10:30', '18:40'), full('2026-10-06', '10:16', '18:20'),
        full('2026-10-07', '09:00', '17:00', true), full('2026-10-08', '09:00', '14:00'), full('2026-10-09', '09:00', '17:30')],
      leaves: [{ from: '2026-10-12', to: '2026-10-13', isHalfDay: false, typeCode: 'CL', isLop: false }],
    },
    {
      name: 'plant, Saturday worked, LOP leave and half-day leave',
      cal: verna, join: '2025-01-01',
      punches: [full('2026-10-03', '09:00', '17:10'), full('2026-10-10', '09:05', '17:15'), full('2026-10-14', '09:00', '13:30')],
      leaves: [
        { from: '2026-10-14', to: '2026-10-14', isHalfDay: true, typeCode: 'CL', isLop: false },
        { from: '2026-10-15', to: '2026-10-15', isHalfDay: false, typeCode: 'LOP', isLop: true },
      ],
    },
    {
      name: 'mid-month joiner, nothing punched',
      cal: panaji, join: '2026-10-14', punches: [], leaves: [],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const today = '2026-10-20';
      const punches = new Map(c.punches);
      const s = monthSummary({ month: '2026-10', cal: c.cal, punches, leaves: c.leaves, joinDate: c.join, today });
      const w = walk(c.cal, punches, c.leaves, c.join, today);
      expect(s.present).toBe(w.present);
      expect(s.lop).toBe(w.lop);
      expect(s.holidays).toBe(w.holidays);
      expect(s.weeklyOffs).toBe(w.offs);
      expect(s.lateCount).toBe(w.lates);
      expect(s.leaveByType.CL ?? 0).toBe(w.cl);
    });
  }

  it('every counted day lands in exactly one bucket', () => {
    const today = '2026-10-31';
    const c = cases[0];
    const s = monthSummary({ month: '2026-10', cal: c.cal, punches: new Map(c.punches), leaves: c.leaves, joinDate: c.join, today });
    const leave = Object.values(s.leaveByType).reduce((a, b) => a + b, 0);
    // 31 days = holidays + weekly offs + (present + leave + LOP excluding late LOP); late LOP is an extra deduction.
    expect(s.holidays + s.weeklyOffs + s.present + leave + (s.lop - s.lateLop)).toBe(31);
  });
});

describe('CSV export (L8) and privacy', () => {
  const row: ReportRow = {
    code: 'KCF0007', name: 'Asha Naik', location: 'Panaji Head Office',
    summary: { month: '2026-10', present: 13.5, wfh: 2, leaveByType: { CL: 1, SL: 0.5 }, lop: 1.5, holidays: 1, weeklyOffs: 9, lateCount: 3, lateLop: 0.5 },
  };

  it('has the L8 columns in order and one line per employee', () => {
    const csv = buildMonthEndCsv([row], ['CL', 'SL', 'EL']).replace('﻿', '');
    const [head, line] = csv.trim().split('\r\n');
    expect(head).toBe('Employee Code,Name,Location,Days Present,WFH Days,CL Days,SL Days,EL Days,LOP Days,Late Marks,Holidays,Weekly Offs');
    expect(line).toBe('KCF0007,Asha Naik,Panaji Head Office,13.5,2,1,0.5,0,1.5,3,1,9');
  });

  it('never contains PAN, Aadhaar or bank columns', () => {
    const head = buildMonthEndCsv([], ['CL']).toLowerCase();
    for (const bad of ['pan', 'aadhaar', 'uan', 'account', 'ifsc', 'bank']) expect(head).not.toContain(bad);
  });

  it('neutralises spreadsheet formulas and escapes commas and quotes', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('Naik, Asha')).toBe('"Naik, Asha"');
    expect(csvCell(-1)).toBe('-1'); // real negative numbers are not text, so they are untouched
  });

  it('formats numbers compactly', () => {
    expect([1, 0.5, 13.25, 2.0, 0].map(fmt)).toEqual(['1', '0.5', '13.25', '2', '0']);
  });
});
