import type {
  BlockAnimation,
  FontToken,
  ImageContent,
  Paragraph,
  ShapeContent,
  TextContent,
  TextRun,
} from '../../src/lib/content-types';
import type {
  RmAnimation,
  RmInlineStyles,
  RmTextStyle,
  RmViewport,
  RmWidget,
} from './types';

/**
 * Readymag nombra las fuentes con el código de cuatro letras que les asigna
 * Adobe Fonts. La correspondencia se obtuvo del kit del proyecto
 * (use.typekit.net/…​.js) y leyendo la tabla `name` de cada woff2 descargado.
 *
 *   fvhm → DM Sans 36pt          rqtk → DM Sans 18pt Light
 *   kmkm → DM Sans               hngy → Benton Modern D Cn
 *   tscy → Aktiv Grotesk         jwst → All Round Gothic
 *
 * Las tres versiones ópticas de DM Sans se reproducen con el eje `opsz` de la
 * versión variable, que es la misma fuente que usa el original.
 */
const FONT_MAP: Record<string, { token: FontToken; opsz?: number }> = {
  kmkm: { token: 'SANS', opsz: 14 },
  fvhm: { token: 'SANS', opsz: 36 },
  rqtk: { token: 'SANS', opsz: 18 },
  hngy: { token: 'DISPLAY' },
  tscy: { token: 'GROTESK' },
  jwst: { token: 'ROUND' },
  wtqc: { token: 'GROTESK' },
  'DM Sans': { token: 'SANS', opsz: 14 },
  'Bodoni Moda': { token: 'DISPLAY' },
  Austin: { token: 'DISPLAY' },
};

export function mapFont(family: string | undefined): { token: FontToken; opsz?: number } {
  if (!family) return { token: 'SANS', opsz: 14 };
  return FONT_MAP[family] ?? { token: 'SANS', opsz: 14 };
}

/** Readymag guarda RRGGBBAA con AA = opacidad en porcentaje hexadecimal. */
export function rmColor(raw: string | undefined, fallback = '#000000'): string {
  if (!raw) return fallback;
  const hex = raw.replace(/^#/, '').trim();
  if (hex.length === 8) {
    const rgb = hex.slice(0, 6);
    const pct = Number.parseInt(hex.slice(6, 8), 16);
    const alpha = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) / 100 : 1;
    if (alpha >= 1) return `#${rgb.toLowerCase()}`;
    const r = Number.parseInt(rgb.slice(0, 2), 16);
    const g = Number.parseInt(rgb.slice(2, 4), 16);
    const b = Number.parseInt(rgb.slice(4, 6), 16);
    return `rgb(${r} ${g} ${b} / ${alpha})`;
  }
  if (hex.length === 6 || hex.length === 3) return `#${hex.toLowerCase()}`;
  return fallback;
}

