import { UserButton } from '@clerk/nextjs';
import { Logo } from './Logo';
import { NavLinks, type NavItem } from './NavLinks';

export function navFor(s: { isHr: boolean; isManager: boolean }): NavItem[] {
  const items: NavItem[] = [
    { href: '/dashboard', label: 'Home' },
    { href: '/attendance', label: 'Attendance' },
    { href: '/leave', label: 'Leave' },
    { href: '/leave/apply', label: 'Apply' },
    { href: '/profile', label: 'Profile' },
  ];
  if (s.isHr || s.isManager) items.push({ href: '/approvals', label: 'Approvals' }, { href: '/team', label: 'Team' }, { href: '/team/leave', label: 'Leave calendar' });
  if (s.isHr) items.push({ href: '/employees', label: 'Employees' }, { href: '/settings', label: 'Settings' });
  return items;
}

/** Props are plain values on purpose: passing the session (it holds the database client) breaks React's dev debug channel. */
export function AppShell({ fullName, employeeCode, isHr, isManager, children }: {
  fullName: string; employeeCode: string; isHr: boolean; isManager: boolean; children: React.ReactNode;
}) {
  const items = navFor({ isHr, isManager });
  // The phone bar has room for five: approvers swap Profile for Approvals.
  const phone = (isHr || isManager ? items.filter((i) => ['/dashboard', '/attendance', '/leave', '/leave/apply', '/approvals'].includes(i.href)) : items.slice(0, 5));
  const role = isHr ? 'HR Admin' : isManager ? 'Manager' : 'Employee';
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <NavLinks items={items} variant="side" />
        <div className="whoami">
          <UserButton />
          <div>
            <div className="who-name">{fullName}</div>
            <div className="hint">{employeeCode} · {role}</div>
          </div>
        </div>
      </aside>
      <main id="main">{children}</main>
      <NavLinks items={phone} variant="bottom" />
    </div>
  );
}
