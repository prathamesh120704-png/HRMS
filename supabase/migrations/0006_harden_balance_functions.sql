-- Review finding: leave_available() and leave_count_days() are SECURITY DEFINER and were callable by any signed-in
-- user for ANY employee id, which would leak another person's balance. Add a caller check: self, HR, the employee's
-- manager, or the service role (seed, cron, parity checks). Same bodies as 0002 otherwise.

create or replace function leave_count_days(p_emp uuid, p_from date, p_to date, p_half boolean, p_calendar boolean)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare loc locations%rowtype; d date; n numeric := 0; offday boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and p_emp is distinct from current_employee_id() and not is_hr() and not is_manager_of(p_emp) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
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

create or replace function leave_available(p_emp uuid, p_type uuid, p_year int, p_as_of date default null)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare opening numeric := 0; adj numeric := 0; used numeric; pend numeric; asof date := coalesce(p_as_of, ist_today());
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and p_emp is distinct from current_employee_id() and not is_hr() and not is_manager_of(p_emp) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select coalesce(b.opening, 0), coalesce(b.adjustment, 0) into opening, adj
    from (select 1) x left join leave_balances b on b.employee_id = p_emp and b.leave_type_id = p_type and b.year = p_year;
  select coalesce(sum(days) filter (where status = 'approved'), 0), coalesce(sum(days) filter (where status = 'pending'), 0)
    into used, pend from leave_requests
   where employee_id = p_emp and leave_type_id = p_type and extract(year from from_date) = p_year;
  return opening + adj + leave_accrued(p_emp, p_type, p_year, asof) - used - pend;
end $$;

-- leave_accrued is only called from inside the functions above and ensure_balances; it is not exposed to browsers.
revoke execute on function leave_accrued(uuid, uuid, int, date) from public, anon, authenticated;
