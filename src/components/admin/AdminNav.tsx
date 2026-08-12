'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/pages', label: 'Pages' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/media', label: 'Images' },
  { href: '/admin/typography', label: 'Typography' },
  { href: '/admin/navigation', label: 'Menu' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 lg:block">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="lg:py-1">
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                // El activo se marca con subrayado, igual que los enlaces del
                // portafolio, en vez de con una pastilla de color.
                className={
                  active
                    ? 'underline decoration-1 underline-offset-[5px]'
                    : 'text-(--ink-muted) transition-colors hover:text-(--ink)'
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