/** Los nombres de estilo de Readymag son UUID; se acortan a un slug legible. */
export function styleKey(name: string | undefined, label: string | undefined): string {
  if (!name) return 'default';
  const slug = (label ?? name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // El sufijo del UUID evita colisiones entre estilos que comparten etiqueta
  // (el proyecto tiene cuatro llamados "New style").
  const suffix = name.slice(-6);
  return `${slug || 'style'}-${suffix}`;
}

export function convertTextStyle(style: RmTextStyle) {
  const css = style.cssProperties;
  const font = mapFont(css.fontFamily);
  return {
    key: styleKey(style.name, style.label),
    label: style.label || 'Estilo',
    fontToken: font.token,
    fontOpticalSize: font.opsz ?? null,
    fontWeight: Number(css.fontWeight) || 400,
    fontSize: Number(css.fontSize) || 16,
    lineHeight: Number(css.lineHeight) || Number(css.fontSize) || 20,
    letterSpacing: Number(css.letterSpacing) || 0,
    textTransform: normalizeTransform(css.textTransform),
    textAlign: css.textAlign || 'left',
    color: rmColor(css.color),
  };
}

function normalizeTransform(value: string | undefined): string {
  if (!value || value === 'None' || value === 'none') return 'none';
  return value.toLowerCase();
}

function normalizeAlign(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^align-/, '');
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

interface RunAttrs {
  color?: string;
  fontToken?: FontToken;
  fontOpticalSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  fontSize?: number;
  letterSpacing?: number;
  textTransform?: string;
  decoration?: string;
}

/**
 * Decodifica el formato inline de Readymag.
 *
 * `inlineStyles` guarda las propiedades deduplicadas: `keys` y `values` son
 * tablas, y cada rango lista pares "índiceDeClave;índiceDeValor". Así que para
 * el rango (offset, length) hay que resolver cada par contra ambas tablas.
 */
function decodeInlineRanges(
  inline: RmInlineStyles | undefined
): { start: number; end: number; attrs: RunAttrs }[] {
  if (!inline?.styles?.length) return [];

  return inline.styles.map((entry) => {
    const attrs: RunAttrs = {};
    for (const pair of entry.styles ?? []) {
      const [k, v] = pair.split(';');
      const key = inline.keys[Number(k)];
      const value = inline.values[Number(v)];
      if (key === undefined || value === undefined) continue;

      switch (key) {
        case 'COLOR':
          attrs.color = rmColor(value);
          break;
        case 'FONT_WEIGHT':
          attrs.fontWeight = Number(value) || undefined;
          break;
        case 'BOLD':
          attrs.fontWeight = 700;
          break;
        case 'FONT_STYLE':
          if (value !== 'normal') attrs.fontStyle = value;
          break;
        case 'FONT_FAMILY': {
          const font = mapFont(value);
          attrs.fontToken = font.token;
          attrs.fontOpticalSize = font.opsz;
          break;
        }
        case 'FONT_SIZE':
          attrs.fontSize = Number(value) || undefined;
          break;
        case 'LETTER_SPACING':
          attrs.letterSpacing = Number(value);
          break;
        case 'TRANSFORM':
          attrs.textTransform = normalizeTransform(value);
          break;
        case 'DECORATION':
          attrs.decoration = value;
          break;
        // SHADOW, FONT_FEATURE e IS_LINKED_LETTER_SPACING no tienen efecto
        // visible en este proyecto y se omiten a propósito.
        default:
          break;
      }
    }
    return { start: entry.offset, end: entry.offset + entry.length, attrs };
  });
}

/**
 * Funde los rangos de formato con los de enlace.
 *
 * Ambos son intervalos independientes que pueden solaparse parcialmente, así
 * que se cortan por todos los límites y se recompone tramo a tramo. Evita que
 * un enlace pierda su formato (o al revés) cuando no coinciden exactamente.
 */
function buildRuns(
  text: string,
  inline: RmInlineStyles | undefined,
  entityRanges: { offset: number; length: number; key: number }[] | undefined,
  entityMap: Record<string, { type: string; data?: Record<string, unknown> }> | undefined,
  linkStyleKeys: Map<string, string>,
  pageSlugById: Map<string, string>
): TextRun[] {
  const styleRanges = decodeInlineRanges(inline);
  const linkRanges = (entityRanges ?? []).flatMap((r) => {
    const entity = entityMap?.[String(r.key)];
    if (!entity || entity.type !== 'LINK') return [];
    const data = (entity.data ?? {}) as Record<string, string>;
    const kind =
      data.type === 'Email' ? 'EMAIL' : data.type === 'Page' ? 'PAGE' : 'URL';
    // Los enlaces internos referencian la página por su `pageId`; `url` solo
    // guarda el uri de Readymag, que no coincide con el slug público.
    const pageSlug = data.pageId ? pageSlugById.get(data.pageId) : undefined;
    return [
      {
        start: r.offset,
        end: r.offset + r.length,
        link: {
          kind: kind as 'URL' | 'EMAIL' | 'PAGE',
          url: data.url,
          pageSlug,
          target: data.target ?? '_self',
          linkStyleKey: data.linkStyle ? linkStyleKeys.get(data.linkStyle) : undefined,
        },
      },
    ];
  });

  if (!styleRanges.length && !linkRanges.length) return [];

  const bounds = new Set<number>([0, text.length]);
  for (const r of [...styleRanges, ...linkRanges]) {
    bounds.add(Math.max(0, Math.min(r.start, text.length)));
    bounds.add(Math.max(0, Math.min(r.end, text.length)));
  }
  const points = [...bounds].sort((a, b) => a - b);

  const runs: TextRun[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;

    const attrs: RunAttrs = {};
    for (const r of styleRanges) {
      if (r.start <= start && r.end >= end) Object.assign(attrs, r.attrs);
    }
    const linkRange = linkRanges.find((r) => r.start <= start && r.end >= end);

    if (!Object.keys(attrs).length && !linkRange) continue;
    runs.push({ start, length: end - start, ...attrs, link: linkRange?.link });
  }
  return runs;
}

export function convertText(
  source: { blocks?: unknown; styles?: unknown; blocksMeta?: unknown; entityMap?: unknown },
  styleKeys: Map<string, string>,
  linkStyleKeys: Map<string, string>,
  pageSlugById: Map<string, string>,
  verticalAlign?: string
): TextContent | null {
  const blocks = (source.blocks ?? []) as {
    key: string;
    text: string;
    entityRanges?: { offset: number; length: number; key: number }[];
  }[];
  if (!Array.isArray(blocks) || !blocks.length) return null;

  const styles = (source.styles ?? []) as { key: string; inlineStyles?: RmInlineStyles }[];
  const metas = (source.blocksMeta ?? []) as {
    key: string;
    data?: {
      textStyle?: string;
      lineHeight?: number;
      align?: string;
      paddings?: { top?: number; bottom?: number };
    };
  }[];
  const entityMap = source.entityMap as
    | Record<string, { type: string; data?: Record<string, unknown> }>
    | undefined;

  const paragraphs: Paragraph[] = blocks.map((block) => {
    const style = styles.find((s) => s.key === block.key);
    const meta = metas.find((m) => m.key === block.key);
    const runs = buildRuns(
      block.text,
      style?.inlineStyles,
      block.entityRanges,
      entityMap,
      linkStyleKeys,
      pageSlugById
    );

    const paragraph: Paragraph = { text: block.text };
    const named = meta?.data?.textStyle;
    if (named) paragraph.styleKey = styleKeys.get(named) ?? null;
    if (meta?.data?.lineHeight) paragraph.lineHeight = meta.data.lineHeight;
    // Readymag separa párrafos con un padding explícito por bloque, no con un
    // margen uniforme: hay listas donde solo algunas líneas llevan aire.
    if (meta?.data?.paddings?.top) paragraph.paddingTop = meta.data.paddings.top;
    if (meta?.data?.paddings?.bottom) paragraph.paddingBottom = meta.data.paddings.bottom;
    const align = normalizeAlign(meta?.data?.align);
    if (align) paragraph.align = align;
    if (runs.length) paragraph.runs = runs;
    return paragraph;
  });

  const content = { paragraphs } as TextContent & { verticalAlign?: string };
  if (verticalAlign && verticalAlign !== 'top') content.verticalAlign = verticalAlign;
  return content;
}

// ---------------------------------------------------------------------------
// Imagen
// ---------------------------------------------------------------------------

export function convertImage(
  widget: RmWidget,
  viewport?: RmViewport
): ImageContent | null {
  const src = viewport ?? widget;
  const cropX = src.cropX ?? widget.cropX;
  const cropY = src.cropY ?? widget.cropY;
  const cropW = src.cropW ?? widget.cropW;
  const cropH = src.cropH ?? widget.cropH;
  const originalW = widget.originalW;
  const originalH = widget.originalH;
  const scale = src.scale ?? widget.scale;

  const content: ImageContent = {};

  if (
    cropX !== undefined &&
    cropY !== undefined &&
    cropW !== undefined &&
    cropH !== undefined &&
    originalW &&
    originalH
  ) {
    content.crop = { x: cropX, y: cropY, w: cropW, h: cropH };
    content.original = { w: originalW, h: originalH };
    // `scale` = unidades de diseño por píxel original. Cuando falta se deriva
    // del ancho del bloque, que es la definición que usa el original.
    const width = viewport?.w ?? widget.w;
    content.scale = scale ?? (width && cropW ? width / cropW : 1);
  }

  const independent = widget.border_radius_independent;
  if (independent) {
    content.radiusCorners = {
      tl: widget.border_radius_tl ?? 0,
      tr: widget.border_radius_tr ?? 0,
      br: widget.border_radius_br ?? 0,
      bl: widget.border_radius_bl ?? 0,
    };
  } else if (widget.border_radius) {
    content.radius = widget.border_radius;
  }

  return Object.keys(content).length ? content : null;
}

// ---------------------------------------------------------------------------
// Forma
// ---------------------------------------------------------------------------

const SHAPE_KINDS: Record<string, ShapeContent['kind']> = {
  rectangle: 'RECTANGLE',
  line: 'LINE',
  ellipse: 'ELLIPSE',
  circle: 'ELLIPSE',
  triangle: 'TRIANGLE',
};

export function convertShape(widget: RmWidget): ShapeContent {
  return {
    kind: SHAPE_KINDS[widget.tp ?? 'rectangle'] ?? 'RECTANGLE',
    fill: widget.bg_color ? rmColor(widget.bg_color) : undefined,
    opacity: widget.bg_opacity ?? 1,
    radius: widget.radius ?? 0,
    borderWidth: widget.weight ?? 1,
    borderColor: widget.color ? rmColor(widget.color) : undefined,
    stroke: (widget.stroke as ShapeContent['stroke']) ?? 'solid',
  };
}

// ---------------------------------------------------------------------------
// Animaciones
// ---------------------------------------------------------------------------

const ANIMATION_KINDS: Record<string, BlockAnimation['kind']> = {
  scroll: 'SCROLL',
  hover: 'HOVER',
  click: 'CLICK',
};

export function convertAnimations(
  animations: RmAnimation[] | undefined,
  widgetIdToBlockId: Map<string, string>
): BlockAnimation[] {
  if (!animations?.length) return [];

  return animations.flatMap((animation) => {
    const kind = ANIMATION_KINDS[animation.type ?? ''];
    if (!kind) return [];

    const steps = (animation.steps ?? []).map((s) => ({
      duration: s.duration,
      acceleration: s.acceleration,
      dx: s.dx,
      dy: s.dy,
      scale: s.scale,
      fromScale: s.from_scale,
      opacity: s.opacity,
      fromOpacity: s.from_opacity,
      rotate: s.angle,
      useMove: s.use_move,
      useScale: s.use_scale,
      useOpacity: s.use_opacity,
      useRotate: s.use_rotate,
      speed: s.speed,
      startPoint: s.start_point,
      startOffset: s.start_offset,
    }));
    if (!steps.length) return [];

    const triggers = (animation.trigger ?? [])
      .map((wid) => widgetIdToBlockId.get(wid))
      .filter((id): id is string => Boolean(id));

    return [
      {
        kind,
        steps,
        triggerBlockIds: triggers.length ? triggers : undefined,
        playOnce: animation.playOnce,
      },
    ];
  });
}
