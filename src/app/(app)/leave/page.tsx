import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { BalanceTile } from '@/components/ui/BalanceTile';
import { Pill } from '@/components/ui/StatusBadge';
import { requireEmployee } from '@/lib/auth/session';
import { formatDateIST, todayIST } from '@/lib/time/ist';
import { cancelLeaveAction, toggleOptionalHolidayAction } from '@/modules/leave/actions';
import { balancesFor, myRequests, optionalHolidays, type LeaveRequestRow } from '@/modules/leave/queries';

const num = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));
const TONE = { pending: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'neutral' } as const;

export default async function MyLeave({ searchParams }: { searchParams: Promise<{ submitted?: string; cancelled?: string; error?: string }> }) {
  const s = await requireEmployee();
  const f = await searchParams;
  const today = todayIST();
  const year = Number(today.slice(0, 4));
  const [balances, requests, optional] = await Promise.all([
    balancesFor(s.db, s.employee, year, today), myRequests(s.db, s.employee.id), optionalHolidays(s.db, s.employee, year),
  ]);
  const cards = balances.filter((b) => b.type.accrualMethod !== 'none');
  const pickedCount = optional.filter((o) => o.picked).length;
  const canCancel = (r: LeaveRequestRow) => r.status === 'pending' || (r.status === 'approved' && r.from_date > today);

  return (
    <>
      <PageHeader title="My leave" sub={`${year} · opening, accrued, used, pending and available`}
        action={<Link className="btn" href="/leave/apply">Apply leave</Link>} />
      {f.submitted && <div className="alert alert-ok" role="status">Request submitted. Your manager has been notified.</div>}
      {f.cancelled && <div className="alert alert-ok" role="status">Request cancelled and your balance restored.</div>}
      {f.error && <div className="alert alert-bad" role="alert">{f.error}</div>}

      <div className="tiles" style={{ marginBottom: 16 }}>
        {cards.map(({ type, balance: b }) => (
          <BalanceTile
            key={type.code} code={type.code} name={type.name} available={b.available} total={b.opening + b.adjustment + b.accrued}
            detail={`opening ${num(b.opening)} · accrued ${num(b.accrued)} · used ${num(b.used)} · pending ${num(b.pending)}`}
          />
        ))}
      </div>

      <Card title="Requests">
        {requests.length === 0 ? (
          <EmptyState title="No leave requests yet." hint="Apply for leave to see it here." />
        ) : (
          <table className="stack">
            <thead><tr><th>Type</th><th>Dates</th><th className="num">Days</th><th>Status</th><th>Note</th><th /></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td data-label="Type">{r.leave_types?.code}{r.is_half_day && ' (½)'}</td>
                  <td data-label="Dates">{formatDateIST(r.from_date)}{r.to_date !== r.from_date && ` – ${formatDateIST(r.to_date)}`}</td>
                  <td data-label="Days" className="num">{Number(r.days)}</td>
                  <td data-label="Status"><Pill tone={TONE[r.status]}>{r.status}</Pill></td>
                  <td data-label="Note">{r.approver_comment ?? (r.attachment_path ? 'Certificate attached' : '')}</td>
                  <td>
                    {canCancel(r) && (
                      <form action={cancelLeaveAction}>
                        <input type="hidden" name="group" value={r.request_group_id} />
                        <button className="btn btn-secondary btn-sm" title="Cancels the whole request, including any linked Loss of Pay days">Cancel</button>
                      </form>
                    )}
                    {r.status === 'approved' && r.from_date <= today && <span className="hint">started</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={`Optional holidays ${year}`}>
        <p className="hint" style={{ marginBottom: 12 }}>Pick up to 2. An optional holiday you don&apos;t pick is a normal working day. {pickedCount} of 2 chosen.</p>
        {optional.length === 0 ? <EmptyState title="No optional holidays for your location this year." /> : (
          <div>
            {optional.map((o) => (
              <form key={o.id} action={toggleOptionalHolidayAction} className="row spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <input type="hidden" name="holiday" value={o.id} />
                <input type="hidden" name="pick" value={o.picked ? '0' : '1'} />
                <span>{o.name} <span className="hint">· {formatDateIST(o.date)}</span></span>
                <button className="btn btn-secondary btn-sm" disabled={!o.picked && pickedCount >= 2}>{o.picked ? 'Drop' : 'Pick'}</button>
              </form>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
