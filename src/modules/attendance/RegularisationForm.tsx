'use client';
import { useActionState } from 'react';
import { Field } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { submitRegularisationAction } from './actions';
import type { ActionState } from '@/modules/employees/schema';

export function RegularisationForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitRegularisationAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      {state.message && <div className={`alert ${state.ok ? 'alert-ok' : 'alert-bad'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
      <div className="grid g3">
        <Field label="Date" name="date" type="date" required defaultValue={defaultDate} error={e.date} />
        <Field label="In time (IST)" name="requested_in" type="time" required defaultValue="09:30" error={e.requested_in} />
        <Field label="Out time (IST)" name="requested_out" type="time" required defaultValue="18:00" error={e.requested_out} />
      </div>
      <Field label="Reason" name="reason" required error={e.reason} placeholder="e.g. Forgot to check out" />
      <SubmitButton pendingLabel="Sending…">Request correction</SubmitButton>
    </form>
  );
}
