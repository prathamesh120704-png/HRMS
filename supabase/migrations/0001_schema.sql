-- Tarang HRMS schema (ARCHITECTURE.md section 3). Dates are IST calendar dates; timestamps are timestamptz.
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null,
  state text not null,
  weekly_off_days int[] not null check (weekly_off_days <@ array[0,1,2,3,4,5,6])
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create sequence employee_code_seq start 1;

create table employees (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  employee_code text not null unique default ('KCF' || lpad(nextval('employee_code_seq')::text, 4, '0')),
  full_name text not null,
  email text not null unique check (email = lower(email)),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  dob date not null,
  gender text check (gender in ('female', 'male', 'other')),
  address_line text,
  city text,
  state text,
  pin text check (pin ~ '^[0-9]{6}$'),
  date_of_joining date not null,
  last_working_day date,
  designation text not null,
  department_id uuid not null references departments (id),
  location_id uuid not null references locations (id),
  reporting_manager_id uuid references employees (id),
  salary_grade text,
  is_hr_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  emergency_name text,
  emergency_relation text,
  emergency_phone text check (emergency_phone is null or emergency_phone ~ '^[6-9][0-9]{9}$'),
  created_at timestamptz not null default now(),
  constraint employees_age_18 check (date_of_joining >= (dob + interval '18 years')::date),
  constraint employees_not_own_manager check (reporting_manager_id is null or reporting_manager_id <> id),
  constraint employees_lwd_after_joining check (last_working_day is null or last_working_day >= date_of_joining)
);
create index employees_manager_idx on employees (reporting_manager_id);

create table employee_statutory (
  employee_id uuid primary key references employees (id),
  pan text not null check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  aadhaar text not null check (aadhaar ~ '^[0-9]{12}$'),
  uan text check (uan is null or uan ~ '^[0-9]{12}$')
);

create table employee_bank (
  employee_id uuid primary key references employees (id),
  account_number text not null check (account_number ~ '^[0-9]{6,20}$'),
  ifsc text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name text not null
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id),
  date date not null,
  name text not null,
  type text not null check (type in ('National', 'State', 'Optional')),
  unique (location_id, date)
);

create table employee_optional_holidays (
  employee_id uuid not null references employees (id),
  holiday_id uuid not null references holidays (id),
  primary key (employee_id, holiday_id)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id),
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  is_wfh boolean not null default false,
  status text check (status in ('Present', 'Half Day', 'Absent', 'On Leave', 'Holiday', 'Weekly Off')),
  is_late boolean not null default false,
  constraint attendance_one_per_day unique (employee_id, date),
  constraint attendance_out_after_in check (check_in is null or check_out is null or check_out > check_in)
);

create table regularisation_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id),
  date date not null,
  requested_in timestamptz,
  requested_out timestamptz,
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references employees (id),
  approver_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (approver_id is null or approver_id <> employee_id),
  check (requested_in is null or requested_out is null or requested_out > requested_in)
);
create unique index regularisation_one_pending on regularisation_requests (employee_id, date) where status = 'pending';

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  annual_quota numeric(6, 2) not null check (annual_quota >= 0),
  accrual_method text not null check (accrual_method in ('upfront', 'monthly', 'on_request', 'none')),
  carry_forward_max numeric(6, 2) not null default 0 check (carry_forward_max >= 0),
  half_day_allowed boolean not null default false,
  requires_certificate_after_days numeric(4, 1),
  eligible_gender text not null default 'any' check (eligible_gender in ('any', 'female', 'male')),
  counts_calendar_days boolean not null default false
);

create table leave_balances (
  employee_id uuid not null references employees (id),
  leave_type_id uuid not null references leave_types (id),
  year int not null,
  opening numeric(6, 2) not null default 0,
  adjustment numeric(6, 2) not null default 0,
  primary key (employee_id, leave_type_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  request_group_id uuid not null default gen_random_uuid(),
  employee_id uuid not null references employees (id),
  leave_type_id uuid not null references leave_types (id),
  from_date date not null,
  to_date date not null,
  is_half_day boolean not null default false,
  days numeric(5, 1) not null check (days > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references employees (id),
  approver_comment text,
  attachment_path text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint leave_dates_ordered check (to_date >= from_date),
  constraint leave_half_day_single check (not is_half_day or from_date = to_date),
  constraint leave_not_self_approved check (approver_id is null or approver_id <> employee_id),
  constraint leave_max_30_days_back check (from_date >= ((created_at at time zone 'Asia/Kolkata')::date - 30)),
  constraint leave_no_overlap exclude using gist (
    employee_id with =,
    daterange(from_date, to_date, '[]') with &&
  ) where (status in ('pending', 'approved'))
);
create index leave_requests_employee_idx on leave_requests (employee_id, status);

create table policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null
);

create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  field text not null,
  old_value text,
  new_value text,
  action text not null default 'UPDATE' check (action in ('UPDATE', 'REVEAL')),
  changed_by uuid references employees (id),
  changed_at timestamptz not null default now()
);

