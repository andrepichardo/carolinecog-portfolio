import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { BlockData, TextStyleData } from '@/lib/content';
import { firstOfKind } from '@/lib/animation';
import { TextView } from './TextView';
import { ImageView } from './ImageView';
import { ShapeView } from './ShapeView';
import { ScrollAnimated } from './ScrollAnimated';

interface BlockViewProps {
  block: BlockData;
  textStyles: Map<string, TextStyleData>;
  /** Variables extra que inyecta el menú global para animar clics. */
  styleOverride?: CSSProperties;
  /** Atributos extra (interactividad y accesibilidad del botón del menú). */
  attrs?: Record<string, unknown>;
}

/**
 * Geometría del bloque como variables CSS.
 *
 * Se emiten los dos viewports a la vez y es el breakpoint de globals.css quien
 * decide cuál se lee. Así el DOM es único: las imágenes no se descargan dos
 * veces ni hace falta renderizar el árbol por duplicado.
 */
function geometryVars(block: BlockData): CSSProperties {
  const { d, m } = block;
  return {
    '--dx': d.x,
    '--dy': d.y,
    '--dw': d.w,
    '--dh': d.h,
    '--d-rotate': `${d.rotation}deg`,
    '--d-display': d.hidden ? 'none' : 'block',
    '--mx': m.x,
    '--my': m.y,
    '--mw': m.w,
    '--mh': m.h,
    '--m-rotate': `${m.rotation}deg`,
    '--m-display': m.hidden ? 'none' : 'block',
    '--z': block.z,
    '--opacity': block.opacity,
  } as CSSProperties;
}

function BlockContent({ block, textStyles }: BlockViewProps): ReactNode {
  switch (block.kind) {
    case 'TEXT':
      return <TextView block={block} textStyles={textStyles} />;
    case 'IMAGE':
      return <ImageView block={block} />;
    case 'SHAPE':
      return <ShapeView block={block} />;
    default:
      return null;
  }
}

export function BlockView({ block, textStyles, styleOverride, attrs }: BlockViewProps) {
  const scroll = firstOfKind(block.animations, 'SCROLL');
  const hover = firstOfKind(block.animations, 'HOVER');

  let content: ReactNode = <BlockContent block={block} textStyles={textStyles} />;

  // Los enlaces envuelven el contenido, no el bloque: así el área clicable
  // coincide exactamente con la caja del widget, como en el original.
  if (block.href) {
    const isExternal = /^(https?:|mailto:|tel:)/.test(block.href);
    content = isExternal ? (
      <a
        href={block.href}
        target={block.target === '_blank' ? '_blank' : undefined}
        rel={block.target === '_blank' ? 'noopener noreferrer' : undefined}
        className="block h-full w-full"
      >
        {content}
      </a>
    ) : (
      <Link href={block.href} className="block h-full w-full">
        {content}
      </Link>
    );
  }

  // La animación de scroll transforma una capa interior, no el bloque: el
  // bloque conserva su caja (y su anclaje al viewport) mientras la capa se
  // desplaza y escala alrededor de su centro, igual que en el original.
  if (scroll) {
    content = <ScrollAnimated animation={scroll}>{content}</ScrollAnimated>;
  }

  return (
    <div
      className="rm-block"
      style={{ ...geometryVars(block), ...styleOverride }}
      data-id={block.id}
      data-fixed={block.d.fixed ?? undefined}
      data-fixed-mobile={block.m.fixed ?? undefined}
      {...attrs}
      // El disparador y el destino de un hover pueden ser bloques distintos
      // (en el original, un rectángulo invisible sobre la imagen). HoverStyles
      // genera las reglas que los conectan usando estos atributos.
      data-hv-target={hover ? block.id : undefined}
      data-hv-trigger={block.id}
    >
      {content}
    </div>
  );
}
