import type { Metadata } from 'next';
import './globals.css';
import { fontVariables } from '@/lib/fonts';
import { getSettings } from '@/lib/content';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings?.siteTitle ?? 'Caroline Contreras';
  const description = settings?.metaDescription ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: { default: title, template: `%s — ${title}` },
    description,
    icons: settings?.favicon?.url ? { icon: settings.favicon.url } : undefined,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: title,
      images: settings?.ogImage?.url ? [settings.ogImage.url] : undefined,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const adobeKit = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT;

  return (
    <html
      lang="en"
      // `fonts-adobe` hace que las variables tipográficas resuelvan a las
      // familias originales en lugar de a los sustitutos libres.
      className={`${fontVariables}${adobeKit ? ' fonts-adobe' : ''}`}
      style={{ '--rm-bg': settings?.backgroundColor ?? '#efefef' } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
