import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Card';
import { requireEmployee } from '@/lib/auth/session';
import { getEmployeeDetail } from '@/modules/employees/queries';
import { PROFILE_TABS, ProfileView, type ProfileTab } from '@/modules/employees/ProfileView';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EmployeeDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; created?: string }>;
}) {
  const s = await requireEmployee();
  // URL tampering: anyone who is not HR gets a 404 (not 403), so the id's existence is not revealed.
  if (!s.isHr) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { tab, created } = await searchParams;
  const active = (PROFILE_TABS as readonly string[]).includes(tab ?? '') ? (tab as ProfileTab) : 'personal';
  const employee = await getEmployeeDetail(s.db, id);
  if (!employee) notFound();
  return (
    <>
      <PageHeader title={employee.full_name} sub={`${employee.employee_code} · ${employee.designation}`} />
      {created && <div className="alert alert-ok" role="status">Employee added. Code {employee.employee_code} was generated.</div>}
      <ProfileView employee={employee} tab={active} mode="hr" basePath={`/employees/${id}`} />
    </>
  );
}
