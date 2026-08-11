import type { Metadata } from 'next';
import { PageCanvas, pageMetadata } from '@/components/site/PageCanvas';
import { getPublishedSlugs } from '@/lib/content';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.filter((slug) => slug !== '').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <PageCanvas slug={slug} />;
}
