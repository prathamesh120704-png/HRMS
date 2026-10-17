import { AppShell } from '@/components/AppShell';
import { requireEmployee } from '@/lib/auth/session';

// Every page in this group needs a signed-in, active employee. Individual pages add their own role checks.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireEmployee();
  return (
    <AppShell fullName={session.employee.full_name} employeeCode={session.employee.employee_code} isHr={session.isHr} isManager={session.isManager}>
      {children}
    </AppShell>
  );
}
