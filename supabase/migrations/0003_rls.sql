-- Row-level security (ARCHITECTURE.md section 4.3).
-- Reads: policies below. Writes: NONE for anon/authenticated; they must call the functions in 0002.

do $$
declare t text;
begin
  foreach t in array array[
    'locations','departments','employees','employee_statutory','employee_bank','holidays','employee_optional_holidays',
    'attendance','regularisation_requests','leave_types','leave_balances','leave_requests','policy_documents',
    'audit_log','agent_log','agent_drafts','email_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;

-- Reference data: any signed-in, active employee.
create policy ref_locations on locations for select to authenticated using (current_employee_id() is not null);
create policy ref_departments on departments for select to authenticated using (current_employee_id() is not null);
create policy ref_holidays on holidays for select to authenticated using (current_employee_id() is not null);
create policy ref_leave_types on leave_types for select to authenticated using (current_employee_id() is not null);
create policy ref_policy on policy_documents for select to authenticated using (current_employee_id() is not null);

-- employees: self, HR, or the employee's manager (direct reports).
create policy employees_read on employees for select to authenticated using (
  id = current_employee_id() or is_hr() or reporting_manager_id = current_employee_id()
);

-- Statutory and bank: owner and HR only. The manager does NOT get these.
create policy statutory_read on employee_statutory for select to authenticated using (
  employee_id = current_employee_id() or is_hr()
);
create policy bank_read on employee_bank for select to authenticated using (
  employee_id = current_employee_id() or is_hr()
);

create policy optional_read on employee_optional_holidays for select to authenticated using (
  employee_id = current_employee_id() or is_hr() or is_manager_of(employee_id)
);

create policy attendance_read on attendance for select to authenticated using (
  employee_id = current_employee_id() or is_hr() or is_manager_of(employee_id)
);
create policy regularisation_read on regularisation_requests for select to authenticated using (
  employee_id = current_employee_id() or is_hr() or is_manager_of(employee_id)
);
create policy balances_read on leave_balances for select to authenticated using (
  employee_id = current_employee_id() or is_hr() or is_manager_of(employee_id)
);
create policy leave_read on leave_requests for select to authenticated using (
  employee_id = current_employee_id() or is_hr() or is_manager_of(employee_id)
);

create policy audit_hr_read on audit_log for select to authenticated using (is_hr());
create policy agent_log_read on agent_log for select to authenticated using (
  employee_id = current_employee_id() or is_hr()
);
create policy agent_drafts_read on agent_drafts for select to authenticated using (employee_id = current_employee_id());
create policy email_log_read on email_log for select to authenticated using (
  to_employee_id = current_employee_id() or is_hr()
);

-- Functions: callable by signed-in users only; the role check is inside each function.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  ist_today(), current_employee_id(), is_hr(), is_manager_of(uuid), link_clerk_user(),
  check_in(boolean), check_out(), submit_regularisation(date, timestamptz, timestamptz, text),
  decide_regularisation(uuid, boolean, text), leave_available(uuid, uuid, int, date), ensure_balances(uuid, int),
  leave_count_days(uuid, date, date, boolean, boolean),
  submit_leave(text, date, date, boolean, text, text, boolean), decide_leave(uuid, boolean, text), cancel_leave(uuid),
  update_my_contact(text, text, text, text, text, text, text, text),
  hr_create_employee(jsonb), hr_update_employee(uuid, jsonb), hr_deactivate_employee(uuid, date),
  hr_reveal(uuid, text), pick_optional_holiday(uuid), unpick_optional_holiday(uuid)
to authenticated;

-- Storage: private bucket for medical certificates. Path = {employee_id}/{request_group_id}/{file}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leave-certificates', 'leave-certificates', false, 2097152, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy certs_read on storage.objects for select to authenticated using (
  bucket_id = 'leave-certificates'
  and ((storage.foldername(name))[1] = current_employee_id()::text
       or is_hr() or is_manager_of(((storage.foldername(name))[1])::uuid))
);
create policy certs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'leave-certificates' and (storage.foldername(name))[1] = current_employee_id()::text
);
