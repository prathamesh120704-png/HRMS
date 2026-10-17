-- Agent support. Same pattern as 0002: no direct writes; each function identifies the caller from the JWT and
-- re-checks the role. The agent runs as the signed-in user, so these are called with the user's own token.

-- Every tool call is logged: user, tool, inputs, result, time. Results are redacted in code before they get here.
create function log_agent_call(p_question uuid, p_tool text, p_inputs jsonb, p_result jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee();
begin
  insert into agent_log (employee_id, question_id, tool, inputs, result) values (emp, p_question, p_tool, coalesce(p_inputs, '{}'), p_result);
end $$;

-- A write the agent proposes. Nothing happens until the user presses Confirm in the UI.
create function create_agent_draft(p_kind text, p_payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee(); v_id uuid;
begin
  if p_kind not in ('leave_request', 'reminder_email') then raise exception 'Unknown draft kind'; end if;
  if p_kind = 'reminder_email' and not is_hr() then raise exception 'HR Admin only' using errcode = '42501'; end if;
  insert into agent_drafts (employee_id, kind, payload) values (emp, p_kind, p_payload) returning id into v_id;
  return v_id;
end $$;

-- Only the owner moves their own draft, and only out of 'draft'.
create function set_agent_draft_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare emp uuid := require_employee();
begin
  if p_status not in ('confirmed', 'discarded') then raise exception 'Bad status'; end if;
  update agent_drafts set status = p_status, confirmed_at = case when p_status = 'confirmed' then now() else null end
   where id = p_id and employee_id = emp and status = 'draft';
  if not found then raise exception 'Draft not found or already handled'; end if;
end $$;

-- HR confirms a reminder-email draft: one queued email per recipient (the sender then delivers them).
create function hr_queue_reminders(p_draft uuid) returns int
language plpgsql security definer set search_path = public as $$
declare emp uuid := require_hr(); d agent_drafts; r uuid; n int := 0;
begin
  select * into d from agent_drafts where id = p_draft and employee_id = emp and kind = 'reminder_email' and status = 'draft' for update;
  if d.id is null then raise exception 'Draft not found or already handled'; end if;
  for r in select (jsonb_array_elements_text(d.payload -> 'recipients'))::uuid loop
    insert into email_log (to_employee_id, subject, body, kind)
    values (r, left(d.payload ->> 'subject', 200), left(d.payload ->> 'body', 2000), 'attendance_reminder');
    n := n + 1;
  end loop;
  update agent_drafts set status = 'confirmed', confirmed_at = now() where id = p_draft;
  return n;
end $$;

revoke execute on function log_agent_call(uuid, text, jsonb, jsonb), create_agent_draft(text, jsonb),
  set_agent_draft_status(uuid, text), hr_queue_reminders(uuid) from public, anon;
grant execute on function log_agent_call(uuid, text, jsonb, jsonb), create_agent_draft(text, jsonb),
  set_agent_draft_status(uuid, text), hr_queue_reminders(uuid) to authenticated;
