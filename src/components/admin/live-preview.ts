import type { EditorBlock } from './BlockInspector';
import type { ImageContent, Paragraph, ShapeContent } from '@/lib/content-types';

/**
 * Aplica lo que hay en el inspector a la vista previa, sin pasar por el
 * servidor.
 *
 * La vista previa es el sitio real dentro de un iframe del mismo origen, y todo
 * lo que el inspector edita —tipografía, color, recorte, relleno, geometría— se
 * dibuja a partir de variables CSS. Así que basta con reescribir esas variables
 * sobre los nodos ya renderizados para ver el cambio mientras se teclea; Save
 * queda para cuando se quiere conservar.
 *
 * El punto delicado es **volver atrás**. Un campo vacío significa «hereda del
 * estilo del proyecto», y el editor no conoce esos estilos: solo sus nombres.
 * Por eso, la primera vez que se toca un nodo se guarda su `style` original —el
 * que escribió el servidor, ya resuelto— y cada pasada parte de él en lugar de
 * ir acumulando sobreescrituras. Sin eso, borrar un tamaño de letra dejaría el
 * último valor tecleado en pantalla.
 */

/** Estado del nodo tal y como lo sirvió el servidor. */
interface Baseline {
  style: string;
  text: string;
}

function baselineOf(el: HTMLElement): Baseline {
  const stored = el.dataset.rmBaseline;
  if (stored !== undefined) return JSON.parse(stored) as Baseline;
  const baseline: Baseline = {
    style: el.getAttribute('style') ?? '',
    text: el.textContent ?? '',
  };
  el.dataset.rmBaseline = JSON.stringify(baseline);
  return baseline;
}

function setVar(el: HTMLElement, name: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return;
  el.style.setProperty(name, String(value));
}

const FONT_VAR: Record<string, string> = {
  SANS: 'var(--font-sans)',
  GROTESK: 'var(--font-grotesk)',
  DISPLAY: 'var(--font-display)',
  ROUND: 'var(--font-round)',
};

/**
 * Readymag guarda el color como RRGGBBAA con el alfa en porcentaje decimal
 * escrito en hexadecimal. Misma conversión que `rmColor` en el sitio.
 */
function rmColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hex = raw.replace(/^#/, '').trim();
  if (hex.length === 8) {
    const rgb = hex.slice(0, 6);
    const pct = Number.parseInt(hex.slice(6, 8), 16);
    const alpha = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) / 100 : 1;
    if (alpha >= 1) return `#${rgb}`;
    const r = Number.parseInt(rgb.slice(0, 2), 16);
    const g = Number.parseInt(rgb.slice(2, 4), 16);
    const b = Number.parseInt(rgb.slice(4, 6), 16);
    return `rgb(${r} ${g} ${b} / ${alpha})`;
  }
  if (hex.length === 6 || hex.length === 3) return `#${hex}`;
  return null;
}

function applyParagraphs(host: HTMLElement, paragraphs: Paragraph[]) {
  const nodes = host.querySelectorAll<HTMLElement>('.rm-p');

  paragraphs.forEach((paragraph, i) => {
    const el = nodes[i];
    if (!el) return;
    const baseline = baselineOf(el);
    el.setAttribute('style', baseline.style);

    setVar(el, '--rm-fs', paragraph.fontSize);
    setVar(el, '--rm-lh', paragraph.lineHeight);
    setVar(el, '--rm-ls', paragraph.letterSpacing);
    setVar(el, '--rm-fw', paragraph.fontWeight);
    setVar(el, '--rm-ta', paragraph.align);
    setVar(el, '--rm-tt', paragraph.textTransform);
    setVar(el, '--rm-color', rmColor(paragraph.color));
    if (paragraph.fontToken) setVar(el, '--rm-font', FONT_VAR[paragraph.fontToken]);

    el.style.paddingTop = paragraph.paddingTop
      ? `calc(${paragraph.paddingTop} * var(--u))`
      : '';
    el.style.paddingBottom = paragraph.paddingBottom
      ? `calc(${paragraph.paddingBottom} * var(--u))`
      : '';

    // Se compara con lo que hay en pantalla, no con el original: así no se
    // toca nada mientras el texto no cambie —reescribirlo aplanaría los tramos
    // con formato propio y los enlaces, que son nodos hijos— y al descartar se
    // repone, que es justo el caso que se escapaba comparando con el original.
    if (el.textContent !== paragraph.text) el.textContent = paragraph.text;
  });

  // Párrafos añadidos o quitados desde el inspector no existen en el iframe; se
  // ocultan los sobrantes y el resto aparece al guardar.
  for (let i = paragraphs.length; i < nodes.length; i++) {
    nodes[i].style.display = 'none';
  }
}

