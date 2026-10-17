'use client';
import { useActionState, useEffect, useState } from 'react';
import { Field, SelectField } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { INDIAN_STATES } from '@/lib/validation/indian';
import { createEmployeeAction } from './actions';
import type { ActionState } from './schema';

interface Opt { value: string; label: string }

const STEPS = ['Personal', 'Job', 'Statutory', 'Bank'] as const;
const FIELD_STEP: Record<string, number> = {
  full_name: 0, email: 0, mobile: 0, dob: 0, gender: 0, address_line: 0, city: 0, state: 0, pin: 0,
  emergency_name: 0, emergency_relation: 0, emergency_phone: 0,
  date_of_joining: 1, designation: 1, department_id: 1, location_id: 1, reporting_manager_id: 1, salary_grade: 1, is_hr_admin: 1,
  pan: 2, aadhaar: 2, uan: 2, account_number: 3, ifsc: 3, bank_name: 3,
};

/** Multi-step add-employee form (DESIGN.md 2.4). All steps stay in the DOM so one submit sends everything. */
export function EmployeeForm({ departments, locations, managers }: { departments: Opt[]; locations: Opt[]; managers: Opt[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createEmployeeAction, {});
  const [step, setStep] = useState(0);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    const steps = Object.keys(e).map((k) => FIELD_STEP[k]).filter((n) => n !== undefined);
    if (steps.length) setStep(Math.min(...steps));
  }, [state.errors]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepHasError = (i: number) => Object.keys(e).some((k) => FIELD_STEP[k] === i);
  const show = (i: number) => ({ hidden: step !== i });

  return (
    <form action={action} noValidate>
      <ol className="steps" style={{ listStyle: 'none', padding: 0 }}>
        {STEPS.map((s, i) => (
          <li key={s} className="step" aria-current={step === i ? 'step' : undefined} data-error={stepHasError(i)}>
            {i + 1}. {s}{stepHasError(i) && ' ⚠'}
          </li>
        ))}
      </ol>
      {state.message && !state.ok && <div className="alert alert-bad" role="alert">{state.message}</div>}

      <fieldset {...show(0)} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid g2">
          <Field label="Full name" name="full_name" required defaultValue={v.full_name} error={e.full_name} autoComplete="off" />
          <Field label="Work email" name="email" type="email" required defaultValue={v.email} error={e.email} hint="They sign in with this email." />
          <Field label="Mobile" name="mobile" required inputMode="tel" defaultValue={v.mobile} error={e.mobile} hint="10 digits starting with 6, 7, 8 or 9" />
          <Field label="Date of birth" name="dob" type="date" required defaultValue={v.dob} error={e.dob} />
          <SelectField label="Gender" name="gender" required placeholder="Select…" defaultValue={v.gender ?? ''} error={e.gender}
            options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }]} />
          <Field label="Address" name="address_line" defaultValue={v.address_line} error={e.address_line} />
          <Field label="City" name="city" defaultValue={v.city} error={e.city} />
          <SelectField label="State / UT" name="state" required placeholder="Select…" defaultValue={v.state ?? ''} error={e.state}
            options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
          <Field label="PIN code" name="pin" required inputMode="numeric" defaultValue={v.pin} error={e.pin} hint="6 digits" />
          <Field label="Emergency contact name" name="emergency_name" defaultValue={v.emergency_name} error={e.emergency_name} />
          <Field label="Relationship" name="emergency_relation" defaultValue={v.emergency_relation} error={e.emergency_relation} />
          <Field label="Emergency contact mobile" name="emergency_phone" inputMode="tel" defaultValue={v.emergency_phone} error={e.emergency_phone} />
        </div>
      </fieldset>

      <fieldset {...show(1)} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid g2">
          <Field label="Date of joining" name="date_of_joining" type="date" required defaultValue={v.date_of_joining} error={e.date_of_joining} />
          <Field label="Designation" name="designation" required defaultValue={v.designation} error={e.designation} />
          <SelectField label="Department" name="department_id" required placeholder="Select…" defaultValue={v.department_id ?? ''} error={e.department_id} options={departments} />
          <SelectField label="Location" name="location_id" required placeholder="Select…" defaultValue={v.location_id ?? ''} error={e.location_id} options={locations}
            hint="Decides weekly offs and holidays" />
          <SelectField label="Reporting manager" name="reporting_manager_id" placeholder="None (top of the chart)" defaultValue={v.reporting_manager_id ?? ''} error={e.reporting_manager_id} options={managers} />
          <Field label="Salary grade" name="salary_grade" defaultValue={v.salary_grade} error={e.salary_grade} />
        </div>
        <label className="row" style={{ marginBottom: 12 }}>
          <input type="checkbox" name="is_hr_admin" defaultChecked={v.is_hr_admin === 'on'} style={{ width: 20, height: 20 }} />
          HR Admin (can manage all employees)
        </label>
      </fieldset>

      <fieldset {...show(2)} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid g2">
          <Field label="PAN" name="pan" required defaultValue={v.pan} error={e.pan} style={{ textTransform: 'uppercase' }} maxLength={10} hint="Format ABCDE1234F" autoComplete="off" />
          <Field label="Aadhaar" name="aadhaar" type="password" required inputMode="numeric" error={e.aadhaar} maxLength={14} hint="12 digits. Shown later only as XXXX XXXX 1234." autoComplete="off" />
          <Field label="UAN (optional)" name="uan" inputMode="numeric" defaultValue={v.uan} error={e.uan} hint="12 digits. Add later if they don't have one yet." />
        </div>
      </fieldset>

      <fieldset {...show(3)} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid g2">
          <Field label="Account number" name="account_number" required inputMode="numeric" defaultValue={v.account_number} error={e.account_number} autoComplete="off" />
          <Field label="IFSC" name="ifsc" required defaultValue={v.ifsc} error={e.ifsc} style={{ textTransform: 'uppercase' }} maxLength={11} hint="e.g. HDFC0001234" />
          <Field label="Bank name" name="bank_name" required defaultValue={v.bank_name} error={e.bank_name} />
        </div>
      </fieldset>

      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < STEPS.length - 1
          ? <button type="button" className="btn" onClick={() => setStep(step + 1)}>Next</button>
          : <SubmitButton pendingLabel="Saving…">Save employee</SubmitButton>}
      </div>
    </form>
  );
}
