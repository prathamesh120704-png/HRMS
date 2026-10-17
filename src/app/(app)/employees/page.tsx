import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/StatusBadge';
import { requireHr } from '@/lib/auth/session';
import { listEmployees, referenceData } from '@/modules/employees/queries';

export default async function EmployeeDirectory({ searchParams }: {
  searchParams: Promise<{ q?: string; dept?: string; loc?: string; status?: string }>;
}) {
  const s = await requireHr();
  const f = await searchParams;
  const status = f.status ?? 'active';
  const [rows, { departments, locations }] = await Promise.all([
    listEmployees(s.db, { ...f, status }), referenceData(s.db),
  ]);

  return (
    <>
      <PageHeader title="Employees" sub={`${rows.length} shown`} action={<Link className="btn" href="/employees/new">+ Add employee</Link>} />
      <Card>
        <form className="row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
            <label htmlFor="q">Search name or code</label>
            <input id="q" name="q" defaultValue={f.q ?? ''} placeholder="e.g. Asha or KCF0007" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="dept">Department</label>
            <select id="dept" name="dept" defaultValue={f.dept ?? ''}>
              <option value="">All</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="loc">Location</label>
            <select id="loc" name="loc" defaultValue={f.loc ?? ''}>
              <option value="">All</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
          <button className="btn btn-secondary" type="submit">Filter</button>
        </form>

        {rows.length === 0 ? (
          <EmptyState title="No employees match." hint="Try clearing the filters, or add a new employee." />
        ) : (
          <table className="stack">
            <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Department</th><th>Location</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Code">{r.employee_code}</td>
                  <td data-label="Name"><Link href={`/employees/${r.id}`}>{r.full_name}</Link></td>
                  <td data-label="Designation">{r.designation}</td>
                  <td data-label="Department">{r.department?.name}</td>
                  <td data-label="Location">{r.location?.name}</td>
                  <td data-label="Status"><Pill tone={r.status === 'active' ? 'ok' : 'neutral'}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
