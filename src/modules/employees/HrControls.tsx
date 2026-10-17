'use client';
import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { deactivateEmployeeAction, revealAction } from './actions';
import type { ActionState } from './schema';

/** Reveal for PAN or bank account. Confirms first, shows the value once, and the database logs it. Aadhaar has no Reveal. */
export function RevealButton({ employeeId, field, label }: { employeeId: string; field: 'pan' | 'account_number'; label: string }) {
  const [state, action] = useActionState<ActionState, FormData>(revealAction, {});
  const [confirming, setConfirming] = useState(false);
  if (state.revealed) {
    return <span className="alert alert-info" role="status" style={{ display: 'inline-block', margin: 0, padding: '4px 10px' }}>{state.revealed} <span className="hint">(logged)</span></span>;
  }
  if (!confirming) {
    return <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(true)}>Reveal {label}…</button>;
  }
  return (
    <form action={action} className="row" role="alertdialog" aria-label={`Confirm reveal ${label}`}>
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="field" value={field} />
      <span className="hint">This will be logged. Reveal {label}?</span>
      <SubmitButton pendingLabel="Revealing…">Reveal</SubmitButton>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
      {state.message && !state.ok && <span className="err">{state.message}</span>}
    </form>
  );
}

export function DeactivateForm({ employeeId, name }: { employeeId: string; name: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deactivateEmployeeAction, {});
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>Deactivate…</button>;
  return (
    <form action={action} className="card" role="alertdialog" aria-label="Deactivate employee">
      <input type="hidden" name="employee_id" value={employeeId} />
      <p><strong>Deactivate {name}</strong></p>
      <p className="hint">After the last working day they can no longer sign in. Their records are kept and never deleted.</p>
      <div className="field">
        <label htmlFor="lwd">Last working day *</label>
        <input id="lwd" name="last_working_day" type="date" required data-error={!!state.errors?.last_working_day} />
        {state.errors?.last_working_day && <div className="err" role="alert">⚠ {state.errors.last_working_day}</div>}
      </div>
      {state.message && <div className={`alert ${state.ok ? 'alert-ok' : 'alert-bad'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
      <div className="row">
        <SubmitButton variant="danger">Deactivate</SubmitButton>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Close</button>
      </div>
    </form>
  );
}
