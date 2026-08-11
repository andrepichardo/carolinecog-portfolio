/**
 * Saneado de SVG.
 *
 * Los SVG del portafolio (el wordmark, las flechas de navegación) se incrustan
 * en el DOM para que escalen sin pérdida y hereden color. Como acaban dentro de
 * `dangerouslySetInnerHTML`, cualquier SVG que entre por el CMS pasa antes por
 * aquí: se eliminan scripts, handlers y referencias externas.
 */

const DANGEROUS_TAGS = /<\s*(script|foreignObject|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSING_DANGEROUS = /<\s*(script|iframe|object|embed|link|meta)\b[^>]*\/?>/gi;
const EVENT_HANDLERS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /(?:href|xlink:href|src)\s*=\s*(?:"|')?\s*javascript:[^"'>\s]*/gi;

export function sanitizeSvg(markup: string): string {
  return markup
    .replace(DANGEROUS_TAGS, '')
    .replace(SELF_CLOSING_DANGEROUS, '')
    .replace(EVENT_HANDLERS, '')
    .replace(JS_URLS, '')
    .trim();
}

/** Dimensiones declaradas por el SVG, para poder calcular su proporción. */
export function svgDimensions(markup: string): { width: number; height: number } | null {
  const viewBox = markup.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const w = markup.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const h = markup.match(/\bheight\s*=\s*["']([\d.]+)/i);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  return null;
}
