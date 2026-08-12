import Link from 'next/link';
import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  HOME: 'Home',
  ABOUT: 'About',
  CONTACT: 'Contact',
  PROJECT: 'Project',
  CUSTOM: 'Custom',
};

export default async function PagesList() {
  await requireUser();

  const pages = await prisma.page.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { blocks: true } } },
  });

  return (
    <AdminShell
      title="Pages"
      description="Every page is a canvas with its own blocks."
    >
      <ul className="border-t border-(--rule-strong)">
        {pages.map((page) => (
          <li key={page.id} className="border-b border-(--rule)">
            <Link
              href={`/admin/pages/${page.id}`}
              className="group flex items-baseline gap-5 py-5 transition-opacity hover:opacity-60"
            >
              <span className="admin-eyebrow w-16 shrink-0">
                {KIND_LABEL[page.kind] ?? page.kind}
              </span>
              <span className="admin-display min-w-0 flex-1 truncate text-[26px]">
                {page.title}
              </span>
              <span className="admin-muted hidden text-[12px] sm:block">
                /{page.slug} · {page._count.blocks} blocks
              </span>
              {!page.published ? (
                <span className="admin-eyebrow">Draft</span>
              ) : null}
              <span aria-hidden className="admin-muted">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
