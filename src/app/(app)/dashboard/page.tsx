import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { BalanceTile } from '@/components/ui/BalanceTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { requireEmployee } from '@/lib/auth/session';
import { formatDateIST, formatIST, todayIST } from '@/lib/time/ist';
import { CheckInPanel } from '@/modules/attendance/CheckInPanel';
import { monthWithSummary, todayRecord, teamToday } from '@/modules/attendance/queries';
import { balanceCards } from '@/modules/leave/queries';

export default async function Dashboard() {
  const s = await requireEmployee();
  const today = todayIST();
  const e = s.employee;

  const [rec, monthData, cards, team] = await Promise.all([
    todayRecord(s.db, e.id, today),
    monthWithSummary(s.db, e, today.slice(0, 7), today),
    balanceCards(s.db, e, Number(today.slice(0, 4)), today),
    s.isManager || s.isHr ? teamToday(s.db, s.isHr ? {} : { managerId: e.id }, today) : Promise.resolve(null),
  ]);

  const pendingCount = s.isManager || s.isHr
    ? ((await s.db.from('leave_requests').select('request_group_id', { count: 'exact', head: true }).eq('status', 'pending').neq('employee_id', e.id)).count ?? 0)
      + ((await s.db.from('regularisation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').neq('employee_id', e.id)).count ?? 0)
    : 0;

  const month = monthData.days;
  const sum = monthData.summary;
  const leaveDays = Object.values(sum.leaveByType).reduce((a, b) => a + b, 0);
  const n = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));
  const day = month.find((d) => d.date === today)!;
  const offDay = day.result.status === 'Holiday' || day.result.status === 'Weekly Off';
  const phase = rec?.check_out ? 'done' : rec?.check_in ? 'in' : 'before';
  const label = offDay ? day.result.status : phase === 'before' ? 'Not checked in' : phase === 'in' ? 'Checked in' : day.result.status;
  const count = (k: string) => team?.filter((t) => t.status === k).length ?? 0;

  return (
    <>
      <PageHeader title={`Hello, ${e.full_name.split(' ')[0]}`} sub={`${formatDateIST(today)} · IST`} />
      <div className="grid g-today">
        <Card title="Today">
          <p style={{ marginBottom: 12 }}>
            Status:{' '}
            {offDay || phase === 'done'
              ? <StatusBadge status={day.result.status} />
              : <span className="pill pill-neutral">{label}</span>}
            {rec?.is_late && <> <StatusBadge status="Late" /></>}
            {rec?.is_wfh && <span className="hint"> · Work from home</span>}
          </p>
          <CheckInPanel
            phase={phase}
            checkedInAt={rec?.check_in ? formatIST(rec.check_in, 'hh:mm a') : undefined}
            checkedOutAt={rec?.check_out ? formatIST(rec.check_out, 'hh:mm a') : undefined}
            blockedReason={offDay ? `Today is a ${day.result.status === 'Holiday' ? 'holiday' : 'weekly off'} at your location. You can still punch in if you work.` : undefined}
          />
        </Card>
        <Card title="Leave balance" action={<Link className="btn btn-secondary btn-sm" href="/leave">Details</Link>}>
          {cards.length === 0 ? (
            <EmptyState title="Your leave balance isn't set up yet." hint="Contact HR." />
          ) : (
            <div className="tiles">
              {cards.map((c) => (
                <BalanceTile key={c.code} code={c.code} name={c.name} available={c.available} total={c.granted} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="This month so far">
        <div className="mini">
          <div><b>{n(sum.present)}</b><span>Days present</span></div>
          <div><b>{n(leaveDays)}</b><span>Days on leave</span></div>
          <div><b>{n(sum.lateCount)}</b><span>Late marks</span></div>
          <div><b>{n(sum.lop)}</b><span>Loss of pay days</span></div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Counted through yesterday, with the same rules as the month-end report. Every 3 Late marks count as half a day of Loss of Pay.
        </p>
      </Card>

      {(s.isManager || s.isHr) && (
        <Card title="Approvals">
          {pendingCount === 0 ? <p className="hint">Nothing waiting for your approval.</p> : (
            <p><Link className="btn btn-sm" href="/approvals">{pendingCount} request{pendingCount === 1 ? '' : 's'} waiting</Link></p>
          )}
        </Card>
      )}

      {team && (
        <Card title={s.isHr ? 'Everyone today' : 'My team today'}>
          {team.length === 0 ? <EmptyState title="No direct reports yet." /> : (
            <div className="row">
              <StatusBadge status="Present" label={`Present ${count('Present') + count('Half Day')}`} />
              <StatusBadge status="On Leave" label={`On leave ${count('On Leave')}`} />
              <StatusBadge status="Absent" label={`Absent ${count('Absent')}`} />
              <span className="pill pill-neutral">Not yet in {count('Not yet in')}</span>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

