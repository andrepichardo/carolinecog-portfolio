import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Canvas } from '@/components/canvas/Canvas';
import { getPage, getSettings, getTextStyles } from '@/lib/content';

/** Renderiza una página del portafolio a partir de su slug. */
export async function PageCanvas({ slug }: { slug: string }) {
  const [page, textStyles] = await Promise.all([getPage(slug), getTextStyles()]);
  if (!page) notFound();

  return (
    <main style={page.backgroundColor ? { backgroundColor: page.backgroundColor } : undefined}>
      <Canvas
        heightDesktop={page.heightDesktop}
        heightMobile={page.heightMobile}
        blocks={page.blocks}
        textStyles={textStyles}
      />
    </main>
  );
}

/** Metadatos de una página, con los ajustes del sitio como respaldo. */
export async function pageMetadata(slug: string): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPage(slug), getSettings()]);
  if (!page) return {};

  const description = page.seoDescription ?? settings?.metaDescription ?? undefined;
  const images = page.ogImageUrl ?? settings?.ogImage?.url;

  return {
    title: page.seoTitle ?? page.title,
    description,
    openGraph: {
      title: page.seoTitle ?? page.title,
      description,
      images: images ? [images] : undefined,
    },
  };
}
