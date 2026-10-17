-- HR settings writes (holidays, departments, locations). Same pattern as 0002: no direct writes, role checked inside.

create function hr_add_holiday(p_location uuid, p_date date, p_name text, p_type text) returns holidays
language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); h holidays;
begin
  if p_type not in ('National', 'State', 'Optional') then raise exception 'Holiday type must be National, State or Optional'; end if;
  insert into holidays (location_id, date, name, type) values (p_location, p_date, trim(p_name), p_type)
  returning * into h;
  return h;
exception when unique_violation then
  raise exception 'That location already has a holiday on %', p_date;
end $$;

create function hr_delete_holiday(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr();
begin
  delete from holidays where id = p_id;
end $$;

create function hr_add_department(p_name text) returns departments language plpgsql security definer set search_path = public as $$
declare me uuid := require_hr(); d departments;
begin
  insert into departments (name) values (trim(p_name)) returning * into d;
  return d;
exception when unique_violation then
  raise exception 'A department named % already exists', p_name;
end $$;

revoke execute on function hr_add_holiday(uuid, date, text, text), hr_delete_holiday(uuid), hr_add_department(text) from public, anon;
grant execute on function hr_add_holiday(uuid, date, text, text), hr_delete_holiday(uuid), hr_add_department(text) to authenticated;
