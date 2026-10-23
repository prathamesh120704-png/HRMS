'use client';
import { useActionState, useState } from 'react';
import { Field, SelectField } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ACCRUAL_LABEL, ACCRUAL_METHODS } from '@/lib/validation/leaveType';
import type { ActionState } from '@/modules/employees/schema';
import { addLeaveTypeAction, updateLeaveTypeAction } from './actions';

export interface LeaveTypeValues {
  id?: string; code?: string; name?: string; annual_quota?: number; accrual_method?: string; carry_forward_max?: number; half_day_allowed?: boolean;
}

const ACCRUAL_OPTIONS = ACCRUAL_METHODS.map((m) => ({ value: m, label: ACCRUAL_LABEL[m] }));

/**
 * Edit one leave type, or add a new one (L1). The code is typed once when adding and can never be changed afterwards.
 * The checks shown here are the same rules the database function enforces, so a bypass still fails.
 */
export function LeaveTypeForm({ mode, type }: { mode: 'add' | 'edit'; type?: LeaveTypeValues }) {
  const [state, action] = useActionState<ActionState, FormData>(mode === 'add' ? addLeaveTypeAction : updateLeaveTypeAction, {});
  // The result of the LAST save must not linger once the person starts editing again: a stale green "Saved" next to a
  // changed field makes it look as if the new value was saved when it has not been submitted yet.
  const [dirty, setDirty] = useState(false);
  const e = dirty ? {} : (state.errors ?? {});
  const v = state.values ?? {};
  const val = (k: keyof LeaveTypeValues, fallback: string | number = '') => v[k as string] ?? (type?.[k] !== undefined ? String(type[k]) : String(fallback));
  const half = v.half_day_allowed !== undefined ? v.half_day_allowed === 'on' : (type?.half_day_allowed ?? false);

  return (
    <form action={action} noValidate onInput={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      {!dirty && state.message && <div className={`alert ${state.ok ? 'alert-ok' : 'alert-bad'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
      {mode === 'edit' && <input type="hidden" name="id" value={type?.id} />}
      <div className="grid g2">
        {mode === 'add' && (
          <Field label="Code" name="code" required defaultValue={val('code')} error={e.code} maxLength={6} style={{ textTransform: 'uppercase' }}
            hint="2 to 6 capital letters, for example CO. It cannot be changed later." />
        )}
        <Field label="Name" name="name" required defaultValue={val('name')} error={e.name} />
        <Field label="Annual quota (days)" name="annual_quota" type="number" required step="0.5" min="0" max="366" defaultValue={val('annual_quota', 0)} error={e.annual_quota}
          hint="In steps of 0.5" />
        <SelectField label="How it is earned" name="accrual_method" required defaultValue={val('accrual_method', 'upfront')} error={e.accrual_method} options={ACCRUAL_OPTIONS} />
        <Field label="Carry-forward limit (days)" name="carry_forward_max" type="number" required step="0.5" min="0" max="366" defaultValue={val('carry_forward_max', 0)} error={e.carry_forward_max}
          hint="0 means unused leave lapses on 31 December" />
      </div>
      <label className="row" style={{ marginBottom: 12 }}>
        <input type="checkbox" name="half_day_allowed" defaultChecked={half} style={{ width: 20, height: 20 }} />
        Half days allowed
      </label>
      <SubmitButton pendingLabel="Saving…">{mode === 'add' ? 'Add leave type' : 'Save changes'}</SubmitButton>
    </form>
  );
}
