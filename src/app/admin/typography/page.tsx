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
      title="Tipografía"
      description="Estilos compartidos. Cambiar uno afecta a todos los textos que lo usan."
    >
      <TypographyEditor styles={styles} />
    </AdminShell>
  );
}
