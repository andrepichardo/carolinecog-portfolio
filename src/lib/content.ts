import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import {
  parseAnimations,
  parseImageContent,
  parseShapeContent,
  parseTextContent,
  type BlockAnimation,
  type FontToken,
  type ImageContent,
  type ShapeContent,
  type TextContent,
} from '@/lib/content-types';

export interface AssetData {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  isSvg: boolean;
  svgMarkup: string | null;
  blurDataUrl: string | null;
}

export interface BlockData {
  id: string;
  kind: 'TEXT' | 'IMAGE' | 'SHAPE';
  name: string | null;
  z: number;
  d: Geometry;
  m: Geometry;
  opacity: number;
  text: TextContent | null;
  mobileText: TextContent | null;
  image: ImageContent | null;
  mobileImage: ImageContent | null;
  shape: ShapeContent | null;
  asset: AssetData | null;
  mobileAsset: AssetData | null;
  href: string | null;
  target: string;
  animations: BlockAnimation[];
}

export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  hidden: boolean;
  fixed: string | null;
}

export interface TextStyleData {
  key: string;
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

export interface PageData {
  id: string;
  slug: string;
  kind: string;
  title: string;
  heightDesktop: number;
  heightMobile: number;
  backgroundColor: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  blocks: BlockData[];
}

const assetSelect = {
  id: true,
  url: true,
  width: true,
  height: true,
  alt: true,
  isSvg: true,
  svgMarkup: true,
  blurDataUrl: true,
} as const;

const blockInclude = {
  asset: { select: assetSelect },
  mobileAsset: { select: assetSelect },
  linkPage: { select: { slug: true } },
} as const;

type BlockRow = {
  id: string;
  kind: string;
  name: string | null;
  z: number;
  dX: number | null;
  dY: number | null;
  dW: number | null;
  dH: number | null;
  dRotation: number;
  dHidden: boolean;
  dFixed: string | null;
  mX: number | null;
  mY: number | null;
  mW: number | null;
  mH: number | null;
  mRotation: number;
  mHidden: boolean;
  mFixed: string | null;
  opacity: number;
  text: unknown;
  mobileText: unknown;
  image: unknown;
  mobileImage: unknown;
  shape: unknown;
  animations: unknown;
  linkUrl: string | null;
  linkTarget: string;
  asset: AssetData | null;
  mobileAsset: AssetData | null;
  linkPage: { slug: string } | null;
};

/** Convierte un slug de página en su ruta pública. El home vive en "/". */
export function pageHref(slug: string): string {
  return slug === '' || slug === 'main' ? '/' : `/${slug}`;
}

function toBlock(row: BlockRow): BlockData {
  const desktop: Geometry = {
    x: row.dX ?? 0,
    y: row.dY ?? 0,
    w: row.dW ?? 0,
    h: row.dH ?? 0,
    rotation: row.dRotation,
    hidden: row.dHidden,
    fixed: row.dFixed,
  };
  // Si un bloque no trae geometría móvil propia, reutiliza la de desktop en vez
  // de colapsar a 0×0 en la esquina.
  const mobile: Geometry = {
    x: row.mX ?? desktop.x,
    y: row.mY ?? desktop.y,
    w: row.mW ?? desktop.w,
    h: row.mH ?? desktop.h,
    rotation: row.mRotation || desktop.rotation,
    hidden: row.mHidden,
    fixed: row.mFixed,
  };

  return {
    id: row.id,
    kind: row.kind as BlockData['kind'],
    name: row.name,
    z: row.z,
    d: desktop,
    m: mobile,
    opacity: row.opacity,
    text: row.text ? parseTextContent(row.text) : null,
    mobileText: row.mobileText ? parseTextContent(row.mobileText) : null,
    image: row.image ? parseImageContent(row.image) : null,
    mobileImage: row.mobileImage ? parseImageContent(row.mobileImage) : null,
    shape: row.shape ? parseShapeContent(row.shape) : null,
    asset: row.asset,
    mobileAsset: row.mobileAsset,
    href: row.linkPage ? pageHref(row.linkPage.slug) : row.linkUrl,
    target: row.linkTarget,
    animations: parseAnimations(row.animations),
  };
}

export const getPage = cache(async (slug: string): Promise<PageData | null> => {
  const page = await prisma.page.findFirst({
    where: { slug, published: true },
    include: {
      ogImage: { select: { url: true } },
      blocks: { include: blockInclude, orderBy: { z: 'asc' } },
    },
  });
  if (!page) return null;

  return {
    id: page.id,
    slug: page.slug,
    kind: page.kind,
    title: page.title,
    heightDesktop: page.heightDesktop,
    heightMobile: page.heightMobile,
    backgroundColor: page.backgroundColor,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    ogImageUrl: page.ogImage?.url ?? null,
    blocks: page.blocks.map((b) => toBlock(b as unknown as BlockRow)),
  };
});

/** Bloques que se dibujan sobre todas las páginas: el menú hamburguesa. */
export const getGlobalBlocks = cache(async (): Promise<BlockData[]> => {
  const blocks = await prisma.block.findMany({
    where: { scope: 'GLOBAL' },
    include: blockInclude,
    orderBy: { z: 'asc' },
  });
  return blocks.map((b) => toBlock(b as unknown as BlockRow));
});

export const getTextStyles = cache(async (): Promise<Map<string, TextStyleData>> => {
  const styles = await prisma.textStyle.findMany();
  return new Map(
    styles.map((s) => [
      s.key,
      {
        key: s.key,
        fontToken: s.fontToken as FontToken,
        fontOpticalSize: s.fontOpticalSize,
        fontWeight: s.fontWeight,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        textAlign: s.textAlign,
        color: s.color,
      },
    ])
  );
});

export const getSettings = cache(async () => {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 'singleton' },
    include: { favicon: { select: { url: true } }, ogImage: { select: { url: true } } },
  });
  return settings;
});

export const getNavItems = cache(async () => {
  const items = await prisma.navItem.findMany({
    include: { page: { select: { slug: true } } },
    orderBy: { order: 'asc' },
  });
  return items.map((i) => ({
    id: i.id,
    label: i.label,
    href: i.page ? pageHref(i.page.slug) : (i.url ?? '/'),
  }));
});

export const getPublishedSlugs = cache(async () => {
  const pages = await prisma.page.findMany({
    where: { published: true },
    select: { slug: true },
    orderBy: { order: 'asc' },
  });
  return pages.map((p) => p.slug);
});
