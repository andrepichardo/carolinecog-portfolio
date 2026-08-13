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

  return (
    <div className="rm-stage">
      <div className="rm-canvas" style={style}>
        <HoverStyles blocks={blocks} />
        {blocks.map((block) => (
          <BlockView key={block.id} block={block} textStyles={textStyles} />
        ))}
      </div>
    </div>
  );
}
