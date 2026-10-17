import { PageHeader } from '@/components/ui/Card';
import { requireEmployee } from '@/lib/auth/session';
import { getEmployeeDetail } from '@/modules/employees/queries';
import { PROFILE_TABS, ProfileView, type ProfileTab } from '@/modules/employees/ProfileView';
import { notFound } from 'next/navigation';

export default async function MyProfile({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireEmployee();
  const { tab } = await searchParams;
  const active = (PROFILE_TABS as readonly string[]).includes(tab ?? '') && tab !== 'history' ? (tab as ProfileTab) : 'personal';
  // Always the signed-in employee's own row: there is no id in the URL to tamper with.
  const employee = await getEmployeeDetail(s.db, s.employee.id);
  if (!employee) notFound();
  return (
    <>
      <PageHeader title="My profile" sub={`${employee.full_name} · ${employee.employee_code}`} />
      <ProfileView employee={employee} tab={active} mode="self" basePath="/profile" />
    </>
  );
}
