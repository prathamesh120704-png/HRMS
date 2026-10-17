import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { requireManagerOrHr } from '@/lib/auth/session';
import { formatDateIST, formatIST, todayIST } from '@/lib/time/ist';
import { teamToday } from '@/modules/attendance/queries';

export default async function TeamAttendance() {
  const s = await requireManagerOrHr();
  const today = todayIST();
  // Managers: direct reports only. The database policy enforces this too, so a bug here cannot widen it.
  const rows = await teamToday(s.db, s.isHr ? {} : { managerId: s.employee.id }, today);
  return (
    <>
      <PageHeader title="Team attendance" sub={`${formatDateIST(today)} · ${s.isHr ? 'all employees' : 'your direct reports'}`} />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No direct reports yet." hint="People who report to you appear here." />
        ) : (
          <table className="stack">
            <thead><tr><th>Name</th><th>Status</th><th>In</th><th>Out</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Name">{r.name}<div className="hint">{r.code} · {r.designation}</div></td>
                  <td data-label="Status">
                    {r.status === 'Not yet in' ? <span className="pill pill-neutral">Not yet in</span> : <StatusBadge status={r.status} />}
                    {r.isLate && <> <StatusBadge status="Late" /></>}
                    {r.wfh && <span className="hint"> · WFH</span>}
                  </td>
                  <td data-label="In">{r.checkIn ? formatIST(r.checkIn, 'hh:mm a') : '—'}</td>
                  <td data-label="Out">{r.checkOut ? formatIST(r.checkOut, 'hh:mm a') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
