import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/StatusBadge';
import { requireManagerOrHr } from '@/lib/auth/session';
import { formatDateIST, formatIST, todayIST } from '@/lib/time/ist';
import { decideLeaveAction, decideRegularisationAction } from '@/modules/approvals/actions';
import { DecisionForm } from '@/modules/approvals/DecisionForm';
import { pendingLeave, pendingRegularisations } from '@/modules/approvals/queries';

export default async function Approvals({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string }> }) {
  const s = await requireManagerOrHr();
  const f = await searchParams;
  const today = todayIST();
  const [leave, regs] = await Promise.all([pendingLeave(s.db, s.employee, today), pendingRegularisations(s.db, s.employee)]);
  const tab = f.tab === 'regularisation' ? 'regularisation' : 'leave';
  const range = (a: string, b: string) => (a === b ? formatDateIST(a) : `${formatDateIST(a)} – ${formatDateIST(b)}`);

  return (
    <>
      <PageHeader title="Approvals" sub={s.isHr ? 'Pending requests from everyone (you cannot decide your own)' : 'Pending requests from your direct reports'} />
      {f.done && <div className="alert alert-ok" role="status">Request {f.done}. The employee has been notified.</div>}

      <nav className="tabs" aria-label="Approval types">
        <Link href="/approvals" aria-current={tab === 'leave' ? 'page' : undefined}>Leave ({leave.length})</Link>
        <Link href="/approvals?tab=regularisation" aria-current={tab === 'regularisation' ? 'page' : undefined}>Regularisation ({regs.length})</Link>
      </nav>

      {tab === 'leave' && (leave.length === 0 ? (
        <Card><EmptyState title="Nothing waiting for your approval." hint="New leave requests from your team appear here." /></Card>
      ) : leave.map((r) => (
        <Card key={r.group} title={`${r.employee.name} · ${r.parts.map((p) => `${p.code} ${p.days}`).join(' + ')} day${r.totalDays === 1 ? '' : 's'}`}
          action={<span className="hint">{r.employee.code}{!r.isTeamManager && ' · not your direct report'}</span>}>
          <p style={{ margin: '0 0 8px' }}>{range(r.from, r.to)}{r.parts.some((p) => p.half) && ' (half day)'}</p>
          <p className="hint" style={{ margin: '0 0 12px' }}>Reason: {r.reason}</p>
          {r.balance && (
            <div className="alert alert-info">
              {r.balance.code} balance: <strong>{r.balance.before.toFixed(1)}</strong> before this request → <strong>{r.balance.after.toFixed(1)}</strong> after approval
              <span className="hint" style={{ color: 'inherit' }}> (the days are already held while pending)</span>
            </div>
          )}
          {r.parts.some((p) => p.code === 'LOP') && <div className="alert alert-info">Part of this request is Loss of Pay (the employee ran out of balance).</div>}
          {r.clashWith.length > 0 && <div className="alert" style={{ background: '#FEF3C7', color: '#78350F' }} role="status">⚠ Clash: {r.clashWith.join(', ')} {r.clashWith.length === 1 ? 'is' : 'are'} also away in these dates.</div>}
          {r.certificate && <p><a href={`/api/certificate?path=${encodeURIComponent(r.certificate)}`} target="_blank" rel="noreferrer">View medical certificate</a> <span className="hint">(secure link, expires in 60 seconds)</span></p>}
          <DecisionForm id={r.group} action={decideLeaveAction} subject={`${r.employee.name}'s leave`} />
        </Card>
      )))}

      {tab === 'regularisation' && (regs.length === 0 ? (
        <Card><EmptyState title="No attendance corrections waiting." /></Card>
      ) : regs.map((r) => (
        <Card key={r.id} title={`${r.employee.name} · ${formatDateIST(r.date)}`} action={<Pill tone="warn">Missed punch</Pill>}>
          <dl className="kv" style={{ marginBottom: 12 }}>
            <dt>Recorded</dt><dd>In {r.recordedIn ? formatIST(r.recordedIn, 'hh:mm a') : '—'} · Out {r.recordedOut ? formatIST(r.recordedOut, 'hh:mm a') : '—'}</dd>
            <dt>Requested</dt><dd>In {r.requestedIn ? formatIST(r.requestedIn, 'hh:mm a') : '—'} · Out {r.requestedOut ? formatIST(r.requestedOut, 'hh:mm a') : '—'} (IST)</dd>
            <dt>Reason</dt><dd>{r.reason}</dd>
          </dl>
          <p className="hint">Attendance changes only if you approve.</p>
          <DecisionForm id={r.id} action={decideRegularisationAction} subject={`${r.employee.name}'s correction`} />
        </Card>
      )))}
    </>
  );
}
