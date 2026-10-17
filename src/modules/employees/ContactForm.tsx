'use client';
import { useActionState } from 'react';
import { Field, SelectField } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { INDIAN_STATES } from '@/lib/validation/indian';
import { updateMyContactAction } from './actions';
import type { ActionState } from './schema';

/** Self-service edit (E5): phone, address, emergency contact. Job fields are not part of this form. */
export function ContactForm({ employee }: {
  employee: {
    mobile: string; address_line: string | null; city: string | null; state: string | null; pin: string | null;
    emergency_name: string | null; emergency_relation: string | null; emergency_phone: string | null;
  };
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateMyContactAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const val = (k: keyof typeof employee) => v[k] ?? employee[k] ?? '';
  return (
    <form action={action} noValidate>
      {state.message && <div className={`alert ${state.ok ? 'alert-ok' : 'alert-bad'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
      <div className="grid g2">
        <Field label="Mobile" name="mobile" required inputMode="tel" defaultValue={val('mobile')} error={e.mobile} hint="10 digits starting with 6, 7, 8 or 9" />
        <Field label="Address" name="address_line" defaultValue={val('address_line')} error={e.address_line} />
        <Field label="City" name="city" defaultValue={val('city')} error={e.city} />
        <SelectField label="State / UT" name="state" placeholder="Select…" defaultValue={val('state')} error={e.state}
          options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
        <Field label="PIN code" name="pin" inputMode="numeric" defaultValue={val('pin')} error={e.pin} />
        <Field label="Emergency contact name" name="emergency_name" defaultValue={val('emergency_name')} error={e.emergency_name} />
        <Field label="Relationship" name="emergency_relation" defaultValue={val('emergency_relation')} error={e.emergency_relation} />
        <Field label="Emergency contact mobile" name="emergency_phone" inputMode="tel" defaultValue={val('emergency_phone')} error={e.emergency_phone} />
      </div>
      <SubmitButton>Save contact details</SubmitButton>
    </form>
  );
}
