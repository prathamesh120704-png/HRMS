import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/StatusBadge';
import { requireHr } from '@/lib/auth/session';
import { formatDateIST, todayIST } from '@/lib/time/ist';
import { referenceData } from '@/modules/employees/queries';
import { ACCRUAL_LABEL, type AccrualMethod } from '@/lib/validation/leaveType';
import { deleteHolidayAction } from '@/modules/settings/actions';
import { HolidayForm } from '@/modules/settings/HolidayForm';
import { LeaveTypeForm } from '@/modules/settings/LeaveTypeForm';

interface LeaveTypeRow {
  id: string; code: string; name: string; annual_quota: number; accrual_method: AccrualMethod; carry_forward_max: number;
  half_day_allowed: boolean; requires_certificate_after_days: number | null; eligible_gender: string; counts_calendar_days: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function Settings({ searchParams }: { searchParams: Promise<{ loc?: string; year?: string }> }) {
  const s = await requireHr();
  const f = await searchParams;
  const year = /^\d{4}$/.test(f.year ?? '') ? f.year! : todayIST().slice(0, 4);
  const { locations, departments } = await referenceData(s.db);

  let q = s.db.from('holidays').select('id, date, name, type, location_id, locations(name)')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`).order('date');
  if (f.loc) q = q.eq('location_id', f.loc);
  const { data } = await q;
  const holidays = (data ?? []) as unknown as { id: string; date: string; name: string; type: string; locations: { name: string } | { name: string }[] | null }[];

  const { data: lt } = await s.db.from('leave_types')
    .select('id, code, name, annual_quota, accrual_method, carry_forward_max, half_day_allowed, requires_certificate_after_days, eligible_gender, counts_calendar_days')
    .order('code');
  const leaveTypes = (lt ?? []) as LeaveTypeRow[];

  return (
    <>
      <PageHeader title="Settings" sub="Locations, departments and holidays" />

      <Card title="Locations">
        <table className="stack">
          <thead><tr><th>Name</th><th>Weekly offs</th></tr></thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}><td data-label="Name">{l.name}</td><td data-label="Weekly offs">{l.weekly_off_days.map((d) => DAYS[d]).join(', ')}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>Departments: {departments.map((d) => d.name).join(', ')}</p>
      </Card>

      <Card title="Leave types">
        <p className="hint" style={{ marginBottom: 12 }}>
          Quota, how leave is earned, the carry-forward limit and whether half days are allowed. Balances are calculated live, so a change applies to
          <strong> everyone straight away</strong> (including this year&apos;s accrual); leave already approved is not touched. Every change is recorded in the audit log.
          Types are never deleted, because old requests and reports refer to them.
        </p>
        {leaveTypes.map((t) => (
          <details key={t.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>{t.code}</strong> {t.name}
              <span className="hint">
                {t.accrual_method === 'none' ? 'unpaid, no quota' : `${Number(t.annual_quota)} days`} · {ACCRUAL_LABEL[t.accrual_method]}
                {Number(t.carry_forward_max) > 0 && ` · carry forward up to ${Number(t.carry_forward_max)}`} · half day {t.half_day_allowed ? 'yes' : 'no'}
              </span>
            </summary>
            <div style={{ padding: '12px 0 4px' }}>
              <LeaveTypeForm mode="edit" type={{ id: t.id, code: t.code, name: t.name, annual_quota: Number(t.annual_quota), accrual_method: t.accrual_method, carry_forward_max: Number(t.carry_forward_max), half_day_allowed: t.half_day_allowed }} />
              <p className="hint" style={{ marginTop: 8 }}>
                Fixed for this type: {t.requires_certificate_after_days !== null ? `certificate needed after ${Number(t.requires_certificate_after_days)} days; ` : ''}
                {t.eligible_gender !== 'any' ? `only for ${t.eligible_gender} employees; ` : ''}{t.counts_calendar_days ? 'counts calendar days; ' : 'counts working days only; '}
                {t.code === 'LOP' ? 'Loss of Pay never accrues.' : ''}
              </p>
            </div>
          </details>
        ))}
        <details style={{ padding: '8px 0' }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}><strong>+ Add a leave type</strong></summary>
          <div style={{ padding: '12px 0 4px' }}><LeaveTypeForm mode="add" /></div>
        </details>
      </Card>

      <Card title="Add a holiday">
        <HolidayForm locations={locations.map((l) => ({ value: l.id, label: l.name }))} />
      </Card>

      <Card title={`Holidays ${year}`}>
        <form className="row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="loc">Location</label>
            <select id="loc" name="loc" defaultValue={f.loc ?? ''}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <input type="hidden" name="year" value={year} />
          <button className="btn btn-secondary" type="submit">Filter</button>
        </form>
        {holidays.length === 0 ? (
          <EmptyState title="No holidays added for this view." hint="Add one above. Holidays apply only to the location you pick." />
        ) : (
          <table className="stack">
            <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Location</th><th /></tr></thead>
            <tbody>
              {holidays.map((h) => {
                const loc = Array.isArray(h.locations) ? h.locations[0] : h.locations;
                return (
                  <tr key={h.id}>
                    <td data-label="Date">{formatDateIST(h.date)}</td>
                    <td data-label="Name">{h.name}</td>
                    <td data-label="Type"><Pill tone={h.type === 'Optional' ? 'warn' : 'neutral'}>{h.type}</Pill></td>
                    <td data-label="Location">{loc?.name}</td>
                    <td><form action={deleteHolidayAction}><input type="hidden" name="id" value={h.id} /><button className="btn btn-secondary btn-sm">Delete</button></form></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
