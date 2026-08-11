import Link from 'next/link';
import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  await requireUser();

  const [pages, blocks, assets, projects, styles] = await Promise.all([
    prisma.page.count(),
    prisma.block.count(),
    prisma.asset.count(),
    prisma.project.count(),
    prisma.textStyle.count(),
  ]);

  const cards = [
    { label: 'Páginas', value: pages, href: '/admin/pages' },
    { label: 'Proyectos', value: projects, href: '/admin/projects' },
    { label: 'Bloques', value: blocks, href: '/admin/pages' },
    { label: 'Imágenes', value: assets, href: '/admin/media' },
    { label: 'Estilos de texto', value: styles, href: '/admin/typography' },
  ];

  return (
    <AdminShell title="Resumen" description="Todo el contenido del portafolio, editable desde aquí.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="admin-card hover:bg-[var(--admin-surface)]">
            <p className="text-[12px] font-semibold text-[var(--admin-muted)]">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="admin-card mt-6">
        <h2 className="mb-2 font-semibold">Cómo está organizado</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[var(--admin-muted)]">
          <li>
            <strong className="text-[var(--admin-text)]">Páginas</strong> — cada una es un lienzo.
            Desde el editor se mueve, redimensiona y edita cada bloque, con vistas separadas para
            escritorio y móvil.
          </li>
          <li>
            <strong className="text-[var(--admin-text)]">Proyectos</strong> — los datos de ficha
            (cliente, año, supervisión) y el orden en que aparecen.
          </li>
          <li>
            <strong className="text-[var(--admin-text)]">Tipografía</strong> — los estilos
            compartidos. Cambiar uno afecta a todos los textos que lo usan.
          </li>
          <li>
            <strong className="text-[var(--admin-text)]">Ajustes</strong> — título, descripción,
            favicon, color de fondo y enlaces de contacto.
          </li>
        </ul>
      </div>
    </AdminShell>
  );
}
