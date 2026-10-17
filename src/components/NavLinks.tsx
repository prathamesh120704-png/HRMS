'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem { href: string; label: string }

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'side' | 'bottom' }) {
  const path = usePathname();
  // Highlight only the most specific match, so /leave/apply does not also light up /leave.
  const matches = items.filter((i) => path === i.href || path.startsWith(`${i.href}/`));
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className={variant === 'side' ? 'sidenav' : 'bottomnav'} aria-label={variant === 'side' ? 'Main' : 'Main (mobile)'}>
      {items.map((i) => {
        const active = i.href === best;
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>{i.label}</Link>
        );
      })}
    </nav>
  );
}
