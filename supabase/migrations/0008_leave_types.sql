-- L1: HR configures leave types (annual quota, accrual method, carry-forward limit, half day allowed).
-- Same pattern as every other write (rule 9): no direct table writes, the function re-checks that the caller is HR.
-- The same rules exist in src/lib/validation/leaveType.ts (for friendly messages); these are the ones that cannot be bypassed.

create function hr_update_leave_type(
  p_id uuid, p_name text, p_annual_quota numeric, p_accrual_method text, p_carry_forward_max numeric, p_half_day_allowed boolean
) returns leave_types language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); t leave_types;
begin
  perform set_config('app.actor_id', me::text, true);
  select * into t from leave_types where id = p_id for update;
  if t.id is null then raise exception 'Leave type not found'; end if;

  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Give the leave type a name (at least 3 letters)'; end if;
  if p_accrual_method not in ('upfront', 'monthly', 'on_request', 'none') then raise exception 'Unknown accrual method'; end if;
  if p_annual_quota < 0 or p_carry_forward_max < 0 then raise exception 'Quota and carry-forward cannot be negative'; end if;
  if (p_annual_quota * 2) <> floor(p_annual_quota * 2) or (p_carry_forward_max * 2) <> floor(p_carry_forward_max * 2) then
    raise exception 'Quota and carry-forward must be in steps of 0.5 days';
  end if;
  -- Loss of Pay is the unpaid fallback the rules depend on: it never accrues and has no quota.
  if t.code = 'LOP' and (p_accrual_method <> 'none' or p_annual_quota <> 0 or p_carry_forward_max <> 0) then
    raise exception 'Loss of Pay has no quota and never accrues';
  end if;
  if p_accrual_method = 'none' and (p_annual_quota <> 0 or p_carry_forward_max <> 0) then
    raise exception 'A leave type with no accrual has no quota or carry-forward';
  end if;
  if p_accrual_method = 'on_request' and p_carry_forward_max <> 0 then
    raise exception 'Leave granted on request cannot carry forward';
  end if;

  update leave_types
     set name = trim(p_name), annual_quota = p_annual_quota, accrual_method = p_accrual_method,
         carry_forward_max = p_carry_forward_max, half_day_allowed = p_half_day_allowed
   where id = p_id returning * into t;
  return t;
end $$;

create function hr_add_leave_type(
  p_code text, p_name text, p_annual_quota numeric, p_accrual_method text, p_carry_forward_max numeric, p_half_day_allowed boolean
) returns leave_types language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); t leave_types; v_code text := upper(trim(coalesce(p_code, '')));
begin
  perform set_config('app.actor_id', me::text, true);
  if v_code !~ '^[A-Z]{2,6}$' then raise exception 'Code must be 2 to 6 capital letters'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Give the leave type a name (at least 3 letters)'; end if;
  if p_accrual_method not in ('upfront', 'monthly', 'on_request', 'none') then raise exception 'Unknown accrual method'; end if;
  if p_annual_quota < 0 or p_carry_forward_max < 0 then raise exception 'Quota and carry-forward cannot be negative'; end if;
  if (p_annual_quota * 2) <> floor(p_annual_quota * 2) or (p_carry_forward_max * 2) <> floor(p_carry_forward_max * 2) then
    raise exception 'Quota and carry-forward must be in steps of 0.5 days';
  end if;
  if p_accrual_method = 'none' and (p_annual_quota <> 0 or p_carry_forward_max <> 0) then
    raise exception 'A leave type with no accrual has no quota or carry-forward';
  end if;
  if p_accrual_method = 'on_request' and p_carry_forward_max <> 0 then
    raise exception 'Leave granted on request cannot carry forward';
  end if;

  insert into leave_types (code, name, annual_quota, accrual_method, carry_forward_max, half_day_allowed)
  values (v_code, trim(p_name), p_annual_quota, p_accrual_method, p_carry_forward_max, p_half_day_allowed)
  returning * into t;
  return t;
exception when unique_violation then
  raise exception 'A leave type with code % already exists', v_code;
end $$;

-- Policy changes are recorded like job and statutory changes (who, what, old, new, when).
create trigger leave_types_audit after update on leave_types for each row execute function audit_row(
  'name', 'annual_quota', 'accrual_method', 'carry_forward_max', 'half_day_allowed');

revoke execute on function
  hr_update_leave_type(uuid, text, numeric, text, numeric, boolean),
  hr_add_leave_type(text, text, numeric, text, numeric, boolean)
from public, anon;
grant execute on function
  hr_update_leave_type(uuid, text, numeric, text, numeric, boolean),
  hr_add_leave_type(text, text, numeric, text, numeric, boolean)
to authenticated;
