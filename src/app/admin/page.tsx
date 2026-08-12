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

  const counts = [
    { label: 'Pages', value: pages, href: '/admin/pages' },
    { label: 'Projects', value: projects, href: '/admin/projects' },
    { label: 'Blocks', value: blocks, href: '/admin/pages' },
    { label: 'Images', value: assets, href: '/admin/media' },
    { label: 'Text styles', value: styles, href: '/admin/typography' },
  ];

  const guide = [
    {
      title: 'Pages',
      body: 'Each page is a canvas. Move, resize and edit every block, with separate views for desktop and mobile.',
    },
    {
      title: 'Projects',
      body: 'Spec details — client, year, supervision — plus the order they appear in and which project comes next.',
    },
    {
      title: 'Typography',
      body: 'Shared text styles. Changing one updates every piece of text that uses it.',
    },
    {
      title: 'Settings',
      body: 'Title, description, favicon, background colour and contact links.',
    },
  ];

  return (
    <AdminShell
      title="Overview"
      description="Everything on the portfolio, editable from here."
    >
      <ul className="grid grid-cols-2 border-t border-(--rule-strong) sm:grid-cols-3 lg:grid-cols-5">
        {counts.map((card) => (
          <li key={card.label} className="border-b border-(--rule)">
            <Link
              href={card.href}
              className="block py-5 transition-opacity hover:opacity-60 lg:pr-4"
            >
              <span className="admin-display block text-[40px] tabular-nums">
                {card.value}
              </span>
              <span className="admin-eyebrow mt-1 block">{card.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <dl className="mt-12 grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {guide.map((item) => (
          <div key={item.title}>
            <dt className="admin-eyebrow border-t border-(--rule-strong) pt-2">
              {item.title}
            </dt>
            <dd className="admin-muted mt-2">{item.body}</dd>
          </div>
        ))}
      </dl>
    </AdminShell>
  );
}
