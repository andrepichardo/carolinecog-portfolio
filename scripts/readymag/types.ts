/** Formas del volcado de Readymag (_reference/model/project.json). */

export interface RmPicture {
  url?: string;
  unscaledUrl?: string;
  thumbUrl?: string;
  editedVectorUrl?: string;
  lambdaUrl?: string;
  type?: string;
}

export interface RmInlineStyles {
  styles: { offset: number; length: number; styles: string[] }[];
  keys: string[];
  values: string[];
}

export interface RmStyleEntry {
  key: string;
  type?: string;
  inlineStyles?: RmInlineStyles;
}

export interface RmTextBlock {
  key: string;
  text: string;
  entityRanges?: { offset: number; length: number; key: number }[];
  depth?: number;
}

export interface RmBlockMeta {
  key: string;
  data?: {
    textStyle?: string;
    lineHeight?: number;
    align?: string;
    sizesLinkedStatus?: boolean;
  };
}

export interface RmEntity {
  type: string;
  data?: {
    url?: string;
    type?: string; //  "URL" | "Email" | "Page" | …
    target?: string;
    linkStyle?: string;
    page?: string;
  };
}

export interface RmAnimationStep {
  duration?: number;
  acceleration?: string;
  dx?: number;
  dy?: number;
  scale?: number;
  from_scale?: number;
  opacity?: number;
  from_opacity?: number;
  angle?: number;
  use_move?: boolean;
  use_scale?: boolean;
  use_opacity?: boolean;
  use_rotate?: boolean;
  speed?: number;
  start_point?: string;
  start_offset?: number;
}

export interface RmAnimation {
  UUID?: string;
  type?: string; //  scroll | hover | click
  steps?: RmAnimationStep[];
  trigger?: string[];
  playOnce?: boolean;
}

export interface RmViewport {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  angle?: number;
  hidden?: boolean;
  scale?: number;
  fixed_position?: string;
  picture?: RmPicture;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  // Presentes cuando el bloque solo existe en móvil: el widget de escritorio
  // viene vacío y las dimensiones del original cuelgan de aquí.
  originalW?: number;
  originalH?: number;
  color?: string;
  blocks?: RmTextBlock[];
  styles?: RmStyleEntry[];
  blocksMeta?: RmBlockMeta[];
  entityMap?: Record<string, RmEntity>;
  animation?: RmAnimation[];
  // Los iconos se sirven rasterizados a 1x/2x/3x.
  rasterUrl?: string;
  raster2xUrl?: string;
  raster3xUrl?: string;
}

export interface RmWidget {
  _id: string;
  wid: string;
  type: string; //  text | picture | shape | background
  name?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  angle?: number;
  hidden?: boolean;
  fixed_position?: string;

  // texto
  blocks?: RmTextBlock[];
  styles?: RmStyleEntry[];
  blocksMeta?: RmBlockMeta[];
  entityMap?: Record<string, RmEntity>;
  verticalAlign?: string;

  // imagen
  picture?: RmPicture;
  scale?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  originalW?: number;
  originalH?: number;
  border_radius?: number;
  border_radius_tl?: number;
  border_radius_tr?: number;
  border_radius_bl?: number;
  border_radius_br?: number;
  border_radius_independent?: boolean;
  blurHash?: string;

  // forma
  tp?: string;
  bg_color?: string;
  bg_opacity?: number;
  color?: string;
  opacity?: number;
  radius?: number;
  radius_rect_tl?: number;
  radius_rect_tr?: number;
  radius_rect_bl?: number;
  radius_rect_br?: number;
  radius_rect_independent?: boolean;
  weight?: number;
  stroke?: string;
  borders?: number;

  // iconos rasterizados (tp: "icon")
  rasterUrl?: string;
  raster2xUrl?: string;
  raster3xUrl?: string;

  // enlaces y animación
  clickLink?: string;
  clickTarget?: string;
  animation?: RmAnimation[];

  viewport_phone_portrait?: RmViewport;
  viewport_tablet_portrait?: RmViewport;
}

export interface RmPage {
  _id: string;
  num: number;
  title: string;
  uri: string;
  type: string;
  height: number;
  pagePath?: string;
  viewport_phone_portrait?: { enabled?: boolean; height?: number };
  widgetsData: RmWidget[] | null;
}

export interface RmTextStyle {
  name: string;
  label: string;
  tag?: string;
  cssProperties: {
    fontFamily?: string;
    fontWeight?: string | number;
    fontSize?: number;
    lineHeight?: number;
    letterSpacing?: number;
    fontStyle?: string;
    color?: string;
    textTransform?: string;
    textAlign?: string;
  };
}

export interface RmLinkStyleSide {
  textColor?: string;
  type?: string;
  color?: string;
  size?: number;
  padding?: number;
}

export interface RmLinkStyle {
  name: string;
  label: string;
  style: {
    link?: RmLinkStyleSide;
    hover?: RmLinkStyleSide;
    current?: RmLinkStyleSide;
  };
}

export interface RmProject {
  mag: {
    aboveAllWidgets: RmWidget[];
    textStyles: { project: RmTextStyle[]; global: RmTextStyle[] };
    linkStyles: { project: RmLinkStyle[]; global: RmLinkStyle[] };
    desktopWidth: number;
    phoneWidth: number;
    title: string;
    description: string;
  };
  pages: Record<string, RmPage>;
}