function applyShape(el: HTMLElement, shape: ShapeContent) {
  const baseline = baselineOf(el);
  el.setAttribute('style', baseline.style);
  setVar(el, '--rm-fill', rmColor(shape.fill));
  setVar(el, '--rm-radius', shape.radius);
  setVar(el, '--rm-weight', shape.borderWidth);
  setVar(el, '--rm-stroke', shape.stroke);
  if (shape.opacity !== null && shape.opacity !== undefined) {
    el.style.opacity = String(shape.opacity);
  }
}

function applyImage(el: HTMLElement, image: ImageContent) {
  const baseline = baselineOf(el);
  el.setAttribute('style', baseline.style);
  if (image.crop && image.original) {
    const scale = image.scale ?? 1;
    setVar(el, '--c-w', image.original.w * scale);
    setVar(el, '--c-h', image.original.h * scale);
    setVar(el, '--c-x', -image.crop.x * scale);
    setVar(el, '--c-y', -image.crop.y * scale);
  }
  // «Fit» no es una variable sino una clase, así que hay que alternarla a mano.
  el.classList.toggle('rm-image--contain', image.objectFit === 'contain');

  setVar(el, '--rm-radius', image.radius);
  const corners = image.radiusCorners;
  if (corners) {
    setVar(el, '--rm-radius-tl', corners.tl);
    setVar(el, '--rm-radius-tr', corners.tr);
    setVar(el, '--rm-radius-br', corners.br);
    setVar(el, '--rm-radius-bl', corners.bl);
  }
}

/** Escribe el bloque completo en la vista previa. */
export function applyBlockToPreview(doc: Document, block: EditorBlock) {
  const el = doc.querySelector<HTMLElement>(`[data-id="${CSS.escape(block.id)}"]`);
  if (!el) return;

  el.style.setProperty('--dx', String(block.dX ?? 0));
  el.style.setProperty('--dy', String(block.dY ?? 0));
  el.style.setProperty('--dw', String(block.dW ?? 0));
  el.style.setProperty('--dh', String(block.dH ?? 0));
  el.style.setProperty('--mx', String(block.mX ?? block.dX ?? 0));
  el.style.setProperty('--my', String(block.mY ?? block.dY ?? 0));
  el.style.setProperty('--mw', String(block.mW ?? block.dW ?? 0));
  el.style.setProperty('--mh', String(block.mH ?? block.dH ?? 0));
  el.style.setProperty('--d-rotate', `${block.dRotation ?? 0}deg`);
  el.style.setProperty('--m-rotate', `${block.mRotation ?? 0}deg`);
  el.style.setProperty('--d-display', block.dHidden ? 'none' : 'block');
  el.style.setProperty('--m-display', block.mHidden ? 'none' : 'block');
  el.style.setProperty('--z', String(block.z));
  el.style.setProperty('--opacity', String(block.opacity));

  const paragraphs = (block.text as { paragraphs?: Paragraph[] } | null)?.paragraphs;
  if (paragraphs) {
    // Cuando el bloque tiene texto propio en móvil hay dos contenedores; el
    // inspector edita el de escritorio.
    const host =
      el.querySelector<HTMLElement>('.rm-text:not(.rm-only-mobile)') ??
      el.querySelector<HTMLElement>('.rm-text');
    if (host) applyParagraphs(host, paragraphs);
  }

  // Se llama aunque el contenido sea nulo: ambas funciones empiezan reponiendo
  // el estado original, y saltárselas dejaba puesto lo último que se hubiera
  // tecleado. Es justo lo que pasaba al descartar en un bloque cuyo `image`
  // venía a null: el inspector lo convierte en objeto al editarlo y en null al
  // descartar, así que la rama se saltaba y el cambio se quedaba en pantalla.
  const shape = el.querySelector<HTMLElement>('.rm-shape');
  if (shape) applyShape(shape, (block.shape ?? {}) as ShapeContent);

  const image = el.querySelector<HTMLElement>('.rm-image');
  if (image) applyImage(image, (block.image ?? {}) as ImageContent);
}
