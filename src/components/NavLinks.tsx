'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem { href: string; label: string }

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'side' | 'bottom' }) {
  const path = usePathname();
  return (
    <nav className={variant === 'side' ? 'sidenav' : 'bottomnav'} aria-label={variant === 'side' ? 'Main' : 'Main (mobile)'}>
      {items.map((i) => {
        const active = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>{i.label}</Link>
        );
      })}
    </nav>
  );
}
