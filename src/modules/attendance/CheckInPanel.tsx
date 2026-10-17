'use client';
import { useActionState } from 'react';
import { checkInAction, checkOutAction } from './actions';
import type { ActionState } from '@/modules/employees/schema';

/** Check in / WFH / Check out (A1, A3). Times shown here are pre-formatted IST strings from the server. */
export function CheckInPanel({ phase, checkedInAt, checkedOutAt, blockedReason }: {
  phase: 'before' | 'in' | 'done';
  checkedInAt?: string;
  checkedOutAt?: string;
  blockedReason?: string;
}) {
  const [inState, inAction, inPending] = useActionState<ActionState, FormData>(checkInAction, {});
  const [outState, outAction, outPending] = useActionState<ActionState>(checkOutAction, {});
  const err = inState.message ?? outState.message;

  return (
    <div>
      {blockedReason && <p className="hint">{blockedReason}</p>}
      {phase === 'before' && (
        <form action={inAction} className="row" style={{ gap: 8 }}>
          <button className="btn btn-big" name="wfh" value="0" disabled={inPending}>{inPending ? 'Checking in…' : 'Check in'}</button>
          <button className="btn btn-secondary btn-big" name="wfh" value="1" disabled={inPending}>Work from home</button>
        </form>
      )}
      {phase === 'in' && (
        <>
          <p className="hint" style={{ marginBottom: 8 }}>Checked in at {checkedInAt} IST</p>
          <form action={outAction}><button className="btn btn-big" style={{ width: '100%' }} disabled={outPending}>{outPending ? 'Checking out…' : 'Check out'}</button></form>
        </>
      )}
      {phase === 'done' && <p className="hint">In {checkedInAt} · Out {checkedOutAt} IST</p>}
      {err && <div className="alert alert-bad" role="alert" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
