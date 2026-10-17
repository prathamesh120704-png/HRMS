'use client';
import { useActionState, useMemo, useState } from 'react';
import { Field, SelectField } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { countWorkingDays } from '@/lib/domain/workingDays';
import { validateLeaveRequest } from '@/lib/domain/leaveRules';
import type { WorkCalendar } from '@/lib/domain/types';
import { formatDateIST } from '@/lib/time/ist';
import type { ActionState } from '@/modules/employees/schema';
import { submitLeaveAction } from './actions';

export interface FormType {
  code: string; name: string; halfDayAllowed: boolean; certificateAfterDays: number | null;
  eligibleGender: 'any' | 'female' | 'male'; countsCalendarDays: boolean; available: number; unlimited: boolean;
}

const REASON: Record<string, string> = { weekly_off: 'weekly off', holiday: 'holiday' };

/**
 * L3: Apply leave. The live preview uses the SAME pure functions as the server (countWorkingDays,
 * validateLeaveRequest), but the server never trusts it: submit_leave recounts and rechecks everything.
 * `today` comes from the server, never from the browser clock.
 */
export function ApplyLeaveForm({ types, cal, existing, today, gender, defaultType }: {
  types: FormType[]; cal: WorkCalendar; existing: { from: string; to: string }[]; today: string; gender: string | null; defaultType?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(submitLeaveAction, {});
  const e = state.errors ?? {};
  const [code, setCode] = useState(defaultType && types.some((t) => t.code === defaultType) ? defaultType : types[0]?.code ?? '');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [half, setHalf] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [convert, setConvert] = useState(false);

  const type = types.find((t) => t.code === code);
  const sameDay = from === to;
  const isHalf = half && sameDay && !!type?.halfDayAllowed;

  const calc = useMemo(() => {
    if (!type || !from || !to || to < from) return null;
    try {
      return countWorkingDays({ from, to, isHalfDay: isHalf, cal, calendarDays: type.countsCalendarDays });
    } catch { return null; }
  }, [type, from, to, isHalf, cal]);

  const days = calc?.days ?? 0;
  const problems = type && calc
    ? validateLeaveRequest({
        today, from, to, isHalfDay: isHalf, days,
        type: { code: type.code, halfDayAllowed: type.halfDayAllowed, certificateAfterDays: type.certificateAfterDays, eligibleGender: type.eligibleGender },
        gender, hasCertificate: hasFile, existing,
      })
    : to < from ? ['The end date cannot be before the start date.'] : [];

  const short = !!type && !type.unlimited && days > type.available;
  // Whole days only, matching the database: floor(available) days use the type, the rest become LOP.
  const leavePart = short ? Math.min(Math.floor(Math.max(type!.available, 0)), days) : days;
  const lopPart = short ? days - leavePart : 0;
  const needsCert = !!type && type.certificateAfterDays !== null && days > type.certificateAfterDays;
  const certProblem = problems.find((p) => p.includes('medical certificate'));
  const blocking = problems.filter((p) => !p.includes('medical certificate'));
  const canSubmit = !!calc && blocking.length === 0 && (!short || convert) && (!needsCert || hasFile);

  return (
    <form action={action} noValidate encType="multipart/form-data">
      {state.message && <div className="alert alert-bad" role="alert">{state.message}</div>}

      <SelectField label="Leave type" name="type_code" required value={code} onChange={(ev) => { setCode(ev.target.value); setConvert(false); }}
        error={e.type_code} options={types.map((t) => ({ value: t.code, label: `${t.name} (${t.code})${t.unlimited ? '' : ` — ${t.available.toFixed(1)} available`}` }))} />

      <div className="grid g2">
        <Field label="From" name="from_date" type="date" required value={from} onChange={(ev) => { setFrom(ev.target.value); if (to < ev.target.value) setTo(ev.target.value); }} error={e.from_date} />
        <Field label="To" name="to_date" type="date" required value={to} min={from} onChange={(ev) => setTo(ev.target.value)} error={e.to_date} />
      </div>

      <label className="row" style={{ marginBottom: 12 }}>
        <input type="checkbox" name="is_half_day" checked={isHalf} disabled={!type?.halfDayAllowed || !sameDay}
          onChange={(ev) => setHalf(ev.target.checked)} style={{ width: 20, height: 20 }} />
        Half day
        {!type?.halfDayAllowed && <span className="hint">(not allowed for this type)</span>}
        {type?.halfDayAllowed && !sameDay && <span className="hint">(single day only)</span>}
      </label>

      <div className="alert alert-info" role="status" aria-live="polite">
        {calc ? (
          <>
            <strong>Working days: {days}</strong>
            {type && !type.unlimited && <> · Balance after: <strong>{Math.max(type.available - leavePart, 0).toFixed(1)}</strong></>}
            {calc.excluded.length > 0 && (
              <div className="hint" style={{ color: 'inherit' }}>
                Not counted: {calc.excluded.map((x) => `${formatDateIST(x.date)} (${REASON[x.reason]})`).join(', ')}
              </div>
            )}
            {type?.countsCalendarDays && <div className="hint" style={{ color: 'inherit' }}>This leave type counts calendar days.</div>}
          </>
        ) : 'Pick the dates to see the working days.'}
      </div>

      {blocking.map((p) => <div key={p} className="alert alert-bad" role="alert">{p}</div>)}

      {short && (
        <div className="alert alert-bad" role="alert">
          <p style={{ margin: '0 0 8px' }}>
            Not enough {type!.code}: you have {type!.available.toFixed(1)} and asked for {days}.
          </p>
          <label className="row">
            <input type="checkbox" name="convert_lop" checked={convert} onChange={(ev) => setConvert(ev.target.checked)} style={{ width: 20, height: 20 }} />
            Convert the excess to Loss of Pay ({leavePart > 0 ? `${leavePart} day(s) ${type!.code} + ` : ''}{lopPart} day(s) LOP)
          </label>
        </div>
      )}

      {needsCert && (
        <div className="field">
          <label htmlFor="certificate">Medical certificate *</label>
          <input id="certificate" name="certificate" type="file" accept="application/pdf,image/jpeg,image/png"
            onChange={(ev) => setHasFile(!!ev.target.files?.length)} data-error={!!e.certificate || (!hasFile && !!certProblem)} />
          <div className="hint">{type!.code} of more than {type!.certificateAfterDays} days needs a certificate. PDF, JPG or PNG, up to 2 MB.</div>
          {e.certificate && <div className="err" role="alert">⚠ {e.certificate}</div>}
        </div>
      )}

      <div className="field">
        <label htmlFor="reason">Reason *</label>
        <textarea id="reason" name="reason" rows={3} required data-error={!!e.reason} aria-invalid={!!e.reason} />
        {e.reason && <div className="err" role="alert">⚠ {e.reason}</div>}
      </div>

      {/* The submit stays disabled until the preview is clean; the server re-validates regardless. */}
      <div className="row">
        <SubmitButtonGate disabled={!canSubmit} />
        {!canSubmit && calc && <span className="hint">{short && !convert ? 'Tick the Loss of Pay box to continue.' : needsCert && !hasFile ? 'Attach the certificate to continue.' : ''}</span>}
      </div>
    </form>
  );
}

function SubmitButtonGate({ disabled }: { disabled: boolean }) {
  if (disabled) return <button type="button" className="btn" disabled>Submit request</button>;
  return <SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton>;
}
