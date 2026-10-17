import Link from 'next/link';
import { STATUS_STYLES, type StatusKey } from '@/components/ui/statusStyles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { addDays, dayOfWeek, monthRange, type ISODate } from '@/lib/time/ist';
import type { MonthDay } from './queries';

export function shiftMonth(month: string, delta: number): string {
  const { first } = monthRange(month);
  const d = delta > 0 ? addDays(monthRange(month).last, 1) : addDays(first, -1);
  return d.slice(0, 7);
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL: StatusKey[] = ['Present', 'Half Day', 'Absent', 'On Leave', 'Holiday', 'Weekly Off', 'Late'];

/** Month grid coloured by status (A4). Same colours and markers as every other screen. */
export function MonthCalendar({ days, month, today, basePath }: { days: MonthDay[]; month: string; today: ISODate; basePath: string }) {
  const lead = (dayOfWeek(days[0].date) + 6) % 7; // Monday-first grid
  return (
    <>
      <div className="row spread" style={{ marginBottom: 12 }}>
        <Link className="btn btn-secondary btn-sm" href={`${basePath}?month=${shiftMonth(month, -1)}`}>← Previous</Link>
        <strong>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
        <Link className="btn btn-secondary btn-sm" href={`${basePath}?month=${shiftMonth(month, 1)}`}>Next →</Link>
      </div>
      <div className="cal" role="grid" aria-label="Attendance calendar">
        {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} className="day blank" />)}
        {days.map(({ date, result, holidayName }) => {
          const future = date > today;
          const st = STATUS_STYLES[result.status === 'On Leave' ? 'On Leave' : result.status];
          const showStatus = !future || result.status === 'Holiday' || result.status === 'Weekly Off' || result.status === 'On Leave';
          return (
            <div key={date} role="gridcell" className={`day ${date === today ? 'today' : ''}`}
              style={showStatus ? { background: st.bg, color: st.fg } : { background: '#fff', border: '1px solid var(--line)' }}
              aria-label={`${date}: ${showStatus ? result.status : 'upcoming'}${result.isLate ? ', late' : ''}`}>
              <b>{Number(date.slice(8))}</b>
              {showStatus && <span>{st.icon} {result.status === 'On Leave' && result.halfLeave ? 'L ½' : st.code}</span>}
              {holidayName && showStatus && result.status === 'Holiday' && <span style={{ fontSize: 11 }}>{holidayName}</span>}
              {result.isLate && <span className="late" style={{ color: STATUS_STYLES.Late.fg }}>⏰ Late</span>}
              {result.missedPunch && <span className="late">Missed punch</span>}
            </div>
          );
        })}
      </div>
      <div className="legend" aria-label="Legend">{ALL.map((s) => <StatusBadge key={s} status={s} />)}</div>
    </>
  );
}
