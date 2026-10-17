'use client';
import { useActionState } from 'react';
import type { ActionState } from '@/modules/employees/schema';

/** Comment + Approve / Reject. Reject needs a comment (the server enforces it too). Buttons are visually distinct. */
export function DecisionForm({ id, action, subject }: {
  id: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  subject: string;
}) {
  const [state, run, pending] = useActionState<ActionState, FormData>(action, {});
  const e = state.errors ?? {};
  return (
    <form action={run} noValidate aria-label={`Decide ${subject}`}>
      <input type="hidden" name="id" value={id} />
      {state.message && <div className="alert alert-bad" role="alert">{state.message}</div>}
      <div className="field">
        <label htmlFor={`c-${id}`}>Comment</label>
        <input id={`c-${id}`} name="comment" placeholder="Required if rejecting" maxLength={500} data-error={!!e.comment} aria-invalid={!!e.comment} />
        {e.comment && <div className="err" role="alert">⚠ {e.comment}</div>}
      </div>
      <div className="row">
        <button className="btn btn-secondary" name="decision" value="reject" disabled={pending}>Reject</button>
        <button className="btn" name="decision" value="approve" disabled={pending}>{pending ? 'Saving…' : 'Approve'}</button>
      </div>
    </form>
  );
}
