import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';
import { TypographyEditor } from '@/components/admin/TypographyEditor';

export const dynamic = 'force-dynamic';

export default async function TypographyPage() {
  await requireUser();
  const styles = await prisma.textStyle.findMany({ orderBy: { order: 'asc' } });

  return (
    <AdminShell
      title="Typography"
      description="Shared styles. Changing one updates every piece of text that uses it."
    >
      <TypographyEditor styles={styles} />
    </AdminShell>
  );
}
