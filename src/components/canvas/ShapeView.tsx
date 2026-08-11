import type { CSSProperties } from 'react';
import type { BlockData } from '@/lib/content';
import { rmColor } from '@/lib/style-utils';

/**
 * Formas del lienzo.
 *
 * En el original cumplen dos papeles: las reglas horizontales de las fichas
 * técnicas (tipo `line`) y rectángulos transparentes que actúan como zona
 * clicable o disparador de hover sobre una imagen. Estos últimos tienen
 * opacidad 0 y siguen siendo interactivos, así que no se pueden omitir.
 */
export function ShapeView({ block }: { block: BlockData }) {
  const shape = block.shape;
  if (!shape) return null;

  const fill = rmColor(shape.fill, '#000000');
  const style = {
    '--rm-fill': fill,
    '--rm-radius': shape.radius ?? 0,
    '--rm-weight': shape.borderWidth ?? 1,
    '--rm-stroke': shape.stroke ?? 'solid',
    opacity: shape.opacity ?? 1,
  } as CSSProperties;

  const kindClass =
    shape.kind === 'LINE'
      ? ' rm-shape--line'
      : shape.kind === 'ELLIPSE'
        ? ' rm-shape--ellipse'
        : '';

  return <div className={`rm-shape${kindClass}`} style={style} aria-hidden="true" />;
}
