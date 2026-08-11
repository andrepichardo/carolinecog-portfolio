import Link from 'next/link';
import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  HOME: 'Inicio',
  ABOUT: 'Sobre mí',
  CONTACT: 'Contacto',
  PROJECT: 'Proyecto',
  CUSTOM: 'Personalizada',
};

export default async function PagesList() {
  await requireUser();

  const pages = await prisma.page.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { blocks: true } } },
  });

  return (
    <AdminShell title="Páginas" description="Cada página es un lienzo con sus propios bloques.">
      <ul className="flex flex-col gap-2">
        {pages.map((page) => (
          <li key={page.id}>
            <Link
              href={`/admin/pages/${page.id}`}
              className="admin-card flex items-center gap-4 hover:bg-[var(--admin-surface)]"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {page.title}
                  {!page.published ? (
                    <span className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[11px] text-[var(--admin-muted)]">
                      borrador
                    </span>
                  ) : null}
                </p>
                <p className="text-[13px] text-[var(--admin-muted)]">
                  {KIND_LABEL[page.kind] ?? page.kind} · /{page.slug} · {page._count.blocks} bloques
                </p>
              </div>
              <span className="text-[var(--admin-muted)]" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
