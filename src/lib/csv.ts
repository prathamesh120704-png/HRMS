import type { MonthSummary } from '@/lib/domain/monthSummary';

export interface ReportRow {
  code: string;
  name: string;
  location: string;
  summary: MonthSummary;
}

/**
 * Spreadsheet formula injection: a cell that starts with = + - @ (or tab/CR) can run as a formula when the CSV is
 * opened in Excel or Sheets. Names come from user-editable data, so every text cell is neutralised.
 */
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function csvCell(v: string | number): string {
  const s = typeof v === 'number' ? fmt(v) : safeText(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Whole numbers stay whole; halves and quarters keep up to 2 decimals. */
export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Month-end CSV for the payroll vendor (L8). Columns are fixed and contain NO PAN, Aadhaar or bank data: those
 * never reach this module, so they cannot appear in an export (privacy rule R2).
 * `leaveCodes` are the non-LOP leave types in display order.
 */
export function buildMonthEndCsv(rows: ReportRow[], leaveCodes: string[]): string {
  const header = [
    'Employee Code', 'Name', 'Location', 'Days Present', 'WFH Days',
    ...leaveCodes.map((c) => `${c} Days`),
    'LOP Days', 'Late Marks', 'Holidays', 'Weekly Offs',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    const s = r.summary;
    lines.push([
      r.code, r.name, r.location, s.present, s.wfh,
      ...leaveCodes.map((c) => s.leaveByType[c] ?? 0),
      s.lop, s.lateCount, s.holidays, s.weeklyOffs,
    ].map(csvCell).join(','));
  }
  // BOM so Excel opens UTF-8 names correctly; CRLF is the CSV standard.
  return `﻿${lines.join('\r\n')}\r\n`;
}
