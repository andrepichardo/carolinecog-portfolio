'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Resumen', exact: true },
  { href: '/admin/pages', label: 'Páginas' },
  { href: '/admin/projects', label: 'Proyectos' },
  { href: '/admin/media', label: 'Imágenes' },
  { href: '/admin/typography', label: 'Tipografía' },
  { href: '/admin/navigation', label: 'Menú' },
  { href: '/admin/settings', label: 'Ajustes' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 transition-colors ${
              active
                ? 'bg-[var(--admin-accent)] text-white'
                : 'text-[var(--admin-text)] hover:bg-[rgb(0_0_0/0.05)]'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
