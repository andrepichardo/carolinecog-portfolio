/**
 * Formas de los campos Json del schema.
 *
 * Prisma tipa las columnas Json como `JsonValue`, así que estos tipos son el
 * contrato entre el importador, el renderer y el CMS. `parseTextContent` y
 * compañía validan al leer para que un dato viejo o corrupto no rompa la página.
 */

export type FontToken = 'SANS' | 'GROTESK' | 'DISPLAY' | 'ROUND';

/** Tramo con formato propio dentro de un párrafo (negrita, enlace, otra fuente…). */
export interface TextRun {
  start: number;
  length: number;
  color?: string;
  fontToken?: FontToken;
  fontOpticalSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  fontSize?: number;
  letterSpacing?: number;
  textTransform?: string;
  decoration?: string;
  link?: TextLink;
}

export interface TextLink {
  kind: 'URL' | 'EMAIL' | 'PAGE';
  url?: string;
  pageSlug?: string;
  target?: string;
  linkStyleKey?: string;
}

/** Una línea del bloque de texto. Hereda de `styleKey` y sobreescribe lo que traiga. */
export interface Paragraph {
  text: string;
  styleKey?: string | null;
  align?: string;
  lineHeight?: number;
  /** Separación respecto al párrafo anterior, en unidades de diseño. */
  paddingTop?: number;
  paddingBottom?: number;
  fontSize?: number;
  letterSpacing?: number;
  fontToken?: FontToken;
  fontOpticalSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  textTransform?: string;
  color?: string;
  runs?: TextRun[];
}

export interface TextContent {
  paragraphs: Paragraph[];
}

export interface ImageContent {
  /** Recorte en píxeles de la imagen original. */
  crop?: { x: number; y: number; w: number; h: number };
  original?: { w: number; h: number };
  /** Unidades de diseño por píxel original (= ancho del bloque / ancho del recorte). */
  scale?: number;
  radius?: number;
  radiusCorners?: { tl: number; tr: number; br: number; bl: number };
  objectFit?: 'cover' | 'contain';
  alt?: string;
}

export type ShapeKindValue = 'RECTANGLE' | 'LINE' | 'ELLIPSE' | 'TRIANGLE';

export interface ShapeContent {
  kind: ShapeKindValue;
  fill?: string;
  opacity?: number;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  stroke?: 'solid' | 'dashed' | 'dotted';
}

export interface AnimationStep {
  duration?: number;
  acceleration?: string;
  dx?: number;
  dy?: number;
  scale?: number;
  fromScale?: number;
  opacity?: number;
  fromOpacity?: number;
  rotate?: number;
  useMove?: boolean;
  useScale?: boolean;
  useOpacity?: boolean;
  useRotate?: boolean;
  /** Solo scroll: velocidad relativa y punto de arranque respecto al viewport. */
  speed?: number;
  startPoint?: string;
  startOffset?: number;
}

export interface BlockAnimation {
  kind: 'SCROLL' | 'HOVER' | 'CLICK';
  steps: AnimationStep[];
  /** IDs de bloques que disparan la animación (el botón del menú, por ejemplo). */
  triggerBlockIds?: string[];
  playOnce?: boolean;
}

// ---------------------------------------------------------------------------
// Lectores tolerantes
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseTextContent(value: unknown): TextContent {
  if (!isRecord(value) || !Array.isArray(value.paragraphs)) return { paragraphs: [] };
  const paragraphs = value.paragraphs.filter(isRecord).map((p) => ({
    ...p,
    text: typeof p.text === 'string' ? p.text : '',
  })) as Paragraph[];
  return { paragraphs };
}

export function parseImageContent(value: unknown): ImageContent {
  return isRecord(value) ? (value as ImageContent) : {};
}

export function parseShapeContent(value: unknown): ShapeContent {
  if (!isRecord(value)) return { kind: 'RECTANGLE' };
  return { kind: 'RECTANGLE', ...(value as Partial<ShapeContent>) } as ShapeContent;
}

export function parseAnimations(value: unknown): BlockAnimation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).filter((a) => typeof a.kind === 'string') as unknown as BlockAnimation[];
}
