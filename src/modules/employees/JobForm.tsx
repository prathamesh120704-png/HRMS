'use client';
import { useActionState } from 'react';
import { Field, SelectField } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { updateEmployeeAction } from './actions';
import type { ActionState } from './schema';

interface Opt { value: string; label: string }

export function JobForm({ employee, departments, locations, managers }: {
  employee: {
    id: string; full_name: string; designation: string; department_id: string; location_id: string;
    reporting_manager_id: string | null; salary_grade: string | null; is_hr_admin: boolean;
  };
  departments: Opt[]; locations: Opt[]; managers: Opt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateEmployeeAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} noValidate>
      <input type="hidden" name="employee_id" value={employee.id} />
      {state.message && <div className={`alert ${state.ok ? 'alert-ok' : 'alert-bad'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
      <div className="grid g2">
        <Field label="Full name" name="full_name" required defaultValue={v.full_name ?? employee.full_name} error={e.full_name} />
        <Field label="Designation" name="designation" required defaultValue={v.designation ?? employee.designation} error={e.designation} />
        <SelectField label="Department" name="department_id" required defaultValue={v.department_id ?? employee.department_id} error={e.department_id} options={departments} />
        <SelectField label="Location" name="location_id" required defaultValue={v.location_id ?? employee.location_id} error={e.location_id} options={locations} />
        <SelectField label="Reporting manager" name="reporting_manager_id" placeholder="None (top of the chart)"
          defaultValue={v.reporting_manager_id ?? employee.reporting_manager_id ?? ''} error={e.reporting_manager_id} options={managers} />
        <Field label="Salary grade" name="salary_grade" defaultValue={v.salary_grade ?? employee.salary_grade ?? ''} error={e.salary_grade} />
      </div>
      <label className="row" style={{ marginBottom: 12 }}>
        <input type="checkbox" name="is_hr_admin" defaultChecked={employee.is_hr_admin} style={{ width: 20, height: 20 }} />
        HR Admin
      </label>

      <details style={{ marginBottom: 16 }}>
        <summary>Replace statutory or bank details (leave blank to keep the current values)</summary>
        <div className="grid g2" style={{ marginTop: 12 }}>
          <Field label="New PAN" name="pan" maxLength={10} style={{ textTransform: 'uppercase' }} error={e.pan} autoComplete="off" />
          <Field label="New Aadhaar" name="aadhaar" type="password" inputMode="numeric" maxLength={14} error={e.aadhaar} autoComplete="off" />
          <Field label="New UAN" name="uan" inputMode="numeric" error={e.uan} />
          <Field label="New account number" name="account_number" inputMode="numeric" error={e.account_number} autoComplete="off" />
          <Field label="New IFSC" name="ifsc" maxLength={11} style={{ textTransform: 'uppercase' }} error={e.ifsc} />
          <Field label="Bank name" name="bank_name" error={e.bank_name} />
        </div>
      </details>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
