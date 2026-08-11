/**
 * Genera el favicon a partir del wordmark original.
 *
 * El logotipo completo ("CarolineContreras") es ilegible a 32 px, así que se
 * recorta a sus dos primeras letras. No se puede aislar solo la "C": en este
 * tipo la "a" va encajada dentro de su abertura y ambas forman un único trazado.
 *
 *   node scripts/make-favicon.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = join(
  process.cwd(),
  '_reference',
  'assets',
  'Image-d5e108e7-0cc2-4f8c-b692-346d7ee5a360.svg'
);
const OUTPUT = join(process.cwd(), 'src', 'app', 'icon.svg');

// Región del wordmark que se conserva, en unidades de su viewBox (1011.9 × 140.19).
const CROP = { x: -3, y: -6, width: 129, height: 152 };
const SIZE = 512;
const PADDING = 0.13;
const BACKGROUND = '#efefef';

const source = readFileSync(SOURCE, 'utf8');
const inner = source
  .replace(/<\?xml[^>]*\?>/, '')
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();

const box = SIZE * (1 - PADDING * 2);
const scale = Math.min(box / CROP.width, box / CROP.height);
const drawnWidth = CROP.width * scale;
const drawnHeight = CROP.height * scale;
const tx = (SIZE - drawnWidth) / 2 - CROP.x * scale;
const ty = (SIZE - drawnHeight) / 2 - CROP.y * scale;

// El grupo dibuja el wordmark entero; sin recorte, el viewBox dejaría asomar
// las letras siguientes por el borde derecho.
const clipX = (SIZE - drawnWidth) / 2;
const clipY = (SIZE - drawnHeight) / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="Caroline Contreras">
  <defs>
    <clipPath id="crop">
      <rect x="${clipX.toFixed(2)}" y="${clipY.toFixed(2)}" width="${drawnWidth.toFixed(2)}" height="${drawnHeight.toFixed(2)}"/>
    </clipPath>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${BACKGROUND}"/>
  <g clip-path="url(#crop)">
    <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})">
${inner
  .split('\n')
  .map((line) => '      ' + line.trim())
  .filter((line) => line.trim())
  .join('\n')}
    </g>
  </g>
</svg>
`;

writeFileSync(OUTPUT, svg);
console.log(`✓ favicon escrito en ${OUTPUT}`);
console.log(`  recorte ${CROP.width}×${CROP.height} → ${SIZE}×${SIZE} (escala ${scale.toFixed(3)})`);
