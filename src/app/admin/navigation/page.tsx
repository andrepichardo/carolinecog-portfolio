import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';
import { NavigationEditor } from '@/components/admin/NavigationEditor';

export const dynamic = 'force-dynamic';

export default async function NavigationPage() {
  await requireUser();

  const [items, pages] = await Promise.all([
    prisma.navItem.findMany({ orderBy: { order: 'asc' } }),
    prisma.page.findMany({ orderBy: { order: 'asc' }, select: { id: true, title: true, slug: true } }),
  ]);

  return (
    <AdminShell
      title="Menu"
      description="Items in the hamburger menu."
    >
      <NavigationEditor
        items={items.map((i) => ({ id: i.id, label: i.label, pageId: i.pageId, url: i.url }))}
        pages={pages}
      />
    </AdminShell>
  );
}
