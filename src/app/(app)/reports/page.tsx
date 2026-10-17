import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { requireManagerOrHr } from '@/lib/auth/session';
import { fmt } from '@/lib/csv';
import { formatDateIST, todayIST } from '@/lib/time/ist';
import { monthEnd } from '@/modules/reports/queries';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function recentMonths(today: string, n = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < n; i++) {
    const value = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ value, label: new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireManagerOrHr();
  const today = todayIST();
  const { month: m } = await searchParams;
  const month = m && MONTH.test(m) && m <= today.slice(0, 7) ? m : today.slice(0, 7);
  const { rows, leaveCodes, countedThrough } = await monthEnd(s.db, s.employee, s.isHr, month, today);

  return (
    <>
      <PageHeader
        title="Month-end summary"
        sub={`${s.isHr ? 'All employees' : 'Your direct reports'} · no PAN, Aadhaar or bank details in this report`}
      />
      <Card>
        <form className="row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="month">Month</label>
            <select id="month" name="month" defaultValue={month}>
              {recentMonths(today).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" type="submit">Show</button>
          {rows.length > 0
            ? <a className="btn" href={`/api/reports/month-end?month=${month}`}>Download CSV</a>
            : <button className="btn" type="button" disabled title="Nothing to download for this month">Download CSV</button>}
        </form>
        {countedThrough && (
          <p className="hint" style={{ marginBottom: 12 }}>
            Counted through {formatDateIST(countedThrough)}. The current day is excluded until it ends.
          </p>
        )}

        {rows.length === 0 ? (
          <EmptyState
            title="No attendance recorded for this month yet."
            hint={s.isHr ? 'Try an earlier month.' : 'People who report to you appear here once the month has started.'}
          />
        ) : (
          <table className="stack">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Location</th><th className="num">Present</th><th className="num">WFH</th>
                {leaveCodes.map((c) => <th key={c} className="num">{c}</th>)}
                <th className="num">LOP</th><th className="num">Late</th><th className="num">Holidays</th><th className="num">Weekly offs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td data-label="Code">{r.code}</td>
                  <td data-label="Name">{r.name}</td>
                  <td data-label="Location">{r.location}</td>
                  <td data-label="Present" className="num">{fmt(r.summary.present)}</td>
                  <td data-label="WFH" className="num">{fmt(r.summary.wfh)}</td>
                  {leaveCodes.map((c) => <td key={c} data-label={c} className="num">{fmt(r.summary.leaveByType[c] ?? 0)}</td>)}
                  <td data-label="LOP" className="num">{fmt(r.summary.lop)}</td>
                  <td data-label="Late" className="num">{fmt(r.summary.lateCount)}</td>
                  <td data-label="Holidays" className="num">{fmt(r.summary.holidays)}</td>
                  <td data-label="Weekly offs" className="num">{fmt(r.summary.weeklyOffs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint" style={{ marginTop: 12 }}>
          LOP = Loss of Pay leave + Absent days + the missing half of Half Days + half a day for every 3 Late marks.
          Holidays and weekly offs are shown separately.
        </p>
      </Card>
    </>
  );
}
