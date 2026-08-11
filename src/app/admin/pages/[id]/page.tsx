import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageEditor } from '@/components/admin/PageEditor';

export const dynamic = 'force-dynamic';

export default async function PageEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [page, assets, pages, textStyles] = await Promise.all([
    prisma.page.findUnique({
      where: { id },
      include: { blocks: { orderBy: { z: 'asc' } } },
    }),
    prisma.asset.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.page.findMany({ orderBy: { order: 'asc' }, select: { id: true, title: true, slug: true } }),
    prisma.textStyle.findMany({ orderBy: { order: 'asc' }, select: { key: true, label: true } }),
  ]);

  if (!page) notFound();

  return (
    <AdminShell
      wide
      title={page.title}
      description={`Lienzo de la página /${page.slug}`}
      actions={
        <Link href="/admin/pages" className="admin-btn">
          Volver
        </Link>
      }
    >
      <PageEditor
        page={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          published: page.published,
          heightDesktop: page.heightDesktop,
          heightMobile: page.heightMobile,
          backgroundColor: page.backgroundColor,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
        }}
        blocks={page.blocks.map((b) => ({
          id: b.id,
          kind: b.kind,
          name: b.name,
          z: b.z,
          opacity: b.opacity,
          dX: b.dX,
          dY: b.dY,
          dW: b.dW,
          dH: b.dH,
          dRotation: b.dRotation,
          dHidden: b.dHidden,
          dFixed: b.dFixed,
          mX: b.mX,
          mY: b.mY,
          mW: b.mW,
          mH: b.mH,
          mRotation: b.mRotation,
          mHidden: b.mHidden,
          mFixed: b.mFixed,
          text: b.text,
          image: b.image,
          shape: b.shape,
          assetId: b.assetId,
          linkUrl: b.linkUrl,
          linkPageId: b.linkPageId,
          linkTarget: b.linkTarget,
        }))}
        assets={assets.map((a) => ({
          id: a.id,
          url: a.url,
          filename: a.filename,
          isSvg: a.isSvg,
          width: a.width,
          height: a.height,
        }))}
        pages={pages}
        textStyles={textStyles}
      />
    </AdminShell>
  );
}
