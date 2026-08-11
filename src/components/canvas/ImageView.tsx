import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { AssetData, BlockData } from '@/lib/content';
import type { ImageContent } from '@/lib/content-types';

/**
 * Recorte al estilo Readymag.
 *
 * El widget guarda un rectángulo de recorte en píxeles de la imagen original y
 * un factor `scale` (unidades de diseño por píxel original, igual a
 * ancho del bloque / ancho del recorte). Se reproduce dibujando la imagen
 * completa a `original × scale` y desplazándola `-crop × scale`, todo dentro de
 * una caja con overflow oculto. Es exactamente lo que hace el original, y al
 * expresarlo en unidades de diseño escala solo con el resto del lienzo.
 */
function cropVars(content: ImageContent | null, prefix: 'c' | 'mc'): CSSProperties {
  if (!content?.crop || !content.original) return {};
  const scale = content.scale ?? 1;
  return {
    [`--${prefix}-w`]: content.original.w * scale,
    [`--${prefix}-h`]: content.original.h * scale,
    [`--${prefix}-x`]: -content.crop.x * scale,
    [`--${prefix}-y`]: -content.crop.y * scale,
  } as CSSProperties;
}

function radiusVars(content: ImageContent | null): CSSProperties {
  if (!content) return {};
  const c = content.radiusCorners;
  if (c) {
    return {
      '--rm-radius-tl': c.tl,
      '--rm-radius-tr': c.tr,
      '--rm-radius-br': c.br,
      '--rm-radius-bl': c.bl,
    } as CSSProperties;
  }
  return { '--rm-radius': content.radius ?? 0 } as CSSProperties;
}

function SvgAsset({ asset, className }: { asset: AssetData; className: string }) {
  // Los SVG se incrustan en línea (el wordmark, las flechas): así escalan sin
  // pérdida y pueden heredar color, igual que en el original.
  return (
    <div
      className={className}
      // El markup viene de la biblioteca de assets del CMS, no de entrada
      // pública: se sanea al subir en src/lib/svg.ts.
      dangerouslySetInnerHTML={{ __html: asset.svgMarkup ?? '' }}
    />
  );
}

export function ImageView({ block }: { block: BlockData }) {
  const asset = block.asset;
  const mobileAsset = block.mobileAsset;
  const content = block.image;
  const mobileContent = block.mobileImage;

  if (!asset && !mobileAsset) return null;

  const hasSeparateMobile = Boolean(mobileAsset && mobileAsset.id !== asset?.id);
  const fit = content?.objectFit === 'contain' ? ' rm-image--contain' : '';

  const style: CSSProperties = {
    ...radiusVars(content),
    ...cropVars(content, 'c'),
    ...cropVars(mobileContent ?? content, 'mc'),
  };

  const alt = content?.alt ?? asset?.alt ?? '';

  if (asset?.isSvg && !hasSeparateMobile) {
    return <SvgAsset asset={asset} className={`rm-image rm-image--svg${fit}`} />;
  }

  const cropped = Boolean(content?.crop && content?.original);

  return (
    <div className={`rm-image${fit}${cropped ? ' rm-image--cropped' : ''}`} style={style}>
      {asset && !asset.isSvg ? (
        <Image
          src={asset.url}
          alt={alt}
          width={asset.width ?? content?.original?.w ?? 1024}
          height={asset.height ?? content?.original?.h ?? 1024}
          className={hasSeparateMobile ? 'rm-only-desktop' : undefined}
          placeholder={asset.blurDataUrl ? 'blur' : 'empty'}
          blurDataURL={asset.blurDataUrl ?? undefined}
          sizes="(max-width: 767px) 100vw, 1024px"
        />
      ) : asset?.isSvg ? (
        <div
          className={hasSeparateMobile ? 'rm-only-desktop' : undefined}
          dangerouslySetInnerHTML={{ __html: asset.svgMarkup ?? '' }}
        />
      ) : null}

      {hasSeparateMobile && mobileAsset ? (
        mobileAsset.isSvg ? (
          <div
            className="rm-only-mobile"
            dangerouslySetInnerHTML={{ __html: mobileAsset.svgMarkup ?? '' }}
          />
        ) : (
          <Image
            src={mobileAsset.url}
            alt={alt}
            width={mobileAsset.width ?? 1024}
            height={mobileAsset.height ?? 1024}
            className="rm-only-mobile"
            placeholder={mobileAsset.blurDataUrl ? 'blur' : 'empty'}
            blurDataURL={mobileAsset.blurDataUrl ?? undefined}
            sizes="100vw"
          />
        )
      ) : null}
    </div>
  );
}