create table agent_log (
  id bigint generated always as identity primary key,
  employee_id uuid not null references employees (id),
  question_id uuid not null,
  tool text not null,
  inputs jsonb not null default '{}',
  result jsonb,
  created_at timestamptz not null default now()
);

create table agent_drafts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id),
  kind text not null,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  to_employee_id uuid not null references employees (id),
  subject text not null,
  body text not null,
  kind text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  sent_at timestamptz
);

-- ---------------------------------------------------------------- triggers

-- Employee code is immutable.
create function employees_code_immutable() returns trigger language plpgsql as $$
begin
  if new.employee_code is distinct from old.employee_code then
    raise exception 'employee_code cannot be changed';
  end if;
  return new;
end $$;
create trigger employees_code_immutable_trg before update on employees
  for each row execute function employees_code_immutable();

-- No reporting loops (E4): walk up from the proposed manager; reaching the employee means a loop.
create function employees_no_reporting_loop() returns trigger language plpgsql as $$
declare cur uuid := new.reporting_manager_id; steps int := 0;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'Reporting loop: % cannot report to someone in their own reporting chain', new.id;
    end if;
    steps := steps + 1;
    if steps > 100 then raise exception 'Reporting chain too deep or cyclic'; end if;
    select reporting_manager_id into cur from employees where id = cur;
  end loop;
  return new;
end $$;
create trigger employees_no_reporting_loop_trg before insert or update of reporting_manager_id on employees
  for each row execute function employees_no_reporting_loop();

-- A manager cannot be deactivated while they still have active direct reports (R34).
create function employees_manager_deactivate_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'inactive' and old.status = 'active'
     and exists (select 1 from employees where reporting_manager_id = new.id and status = 'active') then
    raise exception 'Reassign this manager''s active direct reports before deactivating them';
  end if;
  return new;
end $$;
create trigger employees_manager_deactivate_guard_trg before update of status on employees
  for each row execute function employees_manager_deactivate_guard();

-- Audit trail (E8). Sensitive values are masked BEFORE they are written to the log.
create function audit_mask(field text, v text) returns text language sql immutable as $$
  select case
    when v is null then null
    when field = 'aadhaar' then 'XXXX XXXX ' || right(v, 4)
    when field = 'pan' then left(v, 5) || '****' || right(v, 1)
    when field = 'account_number' then repeat('•', greatest(length(v) - 4, 0)) || right(v, 4)
    else v
  end
$$;

create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
        actor uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
        rec text := coalesce(n->>'id', n->>'employee_id');
begin
  foreach k in array tg_argv loop
    if o->>k is distinct from n->>k then
      insert into audit_log (table_name, record_id, field, old_value, new_value, changed_by)
      values (tg_table_name, rec, k, audit_mask(k, o->>k), audit_mask(k, n->>k), actor);
    end if;
  end loop;
  return new;
end $$;

create trigger employees_audit after update on employees for each row execute function audit_row(
  'designation', 'department_id', 'location_id', 'reporting_manager_id', 'salary_grade',
  'is_hr_admin', 'status', 'last_working_day', 'date_of_joining');
create trigger statutory_audit after update on employee_statutory for each row execute function audit_row('pan', 'aadhaar', 'uan');
create trigger bank_audit after update on employee_bank for each row execute function audit_row('account_number', 'ifsc', 'bank_name');

-- Audit log is append-only.
create function audit_log_append_only() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_append_only();

-- Optional holidays: must be Optional, at the employee's location, max 2 per calendar year (R31).
create function optional_holiday_guard() returns trigger language plpgsql as $$
declare h holidays%rowtype; e employees%rowtype;
begin
  select * into h from holidays where id = new.holiday_id;
  select * into e from employees where id = new.employee_id;
  if h.type <> 'Optional' then raise exception 'Only Optional holidays can be picked'; end if;
  if h.location_id <> e.location_id then raise exception 'Holiday belongs to a different location'; end if;
  if (select count(*) from employee_optional_holidays oh join holidays hh on hh.id = oh.holiday_id
      where oh.employee_id = new.employee_id and extract(year from hh.date) = extract(year from h.date)) >= 2 then
    raise exception 'You can pick at most 2 optional holidays a year';
  end if;
  return new;
end $$;
create trigger optional_holiday_guard_trg before insert on employee_optional_holidays
  for each row execute function optional_holiday_guard();
