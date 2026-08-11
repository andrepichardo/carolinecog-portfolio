import type { CSSProperties } from 'react';
import type { FontToken, Paragraph, TextRun } from '@/lib/content-types';

/**
 * Readymag guarda los colores como RRGGBBAA donde AA es la opacidad en
 * porcentaje escrito en hexadecimal: "00000064" es negro opaco (0x64 = 100),
 * "0000003c" es negro al 60 %. No es el alfa hexadecimal habitual de CSS, así
 * que hay que convertirlo explícitamente.
 */
export function rmColor(raw: string | null | undefined, fallback = '#000000'): string {
  if (!raw) return fallback;
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
  return fallback;
}

const FONT_VAR: Record<FontToken, string> = {
  SANS: 'var(--font-sans)',
  GROTESK: 'var(--font-grotesk)',
  DISPLAY: 'var(--font-display)',
  ROUND: 'var(--font-round)',
};

export function fontVar(token: FontToken | null | undefined): string {
  return FONT_VAR[token ?? 'SANS'] ?? FONT_VAR.SANS;
}

/**
 * DM Sans es variable con eje `opsz`. El original usa tres cortes ópticos
 * distintos (14 / 18 / 36) como si fueran familias separadas; aquí se
 * reproducen con font-variation-settings sobre la misma fuente.
 */
export function opticalSize(token: FontToken | null | undefined, opsz: number | null | undefined) {
  if (token !== 'SANS' || !opsz) return undefined;
  return `'opsz' ${opsz}`;
}

export interface ResolvedTextStyle {
  fontToken: FontToken;
  fontOpticalSize: number | null;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform: string;
  textAlign: string;
  color: string;
}

/** Convierte un estilo resuelto en las variables CSS que consume `.rm-p`. */
export function paragraphVars(style: ResolvedTextStyle): CSSProperties {
  return {
    '--rm-font': fontVar(style.fontToken),
    '--rm-fs': style.fontSize,
    '--rm-lh': style.lineHeight,
    '--rm-ls': style.letterSpacing,
    '--rm-fw': style.fontWeight,
    '--rm-fvs': opticalSize(style.fontToken, style.fontOpticalSize) ?? 'normal',
    '--rm-tt': style.textTransform,
    '--rm-ta': style.textAlign,
    '--rm-color': style.color,
  } as CSSProperties;
}

/** Mezcla el estilo nombrado del proyecto con lo que sobreescriba el párrafo. */
export function resolveParagraph(
  paragraph: Paragraph,
  named: Partial<ResolvedTextStyle> | undefined
): ResolvedTextStyle {
  return {
    fontToken: paragraph.fontToken ?? named?.fontToken ?? 'SANS',
    fontOpticalSize: paragraph.fontOpticalSize ?? named?.fontOpticalSize ?? null,
    fontWeight: paragraph.fontWeight ?? named?.fontWeight ?? 400,
    fontSize: paragraph.fontSize ?? named?.fontSize ?? 16,
    lineHeight: paragraph.lineHeight ?? named?.lineHeight ?? 20,
    letterSpacing: paragraph.letterSpacing ?? named?.letterSpacing ?? 0,
    textTransform: paragraph.textTransform ?? named?.textTransform ?? 'none',
    textAlign: paragraph.align ?? named?.textAlign ?? 'left',
    color: paragraph.color ?? named?.color ?? '#000000',
  };
}

/** Variables CSS de un tramo con formato propio dentro del párrafo. */
export function runVars(run: TextRun): CSSProperties {
  const vars: Record<string, string | number> = {};
  if (run.color) vars['--rm-color'] = run.color;
  if (run.fontToken) vars['--rm-font'] = fontVar(run.fontToken);
  if (run.fontWeight) vars['--rm-fw'] = run.fontWeight;
  if (run.fontSize) vars['--rm-fs'] = run.fontSize;
  if (run.letterSpacing !== undefined) vars['--rm-ls'] = run.letterSpacing;
  if (run.textTransform) vars['--rm-tt'] = run.textTransform;
  const opsz = opticalSize(run.fontToken, run.fontOpticalSize);
  if (opsz) vars['--rm-fvs'] = opsz;

  const style: CSSProperties = { ...(vars as CSSProperties) };
  if (run.fontStyle) style.fontStyle = run.fontStyle as CSSProperties['fontStyle'];
  if (run.decoration && run.decoration !== 'none') {
    style.textDecoration = run.decoration;
  }
  // Un tramo hereda del párrafo salvo lo que redefina, así que hay que
  // reaplicar las propiedades que dependen de sus propias variables.
  if (vars['--rm-fs'] !== undefined) style.fontSize = 'calc(var(--rm-fs) * var(--u))';
  if (vars['--rm-ls'] !== undefined) style.letterSpacing = 'calc(var(--rm-ls) * var(--u))';
  if (vars['--rm-font'] !== undefined) style.fontFamily = 'var(--rm-font)';
  if (vars['--rm-fw'] !== undefined) style.fontWeight = 'var(--rm-fw)';
  if (vars['--rm-color'] !== undefined) style.color = 'var(--rm-color)';
  if (vars['--rm-tt'] !== undefined) style.textTransform = 'var(--rm-tt)';
  if (vars['--rm-fvs'] !== undefined) style.fontVariationSettings = 'var(--rm-fvs)';
  return style;
}
