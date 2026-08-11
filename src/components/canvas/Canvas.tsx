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
 * Lienzo de posición absoluta, réplica del modelo de Readymag.
 *
 * El alto se declara en unidades de diseño (1024 de ancho en desktop, 320 en
 * móvil) y globals.css lo convierte a píxeles reales mediante `--u`. No hay
 * medición en JavaScript: el escalado es CSS puro, así que no hay salto entre
 * el HTML servido y la hidratación.
 */
export function Canvas({ heightDesktop, heightMobile, blocks, textStyles }: CanvasProps) {
  const style = {
    '--rm-h': heightDesktop,
    '--rm-mh': heightMobile,
  } as CSSProperties;

  // Los bloques anclados al viewport se sacan a una capa propia para que el
  // `overflow: hidden` del lienzo no los recorte al hacer scroll.
  const pinned = blocks.filter((b) => b.d.fixed || b.m.fixed);
  const flowing = blocks.filter((b) => !b.d.fixed && !b.m.fixed);

  return (
    <>
      <div className="rm-stage">
        <div className="rm-canvas" style={style}>
          <HoverStyles blocks={flowing} />
          {flowing.map((block) => (
            <BlockView key={block.id} block={block} textStyles={textStyles} />
          ))}
        </div>
      </div>
      {pinned.length > 0 && (
        <div className="rm-fixed-layer">
          {pinned.map((block) => (
            <BlockView key={block.id} block={block} textStyles={textStyles} />
          ))}
        </div>
      )}
    </>
  );
}
