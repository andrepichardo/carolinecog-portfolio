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
      // Se traen las páginas donde aparece cada imagen para poder decir dónde
      // está en uso, en vez de limitarse a bloquear el borrado sin explicar.
      blocks: { select: { page: { select: { id: true, title: true } } } },
      mobileBlocks: { select: { page: { select: { id: true, title: true } } } },
    },
  });

  return (
    <AdminShell wide title="Images" description="One library, shared across every page.">
      <MediaLibrary
        assets={assets.map((a) => {
          const pages = new Map<string, string>();
          for (const b of [...a.blocks, ...a.mobileBlocks]) {
            if (b.page) pages.set(b.page.id, b.page.title);
          }
          return {
            id: a.id,
            url: a.url,
            filename: a.filename,
            alt: a.alt,
            isSvg: a.isSvg,
            width: a.width,
            height: a.height,
            bytes: a.bytes,
            uses: a.blocks.length + a.mobileBlocks.length,
            usedOn: [...pages.entries()].map(([id, title]) => ({ id, title })),
            isExternal: !a.pathname,
          };
        })}
      />
    </AdminShell>
  );
}
