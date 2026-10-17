'use client';
import { useActionState } from 'react';
import { Field, SelectField } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { addHolidayAction } from './actions';
import type { ActionState } from '@/modules/employees/schema';

export function HolidayForm({ locations }: { locations: { value: string; label: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addHolidayAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      {state.message && <div className={`alert ${state.ok ? 'alert-ok' : 'alert-bad'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
      <div className="grid g4">
        <SelectField label="Location" name="location_id" required placeholder="Select…" options={locations} error={e.location_id} />
        <Field label="Date" name="date" type="date" required error={e.date} />
        <Field label="Name" name="name" required error={e.name} />
        <SelectField label="Type" name="type" required placeholder="Select…" error={e.type}
          options={[{ value: 'National', label: 'National' }, { value: 'State', label: 'State' }, { value: 'Optional', label: 'Optional' }]} />
      </div>
      <SubmitButton pendingLabel="Adding…">Add holiday</SubmitButton>
    </form>
  );
}
