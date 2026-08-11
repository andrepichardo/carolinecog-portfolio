import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const pages = await prisma.page.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true, kind: true },
    orderBy: { order: 'asc' },
  });

  return pages.map((page) => ({
    url: page.slug === '' ? `${base}/` : `${base}/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: page.kind === 'HOME' ? 1 : 0.8,
  }));
}
