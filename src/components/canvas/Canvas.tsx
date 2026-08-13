import type { CSSProperties } from 'react';
import type { BlockData, TextStyleData } from '@/lib/content';
import { BlockView } from './BlockView';
import { HoverStyles } from './HoverStyles';

interface CanvasProps {
  heightDesktop: number;
  heightMobile: number;
  blocks: BlockData[];
  textStyles: Map<string, TextStyleData>;
}

/**
 * Hasta dónde llega el primer pantallazo, en unidades de diseño.
 *
 * En escritorio la unidad vale un píxel a partir de 1024 de ancho, así que el
 * pliegue coincide con el alto de la ventana. En móvil el lienzo de 320 se
 * escala: en un teléfono de 390×844 la unidad vale 1,22 y caben unas 690.
 */
const FOLD = { desktop: 900, mobile: 700 };

/** Área mínima para que una imagen pueda ser el elemento mayor de la página. */
const MIN_AREA = 40_000;

/**
 * Marca las imágenes que hay que cargar de inmediato.
 *
 * Next avisa por consola cuando la imagen más grande del primer pantallazo se
 * carga en diferido, porque retrasa el Largest Contentful Paint. Lo que pide es
 * exactamente `loading="eager"`, y es lo que se hace aquí —no `priority`, que
 * además añade un `<link rel=preload>`—.
 *
 * La distinción importa en este sitio: escritorio y móvil son dos maquetaciones
 * independientes sobre el mismo DOM, así que la imagen mayor del primer
 * pantallazo **no es la misma en las dos**, y una precarga no entiende de media
 * queries: acabaría descargando en el teléfono la imagen que solo se ve en
 * escritorio. Cargar sin diferir no tiene ese problema, porque la que está
 * oculta por CSS no llega a pedirse.
 *
 * Se recorren los dos viewports y se toma la mayor de cada uno. Se descartan los
 * bloques de cabecera —el wordmark es una imagen, y en la portada era la única
 * por encima del pliegue— y todo lo menor que `MIN_AREA`, para no adelantar un
 * logotipo en las páginas cuyo elemento mayor es en realidad un texto.
 */
function eagerImages(blocks: BlockData[]): Record<'desktop' | 'mobile', string | null> {
  const out: Record<'desktop' | 'mobile', string | null> = {
    desktop: null,
    mobile: null,
  };

  for (const viewport of ['desktop', 'mobile'] as const) {
    const fold = FOLD[viewport];
    let best: { id: string; visible: number } | null = null;

    for (const block of blocks) {
      if (block.kind !== 'IMAGE') continue;
      const g = viewport === 'desktop' ? block.d : block.m;
      if (g.hidden || g.fixed || g.y > fold) continue;
      // El umbral mira la imagen entera —una foto grande sigue siéndolo aunque
      // asome poco— pero la comparación mira solo la parte que se ve. En la
      // portada móvil hay una imagen mayor que empieza a doce unidades del
      // pliegue: gana por tamaño y sin embargo la que pinta es la de arriba.
      if (g.w * g.h < MIN_AREA) continue;
      const visible = g.w * Math.max(0, Math.min(g.y + g.h, fold) - g.y);
      if (!best || visible > best.visible) best = { id: block.id, visible };
    }

    out[viewport] = best?.id ?? null;
  }

  return out;
}

/**
 * Lienzo de posición absoluta, réplica del modelo de Readymag.
 *
 * El alto se declara en unidades de diseño (1024 de ancho en desktop, 320 en
 * móvil) y globals.css lo convierte a píxeles reales mediante `--u`. No hay
 * medición en JavaScript: el escalado es CSS puro, así que no hay salto entre
 * el HTML servido y la hidratación.
 *
 * Los bloques anclados al viewport se dibujan aquí dentro junto al resto, no en
 * una capa aparte: su z-index de diseño los ordena contra el contenido de la
 * página, y en el original hay casos que dependen de ello —en la portada, el
 * texto de presentación va anclado con z 301 y las fotos de proyecto, con 302 a
 * 305, pasan por encima al hacer scroll—. `isolation` mantiene esos números
 * dentro de la página, para que no compitan con el menú.
 */
export function Canvas({ heightDesktop, heightMobile, blocks, textStyles }: CanvasProps) {
  const style = {
    '--rm-h': heightDesktop,
    '--rm-mh': heightMobile,
  } as CSSProperties;

  const eager = eagerImages(blocks);

  return (
    <div className="rm-stage">
      <div className="rm-canvas" style={style}>
        <HoverStyles blocks={blocks} />
        {blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            textStyles={textStyles}
            eager={{
              desktop: eager.desktop === block.id,
              mobile: eager.mobile === block.id,
            }}
          />
        ))}
      </div>
    </div>
  );
}
