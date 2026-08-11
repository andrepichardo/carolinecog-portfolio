import Script from 'next/script';
import { getGlobalBlocks, getTextStyles } from '@/lib/content';
import { GlobalMenu } from '@/components/site/GlobalMenu';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [globalBlocks, textStyles] = await Promise.all([getGlobalBlocks(), getTextStyles()]);
  const adobeKit = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT;

  return (
    <>
      {/* Cuando Caroline configure su proyecto web en fonts.adobe.com, este kit
          sustituye los tipos libres por los originales sin tocar nada más. */}
      {adobeKit ? (
        <>
          <Script
            id="adobe-fonts"
            strategy="beforeInteractive"
            src={`https://use.typekit.net/${adobeKit}.js`}
          />
          <Script id="adobe-fonts-init" strategy="beforeInteractive">
            {'try{Typekit.load({async:true});}catch(e){}'}
          </Script>
        </>
      ) : null}

      {children}

      <GlobalMenu blocks={globalBlocks} textStyles={[...textStyles.values()]} />
    </>
  );
}
