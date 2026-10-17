import Link from 'next/link';
import { requireEmployee } from '@/lib/auth/session';
import { Card, EmptyState } from '@/components/ui/Card';
import { Pill } from '@/components/ui/StatusBadge';
import { formatDateIST, formatIST } from '@/lib/time/ist';
import { ContactForm } from './ContactForm';
import { JobForm } from './JobForm';
import { DeactivateForm, RevealButton } from './HrControls';
import { auditFor, getMaskedSensitive, managerOptions, referenceData, type EmployeeDetail } from './queries';

export const PROFILE_TABS = ['personal', 'job', 'statutory', 'bank', 'emergency', 'history'] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];
const LABEL: Record<ProfileTab, string> = {
  personal: 'Personal', job: 'Job', statutory: 'Statutory', bank: 'Bank', emergency: 'Emergency contact', history: 'History',
};

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>))}
    </dl>
  );
}

/**
 * One profile view for both "My profile" and HR's view of an employee.
 * `mode='self'`: contact fields editable, job fields read-only (E5). `mode='hr'`: job editable, Reveal and History shown.
 */
export async function ProfileView({ employee, tab, mode, basePath }: {
  employee: EmployeeDetail; tab: ProfileTab; mode: 'self' | 'hr'; basePath: string;
}) {
  const { db } = await requireEmployee(); // cached per request; never passed down as a prop
  const tabs = PROFILE_TABS.filter((t) => t !== 'history' || mode === 'hr');
  const masked = tab === 'statutory' || tab === 'bank' ? await getMaskedSensitive(db, employee.id) : null;

  return (
    <>
      <nav className="tabs" aria-label="Profile sections">
        {tabs.map((t) => (
          <Link key={t} href={`${basePath}?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>{LABEL[t]}</Link>
        ))}
      </nav>

      {tab === 'personal' && (
        <Card title="Personal">
          <KV rows={[
            ['Name', employee.full_name], ['Email', employee.email], ['Mobile', employee.mobile],
            ['Date of birth', formatDateIST(employee.dob)], ['Gender', employee.gender],
            ['Address', [employee.address_line, employee.city, employee.state, employee.pin].filter(Boolean).join(', ') || null],
          ]} />
          {mode === 'self' && (<><hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--line)' }} /><h2 style={{ marginBottom: 12 }}>Edit my contact details</h2><ContactForm employee={employee} /></>)}
        </Card>
      )}

      {tab === 'job' && (
        <Card title="Job">
          <KV rows={[
            ['Employee code', employee.employee_code], ['Designation', employee.designation],
            ['Department', employee.department?.name], ['Location', employee.location?.name],
            ['Reporting manager', employee.manager ? `${employee.manager.full_name} (${employee.manager.employee_code})` : 'None'],
            ['Date of joining', formatDateIST(employee.date_of_joining)],
            ['Last working day', employee.last_working_day ? formatDateIST(employee.last_working_day) : '—'],
            ['Status', <Pill key="s" tone={employee.status === 'active' ? 'ok' : 'neutral'}>{employee.status}</Pill>],
            ['Role', employee.is_hr_admin ? 'HR Admin' : 'Employee'],
            ...(mode === 'hr' ? ([['Salary grade', employee.salary_grade]] as [string, React.ReactNode][]) : []),
          ]} />
          {mode === 'self' && <p className="hint" style={{ marginTop: 16 }}>Job details are read-only. Ask HR to change them.</p>}
          {mode === 'hr' && <HrJobEditor employee={employee} />}
        </Card>
      )}

      {tab === 'statutory' && masked && (
        <Card title="Statutory">
          <KV rows={[
            ['PAN', <span key="p" className="row">{masked.pan ?? '—'}{mode === 'hr' && masked.pan && <RevealButton employeeId={employee.id} field="pan" label="PAN" />}</span>],
            ['Aadhaar', masked.aadhaar ?? '—'],
            ['UAN (PF)', masked.uan ?? 'Not provided yet'],
          ]} />
          <p className="hint" style={{ marginTop: 16 }}>Aadhaar is never shown in full anywhere in Tarang.</p>
        </Card>
      )}

      {tab === 'bank' && masked && (
        <Card title="Bank">
          <KV rows={[
            ['Account number', <span key="a" className="row">{masked.account ?? '—'}{mode === 'hr' && masked.account && <RevealButton employeeId={employee.id} field="account_number" label="account number" />}</span>],
            ['IFSC', masked.ifsc], ['Bank', masked.bank_name],
          ]} />
        </Card>
      )}

      {tab === 'emergency' && (
        <Card title="Emergency contact">
          <KV rows={[['Name', employee.emergency_name], ['Relationship', employee.emergency_relation], ['Mobile', employee.emergency_phone]]} />
          {mode === 'self' && <p className="hint" style={{ marginTop: 16 }}>Change these on the Personal tab.</p>}
        </Card>
      )}

      {tab === 'history' && mode === 'hr' && <History id={employee.id} />}
    </>
  );
}

async function HrJobEditor({ employee }: { employee: EmployeeDetail }) {
  const { db } = await requireEmployee();
  const [{ departments, locations }, managers] = await Promise.all([referenceData(db), managerOptions(db, employee.id)]);
  return (
    <>
      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--line)' }} />
      <h2 style={{ marginBottom: 12 }}>Edit job details</h2>
      <JobForm
        employee={employee}
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        locations={locations.map((l) => ({ value: l.id, label: l.name }))}
        managers={managers}
      />
      {employee.status === 'active' && (<div style={{ marginTop: 24 }}><DeactivateForm employeeId={employee.id} name={employee.full_name} /></div>)}
    </>
  );
}

async function History({ id }: { id: string }) {
  const { db } = await requireEmployee();
  const rows = await auditFor(db, id);
  return (
    <Card title="History (audit log)">
      {rows.length === 0 ? <EmptyState title="No changes recorded yet." hint="Job and statutory changes appear here." /> : (
        <table className="stack">
          <thead><tr><th>When (IST)</th><th>Who</th><th>Field</th><th>Old</th><th>New</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="When">{formatIST(r.changed_at)}</td>
                <td data-label="Who">{r.actor?.full_name ?? 'System'}</td>
                <td data-label="Field">{r.field}</td>
                <td data-label="Old">{r.action === 'REVEAL' ? 'REVEAL' : (r.old_value ?? '—')}</td>
                <td data-label="New">{r.action === 'REVEAL' ? '—' : (r.new_value ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
