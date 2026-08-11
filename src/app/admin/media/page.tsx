import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';
import { MediaLibrary } from '@/components/admin/MediaLibrary';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  await requireUser();

  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { blocks: true, mobileBlocks: true } },
    },
  });

  return (
    <AdminShell
      wide
      title="Imágenes"
      description="Biblioteca compartida por todas las páginas."
    >
      <MediaLibrary
        assets={assets.map((a) => ({
          id: a.id,
          url: a.url,
          filename: a.filename,
          alt: a.alt,
          isSvg: a.isSvg,
          width: a.width,
          height: a.height,
          bytes: a.bytes,
          uses: a._count.blocks + a._count.mobileBlocks,
          isExternal: !a.pathname,
        }))}
      />
    </AdminShell>
  );
}
