import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { siteUrl } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
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
