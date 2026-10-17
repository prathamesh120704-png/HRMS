import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/StatusBadge';
import { requireHr } from '@/lib/auth/session';
import { formatDateIST, todayIST } from '@/lib/time/ist';
import { referenceData } from '@/modules/employees/queries';
import { deleteHolidayAction } from '@/modules/settings/actions';
import { HolidayForm } from '@/modules/settings/HolidayForm';

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
