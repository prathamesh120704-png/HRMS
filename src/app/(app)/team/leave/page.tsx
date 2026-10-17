import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { requireManagerOrHr } from '@/lib/auth/session';
import { dayOfWeek, eachDate, monthRange, todayIST } from '@/lib/time/ist';
import { shiftMonth } from '@/modules/attendance/MonthCalendar';
import { teamLeaveInMonth } from '@/modules/approvals/queries';
import { STATUS_STYLES } from '@/components/ui/statusStyles';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** L7: team leave on a month calendar, with days where two or more people are away marked as clashes. */
export default async function LeaveCalendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireManagerOrHr();
  const today = todayIST();
  const { month: m } = await searchParams;
  const month = m && MONTH.test(m) ? m : today.slice(0, 7);
  const { first, last } = monthRange(month);
  const leave = await teamLeaveInMonth(s.db, first, last);
  const lead = (dayOfWeek(first) + 6) % 7;
  const st = STATUS_STYLES['On Leave'];

  return (
    <>
      <PageHeader title="Team leave calendar" sub={s.isHr ? 'All employees' : 'Your direct reports'} />
      <Card>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <Link className="btn btn-secondary btn-sm" href={`/team/leave?month=${shiftMonth(month, -1)}`}>← Previous</Link>
          <strong>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
          <Link className="btn btn-secondary btn-sm" href={`/team/leave?month=${shiftMonth(month, 1)}`}>Next →</Link>
        </div>
        <div className="cal" role="grid" aria-label="Team leave calendar">
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} className="day blank" />)}
          {eachDate(first, last).map((date) => {
            const away = leave.filter((l) => date >= l.from && date <= l.to);
            const clash = new Set(away.map((a) => a.employeeId)).size >= 2;
            return (
              <div key={date} role="gridcell" className={`day ${date === today ? 'today' : ''}`}
                style={{ background: away.length ? st.bg : '#fff', color: away.length ? st.fg : 'inherit', border: clash ? '2px solid #B45309' : '1px solid var(--line)' }}
                aria-label={`${date}: ${away.length ? away.map((a) => a.name).join(', ') : 'nobody away'}${clash ? ' (clash)' : ''}`}>
                <b>{Number(date.slice(8))}{clash && ' ⚠'}</b>
                {away.slice(0, 3).map((a) => (
                  <span key={`${a.employeeId}-${a.from}`} style={{ fontSize: 11, opacity: a.status === 'pending' ? 0.7 : 1 }}>
                    {a.name.split(' ')[0]} {a.code}{a.half ? ' ½' : ''}{a.status === 'pending' ? ' (pending)' : ''}
                  </span>
                ))}
                {away.length > 3 && <span style={{ fontSize: 11 }}>+{away.length - 3} more</span>}
              </div>
            );
          })}
        </div>
        <div className="legend"><StatusBadge status="On Leave" /><span className="hint">⚠ and an orange border: two or more people away the same day</span></div>
        <p className="hint" style={{ marginTop: 8 }}>Today is {today}. Pending requests are shown faded.</p>
      </Card>
    </>
  );
}

