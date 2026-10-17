-- Role-checking write functions (ARCHITECTURE.md section 4.2). The `authenticated` role has NO direct write
-- access to business tables (see 0003_rls.sql); every write goes through one of these functions, which
-- identify the caller from the JWT and re-check the role inside.
--
-- NOTE: working-day counting and leave accrual exist here (SQL) and in src/lib/domain (TypeScript). The SQL
-- copy exists so a caller cannot submit fake `days`, and so the balance check is atomic with the insert.
-- Keep them identical; tests/db/parity.md lists the cases to compare against.

create function ist_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

create function current_employee_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from employees
  where clerk_user_id = (auth.jwt() ->> 'sub')
    and status = 'active'
    and (last_working_day is null or last_working_day >= ist_today())
$$;

create function is_hr() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_hr_admin from employees where id = current_employee_id()), false)
$$;

create function is_manager_of(target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = target and reporting_manager_id = current_employee_id())
$$;

create function require_employee() returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid := current_employee_id();
begin
  if v is null then raise exception 'Access denied' using errcode = '42501'; end if;
  return v;
end $$;

create function require_hr() returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid := require_employee();
begin
  if not is_hr() then raise exception 'HR Admin only' using errcode = '42501'; end if;
  return v;
end $$;

-- A request can be decided by the employee's reporting manager or any HR Admin, never by the requester (R34).
create function can_decide_for(target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select current_employee_id() is not null
     and current_employee_id() <> target
     and (is_hr() or is_manager_of(target))
$$;

-- --------------------------------------------------------------- login link

create function link_clerk_user() returns uuid language plpgsql security definer set search_path = public as $$
declare v_sub text := auth.jwt() ->> 'sub'; v_email text := lower(auth.jwt() ->> 'email'); v_id uuid;
begin
  if v_sub is null or v_email is null then return null; end if;
  select id into v_id from employees where clerk_user_id = v_sub;
  if v_id is not null then return v_id; end if;
  update employees set clerk_user_id = v_sub
   where lower(email) = v_email and clerk_user_id is null and status = 'active'
   returning id into v_id;
  return v_id;
end $$;

-- --------------------------------------------------------------- attendance

create function check_in(p_wfh boolean default false) returns attendance language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee(); r attendance;
begin
  perform set_config('app.actor_id', emp::text, true);
  insert into attendance (employee_id, date, check_in, is_wfh, is_late)
  values (emp, ist_today(), now(), p_wfh, (now() at time zone 'Asia/Kolkata')::time > time '10:15:00')
  on conflict (employee_id, date) do nothing;
  select * into r from attendance where employee_id = emp and date = ist_today();
  return r;
end $$;

create function check_out() returns attendance language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee(); r attendance;
begin
  update attendance set check_out = now()
   where employee_id = emp and date = ist_today() and check_in is not null and check_out is null;
  select * into r from attendance where employee_id = emp and date = ist_today();
  if r.id is null then raise exception 'You have not checked in today'; end if;
  return r;
end $$;

create function submit_regularisation(p_date date, p_in timestamptz, p_out timestamptz, p_reason text)
returns regularisation_requests language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee(); r regularisation_requests;
begin
  if p_date > ist_today() or p_date < ist_today() - 30 then
    raise exception 'Corrections are allowed only for the last 30 days';
  end if;
  if exists (select 1 from leave_requests where employee_id = emp and status = 'approved'
             and p_date between from_date and to_date) then
    raise exception 'That day has approved leave';
  end if;
  insert into regularisation_requests (employee_id, date, requested_in, requested_out, reason)
  values (emp, p_date, p_in, p_out, p_reason) returning * into r;
  return r;
end $$;

create function decide_regularisation(p_id uuid, p_approve boolean, p_comment text)
returns regularisation_requests language plpgsql security definer set search_path = public as $$
declare me uuid := require_employee(); r regularisation_requests;
begin
  select * into r from regularisation_requests where id = p_id for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not can_decide_for(r.employee_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'Request is already %', r.status; end if;
  if not p_approve and coalesce(trim(p_comment), '') = '' then raise exception 'A comment is required when rejecting'; end if;

  update regularisation_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         approver_id = me, approver_comment = p_comment, decided_at = now()
   where id = p_id returning * into r;

  if p_approve then
    insert into attendance (employee_id, date, check_in, check_out, is_late, status)
    values (r.employee_id, r.date, r.requested_in, r.requested_out,
            r.requested_in is not null and (r.requested_in at time zone 'Asia/Kolkata')::time > time '10:15:00', null)
    on conflict (employee_id, date) do update
      set check_in = coalesce(excluded.check_in, attendance.check_in),
          check_out = coalesce(excluded.check_out, attendance.check_out),
          is_late = coalesce(excluded.check_in, attendance.check_in) is not null
                    and (coalesce(excluded.check_in, attendance.check_in) at time zone 'Asia/Kolkata')::time > time '10:15:00',
          status = null;
  end if;
  insert into email_log (to_employee_id, subject, body, kind)
  values (r.employee_id, 'Attendance correction ' || r.status, coalesce(p_comment, ''), 'regularisation_decision');
  return r;
end $$;

-- --------------------------------------------------------------- leave maths (mirror of src/lib/domain)

create function leave_count_days(p_emp uuid, p_from date, p_to date, p_half boolean, p_calendar boolean)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare loc locations%rowtype; d date; n numeric := 0; offday boolean;
begin
  select l.* into loc from locations l join employees e on e.location_id = l.id where e.id = p_emp;
  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    offday := false;
    if not p_calendar then
      offday := extract(dow from d)::int = any (loc.weekly_off_days)
        or exists (
          select 1 from holidays h
          where h.location_id = loc.id and h.date = d
            and (h.type <> 'Optional'
                 or exists (select 1 from employee_optional_holidays oh where oh.holiday_id = h.id and oh.employee_id = p_emp)));
    end if;
    if not offday then n := n + 1; end if;
  end loop;
  if p_half then n := case when n > 0 then 0.5 else 0 end; end if;
  return n;
end $$;

create function leave_accrued(p_emp uuid, p_type uuid, p_year int, p_as_of date)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare t leave_types%rowtype; v_join date; m int; months numeric := 0; first_d date; last_d date;
begin
  select * into t from leave_types where id = p_type;
  select date_of_joining into v_join from employees where id = p_emp;
  if t.accrual_method = 'upfront' then
    if extract(year from v_join) < p_year then return t.annual_quota; end if;
    if extract(year from v_join) > p_year then return 0; end if;
    months := case when extract(day from v_join) <= 15 then 12 - (extract(month from v_join) - 1) else 12 - extract(month from v_join) end;
    return round(t.annual_quota * months / 12 * 2) / 2;
  elsif t.accrual_method = 'monthly' then
    for m in 1..12 loop
      first_d := make_date(p_year, m, 1);
      last_d := (first_d + interval '1 month - 1 day')::date;
      if v_join <= first_d and p_as_of >= last_d then months := months + 1; end if;
    end loop;
    return months * t.annual_quota / 12;
  elsif t.accrual_method = 'on_request' then
    return t.annual_quota;
  end if;
  return 0;
end $$;

create function leave_available(p_emp uuid, p_type uuid, p_year int, p_as_of date default null)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare opening numeric := 0; adj numeric := 0; used numeric; pend numeric; asof date := coalesce(p_as_of, ist_today());
begin
  select coalesce(b.opening, 0), coalesce(b.adjustment, 0) into opening, adj
    from (select 1) x left join leave_balances b on b.employee_id = p_emp and b.leave_type_id = p_type and b.year = p_year;
  select coalesce(sum(days) filter (where status = 'approved'), 0), coalesce(sum(days) filter (where status = 'pending'), 0)
    into used, pend from leave_requests
   where employee_id = p_emp and leave_type_id = p_type and extract(year from from_date) = p_year;
  return opening + adj + leave_accrued(p_emp, p_type, p_year, asof) - used - pend;
end $$;

-- Idempotent yearly rollover (R35): EL carries forward up to its cap, CL and SL lapse.
create function ensure_balances(p_emp uuid, p_year int) returns void language plpgsql security definer set search_path = public as $$
declare t leave_types%rowtype; prev numeric;
begin
  if require_employee() <> p_emp and not is_hr() then raise exception 'Not allowed' using errcode = '42501'; end if;
  for t in select * from leave_types loop
    prev := 0;
    if t.carry_forward_max > 0 then
      prev := least(greatest(leave_available(p_emp, t.id, p_year - 1, make_date(p_year - 1, 12, 31)), 0), t.carry_forward_max);
    end if;
    insert into leave_balances (employee_id, leave_type_id, year, opening) values (p_emp, t.id, p_year, prev)
    on conflict do nothing;
  end loop;
end $$;

-- --------------------------------------------------------------- leave workflow

create function submit_leave(
  p_type_code text, p_from date, p_to date, p_half boolean, p_reason text,
  p_attachment_path text default null, p_convert_excess_to_lop boolean default false
) returns setof leave_requests language plpgsql security definer set search_path = public as $$
declare
  emp uuid := require_employee(); t leave_types%rowtype; lop leave_types%rowtype; e employees%rowtype;
  v_days numeric; v_avail numeric; v_whole numeric; d date; v_split date; v_cnt numeric := 0;
  grp uuid := gen_random_uuid(); r leave_requests; v_mgr uuid;
begin
  perform pg_advisory_xact_lock(hashtext('leave:' || emp::text));
  perform set_config('app.actor_id', emp::text, true);
  select * into e from employees where id = emp;
  select * into t from leave_types where code = p_type_code;
  if t.id is null then raise exception 'Unknown leave type'; end if;
  select * into lop from leave_types where code = 'LOP';

  if p_to < p_from then raise exception 'The end date cannot be before the start date'; end if;
  if p_from < ist_today() - 30 then raise exception 'Leave cannot be applied for dates more than 30 days in the past'; end if;
  if p_half and not t.half_day_allowed then raise exception 'Half day is not allowed for this leave type'; end if;
  if p_half and p_from <> p_to then raise exception 'A half day must be a single date'; end if;
  if t.eligible_gender <> 'any' and e.gender is distinct from t.eligible_gender then
    raise exception 'This leave type is not available for your profile';
  end if;

  perform ensure_balances(emp, extract(year from p_from)::int);
  v_days := leave_count_days(emp, p_from, p_to, p_half, t.counts_calendar_days);
  if v_days <= 0 then raise exception 'The selected dates have no working days'; end if;
  if t.requires_certificate_after_days is not null and v_days > t.requires_certificate_after_days
     and p_attachment_path is null then
    raise exception '% of more than % days needs a medical certificate', t.code, t.requires_certificate_after_days;
  end if;

  if t.code = 'LOP' then
    v_avail := v_days; -- unlimited
  else
    v_avail := leave_available(emp, t.id, extract(year from p_from)::int);
  end if;

  if v_days <= v_avail then
    insert into leave_requests (request_group_id, employee_id, leave_type_id, from_date, to_date, is_half_day, days, reason, attachment_path)
    values (grp, emp, t.id, p_from, p_to, p_half, v_days, p_reason, p_attachment_path) returning * into r;
    return next r;
  else
    if not p_convert_excess_to_lop then
      raise exception 'Not enough % balance (available %, requested %). Convert the excess to Loss of Pay to continue.', t.code, v_avail, v_days;
    end if;
    -- Split on whole days: the first floor(available) days use the leave type, the rest become LOP.
    v_whole := floor(greatest(v_avail, 0));
    if v_whole >= 1 and not p_half then
      for d in select generate_series(p_from, p_to, interval '1 day')::date loop
        if leave_count_days(emp, d, d, false, t.counts_calendar_days) > 0 then v_cnt := v_cnt + 1; end if;
        if v_cnt >= v_whole then v_split := d; exit; end if;
      end loop;
      insert into leave_requests (request_group_id, employee_id, leave_type_id, from_date, to_date, is_half_day, days, reason, attachment_path)
      values (grp, emp, t.id, p_from, v_split, false, leave_count_days(emp, p_from, v_split, false, t.counts_calendar_days), p_reason, p_attachment_path)
      returning * into r;
      return next r;
      insert into leave_requests (request_group_id, employee_id, leave_type_id, from_date, to_date, is_half_day, days, reason)
      values (grp, emp, lop.id, v_split + 1, p_to, false, leave_count_days(emp, v_split + 1, p_to, false, false), p_reason)
      returning * into r;
      return next r;
    else
      insert into leave_requests (request_group_id, employee_id, leave_type_id, from_date, to_date, is_half_day, days, reason)
      values (grp, emp, lop.id, p_from, p_to, p_half, v_days, p_reason) returning * into r;
      return next r;
    end if;
  end if;

  select reporting_manager_id into v_mgr from employees where id = emp and reporting_manager_id in
    (select id from employees where status = 'active');
  insert into email_log (to_employee_id, subject, body, kind)
  select coalesce(v_mgr, h.id), 'New leave request from ' || e.full_name,
         e.full_name || ' requested ' || p_type_code || ' from ' || p_from || ' to ' || p_to, 'leave_submitted'
    from (select id from employees where is_hr_admin and status = 'active' and id <> emp limit 1) h;
  return;
end $$;

create function decide_leave(p_group uuid, p_approve boolean, p_comment text)
returns setof leave_requests language plpgsql security definer set search_path = public as $$
declare me uuid := require_employee(); r leave_requests; v_emp uuid;
begin
  perform set_config('app.actor_id', me::text, true);
  select employee_id into v_emp from leave_requests where request_group_id = p_group limit 1;
  if v_emp is null then raise exception 'Request not found'; end if;
  if not can_decide_for(v_emp) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not p_approve and coalesce(trim(p_comment), '') = '' then raise exception 'A comment is required when rejecting'; end if;
  perform 1 from leave_requests where request_group_id = p_group for update;
  if exists (select 1 from leave_requests where request_group_id = p_group and status <> 'pending') then
    raise exception 'This request has already been decided or cancelled';
  end if;
  -- Pending days are already reserved in the balance, so approving moves pending -> used and the
  -- available balance does not change. Nothing can be double-spent at approval time.
  for r in
    update leave_requests set status = case when p_approve then 'approved' else 'rejected' end,
           approver_id = me, approver_comment = p_comment, decided_at = now()
     where request_group_id = p_group returning *
  loop return next r; end loop;
  insert into email_log (to_employee_id, subject, body, kind)
  values (v_emp, 'Leave ' || case when p_approve then 'approved' else 'rejected' end, coalesce(p_comment, ''), 'leave_decision');
  return;
end $$;

create function cancel_leave(p_group uuid) returns setof leave_requests language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee(); r leave_requests;
begin
  perform set_config('app.actor_id', emp::text, true);
  perform 1 from leave_requests where request_group_id = p_group and employee_id = emp for update;
  if not found then raise exception 'Request not found'; end if;
  if exists (select 1 from leave_requests where request_group_id = p_group
             and not (status = 'pending' or (status = 'approved' and from_date > ist_today()))) then
    raise exception 'Only pending leave, or approved leave that has not started, can be cancelled';
  end if;
  for r in update leave_requests set status = 'cancelled' where request_group_id = p_group and employee_id = emp returning *
  loop return next r; end loop;
  return;
end $$;

-- --------------------------------------------------------------- employee master

create function update_my_contact(
  p_mobile text, p_address_line text, p_city text, p_state text, p_pin text,
  p_emergency_name text, p_emergency_relation text, p_emergency_phone text
) returns void language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee();
begin
  perform set_config('app.actor_id', emp::text, true);
  update employees set mobile = p_mobile, address_line = p_address_line, city = p_city, state = p_state, pin = p_pin,
         emergency_name = p_emergency_name, emergency_relation = p_emergency_relation, emergency_phone = p_emergency_phone
   where id = emp;
end $$;

create function hr_create_employee(p jsonb) returns employees language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); e employees;
begin
  perform set_config('app.actor_id', me::text, true);
  insert into employees (full_name, email, mobile, dob, gender, address_line, city, state, pin, date_of_joining,
                         designation, department_id, location_id, reporting_manager_id, salary_grade, is_hr_admin,
                         emergency_name, emergency_relation, emergency_phone)
  values (p->>'full_name', p->>'email', p->>'mobile', (p->>'dob')::date, p->>'gender', p->>'address_line', p->>'city',
          p->>'state', p->>'pin', (p->>'date_of_joining')::date, p->>'designation', (p->>'department_id')::uuid,
          (p->>'location_id')::uuid, nullif(p->>'reporting_manager_id', '')::uuid, p->>'salary_grade',
          coalesce((p->>'is_hr_admin')::boolean, false), p->>'emergency_name', p->>'emergency_relation', p->>'emergency_phone')
  returning * into e;
  insert into employee_statutory (employee_id, pan, aadhaar, uan)
  values (e.id, p->>'pan', p->>'aadhaar', nullif(p->>'uan', ''));
  insert into employee_bank (employee_id, account_number, ifsc, bank_name)
  values (e.id, p->>'account_number', p->>'ifsc', p->>'bank_name');
  perform ensure_balances(e.id, extract(year from e.date_of_joining)::int);
  return e;
end $$;

-- Only job fields are updatable here, and only by HR. Absent keys are left unchanged.
create function hr_update_employee(p_id uuid, p jsonb) returns employees language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); e employees;
begin
  perform set_config('app.actor_id', me::text, true);
  update employees set
    designation = case when p ? 'designation' then p->>'designation' else designation end,
    department_id = case when p ? 'department_id' then (p->>'department_id')::uuid else department_id end,
    location_id = case when p ? 'location_id' then (p->>'location_id')::uuid else location_id end,
    reporting_manager_id = case when p ? 'reporting_manager_id' then nullif(p->>'reporting_manager_id', '')::uuid else reporting_manager_id end,
    salary_grade = case when p ? 'salary_grade' then p->>'salary_grade' else salary_grade end,
    is_hr_admin = case when p ? 'is_hr_admin' then (p->>'is_hr_admin')::boolean else is_hr_admin end,
    full_name = case when p ? 'full_name' then p->>'full_name' else full_name end
  where id = p_id returning * into e;
  if p ? 'pan' or p ? 'aadhaar' or p ? 'uan' then
    update employee_statutory set
      pan = case when p ? 'pan' then p->>'pan' else pan end,
      aadhaar = case when p ? 'aadhaar' then p->>'aadhaar' else aadhaar end,
      uan = case when p ? 'uan' then nullif(p->>'uan', '') else uan end
    where employee_id = p_id;
  end if;
  if p ? 'account_number' or p ? 'ifsc' or p ? 'bank_name' then
    update employee_bank set
      account_number = case when p ? 'account_number' then p->>'account_number' else account_number end,
      ifsc = case when p ? 'ifsc' then p->>'ifsc' else ifsc end,
      bank_name = case when p ? 'bank_name' then p->>'bank_name' else bank_name end
    where employee_id = p_id;
  end if;
  return e;
end $$;

create function hr_deactivate_employee(p_id uuid, p_last_working_day date) returns employees language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); e employees;
begin
  perform set_config('app.actor_id', me::text, true);
  update employees set last_working_day = p_last_working_day,
         status = case when p_last_working_day <= ist_today() then 'inactive' else status end
   where id = p_id returning * into e;
  return e;
end $$;

-- Reveal (HR only, logged). Aadhaar is never revealable (R2); only PAN and bank account.
create function hr_reveal(p_employee uuid, p_field text) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); v text;
begin
  if p_field = 'pan' then select pan into v from employee_statutory where employee_id = p_employee;
  elsif p_field = 'account_number' then select account_number into v from employee_bank where employee_id = p_employee;
  else raise exception 'This field cannot be revealed'; end if;
  insert into audit_log (table_name, record_id, field, action, changed_by)
  values (case when p_field = 'pan' then 'employee_statutory' else 'employee_bank' end, p_employee::text, p_field, 'REVEAL', me);
  return v;
end $$;

create function pick_optional_holiday(p_holiday uuid) returns void language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee();
begin
  insert into employee_optional_holidays (employee_id, holiday_id) values (emp, p_holiday) on conflict do nothing;
end $$;

create function unpick_optional_holiday(p_holiday uuid) returns void language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee();
begin
  delete from employee_optional_holidays where employee_id = emp and holiday_id = p_holiday;
end $$;
