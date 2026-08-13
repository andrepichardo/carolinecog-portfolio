/**
 * Importa el portafolio original de Readymag a la base de datos.
 *
 * Lee el volcado del modelo del proyecto (_reference/model/project.json,
 * extraído del propio visor de Readymag) y lo traduce al schema de este repo.
 *
 * Es idempotente: los IDs de página y de bloque se reutilizan tal cual vienen
 * de Readymag, así que volver a ejecutarlo actualiza en vez de duplicar. Eso
 * también hace que los disparadores de animación —que apuntan a IDs de widget—
 * sigan siendo válidos sin necesidad de una tabla de correspondencias.
 *
 *   yarn import:readymag
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from 'image-size';
import { prisma } from '../src/lib/prisma';
import { sanitizeSvg, svgDimensions } from '../src/lib/svg';
import {
  convertAnimations,
  convertImage,
  convertShape,
  convertText,
  convertTextStyle,
  rmColor,
  styleKey,
} from './readymag/convert';
import type { RmPicture, RmProject, RmViewport, RmWidget } from './readymag/types';

const ROOT = process.cwd();
const MODEL_PATH = join(ROOT, '_reference', 'model', 'project.json');
const ASSETS_DIR = join(ROOT, '_reference', 'assets');

const CONTACT = {
  email: 'info.carolineco@gmail.com',
  instagram: 'https://www.instagram.com/carolineco.studio/',
  linkedin: 'https://www.linkedin.com/in/carolinecog/?locale=en-US',
};

/** Metadatos que no viven en el volcado y describen cada página. */
const PAGE_META: Record<
  string,
  { slug: string; kind: 'HOME' | 'ABOUT' | 'CONTACT' | 'PROJECT'; title: string; order: number }
> = {
  main: { slug: '', kind: 'HOME', title: 'Inicio', order: 0 },
  about: { slug: 'about', kind: 'ABOUT', title: 'About', order: 1 },
  contacts: { slug: 'contact', kind: 'CONTACT', title: 'Contact', order: 2 },
  norologio: { slug: 'norologio', kind: 'PROJECT', title: 'Norologio', order: 3 },
  adagio: { slug: 'adagio', kind: 'PROJECT', title: 'Adagio', order: 4 },
  opus: { slug: 'opus', kind: 'PROJECT', title: 'Opus', order: 5 },
};

const PROJECT_META: Record<
  string,
  { name: string; client?: string; year?: string; supervision?: string; next: string }
> = {
  norologio: {
    name: 'Norologio',
    client: 'Alessi',
    year: '2026',
    supervision: 'Istituto Marangoni',
    next: 'adagio',
  },
  adagio: { name: 'Adagio', year: '2026', next: 'opus' },
  opus: { name: 'Opus', year: '2026', next: 'norologio' },
};

function log(...args: unknown[]) {
  console.log(...args);
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

interface AssetRecord {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  isSvg: boolean;
  svgMarkup: string | null;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
};

function assetIdFor(filename: string): string {
  // Determinista y estable entre ejecuciones.
  return filename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function pictureUrl(picture: RmPicture | undefined): string | null {
  if (!picture) return null;
  // `editedVectorUrl` gana cuando existe: es el SVG retocado dentro de Readymag.
  return picture.editedVectorUrl || picture.url || picture.unscaledUrl || null;
}

/** Los iconos guardan sus rasterizados sueltos, no dentro de `picture`. */
function iconPicture(
  source: { raster3xUrl?: string; raster2xUrl?: string; rasterUrl?: string } | undefined
): RmPicture | undefined {
  const url = source?.raster3xUrl || source?.raster2xUrl || source?.rasterUrl;
  return url ? { url, type: 'png' } : undefined;
}

function buildAsset(url: string, hintW?: number, hintH?: number): AssetRecord {
  const filename = decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'asset');
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  const isSvg = ext === 'svg';
  const localPath = join(ASSETS_DIR, filename);
  const hasLocal = existsSync(localPath);

  let width = hintW ?? null;
  let height = hintH ?? null;
  let svgMarkup: string | null = null;

  if (isSvg && hasLocal) {
    svgMarkup = sanitizeSvg(readFileSync(localPath, 'utf8'));
    const dims = svgDimensions(svgMarkup);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  } else if (hasLocal && (!width || !height)) {
    try {
      const dims = imageSize(readFileSync(localPath));
      width = dims.width ?? null;
      height = dims.height ?? null;
    } catch {
      // Si no se puede leer, se dejan nulas: next/image usa las del recorte.
    }
  }

  return {
    id: assetIdFor(filename),
    // Se conserva la URL original del CDN de Readymag hasta que
    // `yarn assets:upload` los suba a Vercel Blob y reescriba estas URLs.
    url,
    filename,
    mimeType: MIME[ext] ?? 'application/octet-stream',
    width,
    height,
    isSvg,
    svgMarkup,
  };
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

function desktopGeometry(widget: RmWidget) {
  return {
    dX: widget.x ?? null,
    dY: widget.y ?? null,
    dW: widget.w ?? null,
    dH: widget.h ?? null,
    dRotation: widget.angle ?? 0,
    dHidden: widget.hidden === true,
    dFixed: widget.fixed_position ?? null,
  };
}

function mobileGeometry(widget: RmWidget, viewport: RmViewport | undefined) {
  if (!viewport) {
    return {
      mX: null,
      mY: null,
      mW: null,
      mH: null,
      mRotation: 0,
      mHidden: widget.hidden === true,
      mFixed: widget.fixed_position ?? null,
    };
  }
  return {
    mX: viewport.x ?? null,
    mY: viewport.y ?? null,
    mW: viewport.w ?? null,
    mH: viewport.h ?? null,
    mRotation: viewport.angle ?? widget.angle ?? 0,
    mHidden: viewport.hidden === true,
    mFixed: viewport.fixed_position ?? widget.fixed_position ?? null,
  };
}

// ---------------------------------------------------------------------------
// Cabecera
// ---------------------------------------------------------------------------

/** Geometría del container, en unidades de diseño. Refleja globals.css. */
const CONTAINER = {
  desktop: { width: 1024, gutter: 48, chromeMid: 40 },
  mobile: { width: 320, gutter: 20, chromeMid: 30 },
};

/**
 * Ancla el wordmark y el botón del menú al container.
 *
 * En el original ambos se posicionan respecto al centro de la ventana, así que
 * su altura depende de lo alta que sea la pantalla: medido sobre el sitio real,
 * el logo de /norologio cae en y=−15 (fuera de cuadro) con una ventana de 700 px
 * y en y=235 —encima del contenido— con una de 1200. Aquí se fijan a una franja
 * de cabecera de altura constante, alineados entre sí y con los márgenes de la
 * columna de contenido.
 *
 * En la portada el wordmark sigue entrando grande y encogiendo con el scroll;
 * lo que se calcula es su posición **de reposo**, de modo que al terminar la
 * animación quede exactamente en la franja de cabecera.
 */
async function layoutChrome() {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ dFixed: { not: null } }, { mFixed: { not: null } }] },
    include: { page: { select: { slug: true } } },
  });

  let moved = 0;

  for (const block of blocks) {
    if (block.kind !== 'IMAGE') continue; //  el texto de portada sigue centrado a propósito

    const animations = (Array.isArray(block.animations) ? block.animations : []) as {
      kind: string;
      steps: { dy?: number; scale?: number; fromScale?: number; useScale?: boolean }[];
    }[];
    // Los iconos del menú van a la derecha; el wordmark, a la izquierda.
    const isMenuIcon = block.scope === 'GLOBAL';

    // La animación de scroll solo tiene sentido en la portada, donde el
    // wordmark entra grande y encoge hasta la cabecera. En el resto de páginas
    // ya nace pequeño y la animación es un resto: en /contact, además, la
    // página no llega a desplazarse, así que el logo se quedaba a media altura
    // encima del contenido para siempre. Se retira allí donde no aporta.
    const isHomeHero = block.page?.slug === '';
    if (!isHomeHero && animations.some((a) => a.kind === 'SCROLL')) {
      await prisma.block.update({
        where: { id: block.id },
        data: { animations: animations.filter((a) => a.kind !== 'SCROLL') as never },
      });
    }
    const scroll = isHomeHero ? animations.find((a) => a.kind === 'SCROLL')?.steps[0] : undefined;

    const place = (
      width: number | null,
      height: number | null,
      box: (typeof CONTAINER)['desktop'],
      animate: boolean
    ) => {
      const w = width ?? 0;
      const h = height ?? 0;
      const x = isMenuIcon ? box.width - box.gutter - w : box.gutter;

      // Sin animación, el centro del bloque debe caer en la línea de cabecera.
      // Con ella, el bloque escala alrededor de su centro y luego se desplaza,
      // así que se despeja la posición inicial que deja el centro final ahí.
      if (!animate || !scroll?.useScale) return { x, y: box.chromeMid - h / 2 };
      const dy = scroll.dy ?? 0;
      return { x, y: box.chromeMid - h / 2 - dy };
    };

    // El desplazamiento por scroll solo ocurre en escritorio.
    const d = place(block.dW, block.dH, CONTAINER.desktop, Boolean(scroll));
    const m = place(block.mW, block.mH, CONTAINER.mobile, false);

    await prisma.block.update({
      where: { id: block.id },
      data: {
        dX: d.x,
        dY: d.y,
        dFixed: 'container',
        mX: m.x,
        mY: m.y,
        mFixed: 'container',
      },
    });
    moved += 1;
  }

  log(`✓ ${moved} elementos de cabecera alineados al container`);
}

/**
 * Corrige el bloque de formación y experiencia de /about en móvil.
 *
 * El original arrastra dos errores que solo se ven en la versión de teléfono:
 *
 *  1. Los rótulos están cruzados. «Education» encabeza los empleos (MSH, Xploy,
 *     PrintArt) y «Experience» los títulos (Master, Bachelor); en escritorio
 *     están al revés, que es lo correcto. El texto es el mismo objeto para los
 *     dos viewports, así que no se puede reescribir sin romper el escritorio:
 *     lo que se intercambia es la posición móvil de cada rótulo.
 *
 *  2. Entre el párrafo «This portfolio brings together…» (termina en 697) y la
 *     primera sección hay 178 unidades vacías, más del triple de la separación
 *     que la propia página usa entre secciones (46). Todo lo que va por debajo
 *     sube 118 unidades y el alto de la página se recorta igual, de modo que el
 *     aire sobrante del final se conserva tal cual.
 *
 * Las cuatro cajas se alinean además al margen de 20 del container; el original
 * mezcla 19 y 20 sin criterio.
 */
async function fixAboutMobile() {
  const SHIFT = 118;
  const GUTTER = CONTAINER.mobile.gutter;

  // y de destino en móvil, ya con el desplazamiento aplicado y los rótulos
  // puestos cada uno sobre su propio contenido.
  const layout: Record<string, number> = {
    '69efd65508d2323e999ec8a8': 875 - SHIFT, // «Experience» → sobre los empleos
    '69efd65508d2323e999ec8a9': 902 - SHIFT, //   MSH · Xploy · PrintArt
    '69efd65508d2323e999ec8aa': 1052 - SHIFT, // «Education» → sobre los títulos
    '69efd65508d2323e999ec8ab': 1076 - SHIFT, //   Master · Bachelor
  };

  let fixed = 0;
  for (const [id, mY] of Object.entries(layout)) {
    const block = await prisma.block.findUnique({ where: { id }, select: { id: true } });
    if (!block) continue;
    await prisma.block.update({ where: { id }, data: { mY, mX: GUTTER } });
    fixed += 1;
  }

  if (fixed) {
    const page = await prisma.page.findFirst({
      where: { slug: 'about' },
      select: { id: true, heightMobile: true },
    });
    if (page?.heightMobile) {
      await prisma.page.update({
        where: { id: page.id },
        data: { heightMobile: page.heightMobile - SHIFT },
      });
    }
    log(`✓ /about móvil: rótulos corregidos y ${SHIFT} unidades de hueco eliminadas`);
  }
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(MODEL_PATH)) {
    throw new Error(
      `No se encontró ${MODEL_PATH}.\n` +
        'Es el volcado del proyecto original y es la fuente de este importador.'
    );
  }

  const model = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as RmProject;
  const { mag, pages } = model;

  if (!existsSync(ASSETS_DIR)) {
    log('⚠  _reference/assets no existe: los SVG se importarán sin markup inline');
    log('   y las dimensiones se tomarán solo de los metadatos de cada widget.\n');
  }

  // --- Estilos de texto -----------------------------------------------------
  const styleKeys = new Map<string, string>(); //  nombre Readymag → clave propia
  for (const style of mag.textStyles.project) {
    const converted = convertTextStyle(style);
    styleKeys.set(style.name, converted.key);
  }

  // Varios estilos comparten `_id` en el original; se deduplica por clave.
  const uniqueStyles = new Map<string, ReturnType<typeof convertTextStyle>>();
  mag.textStyles.project.forEach((style, index) => {
    const converted = convertTextStyle(style);
    if (!uniqueStyles.has(converted.key)) {
      uniqueStyles.set(converted.key, { ...converted, order: index } as never);
    }
  });

  for (const [key, style] of uniqueStyles) {
    await prisma.textStyle.upsert({
      where: { key },
      create: style as never,
      update: style as never,
    });
  }
  log(`✓ ${uniqueStyles.size} estilos de texto`);

  // --- Estilos de enlace ----------------------------------------------------
  const linkStyleKeys = new Map<string, string>();
  for (const [index, style] of mag.linkStyles.project.entries()) {
    const key = styleKey(style.name, style.label);
    linkStyleKeys.set(style.name, key);
    const link = style.style.link ?? {};
    const hover = style.style.hover ?? {};
    const current = style.style.current ?? {};
    const data = {
      key,
      label: style.label || 'Enlace',
      color: rmColor(link.textColor),
      decoration: (link.type ?? 'None').toLowerCase(),
      decorationSize: link.size ?? 1,
      decorationGap: link.padding ?? 0,
      hoverColor: rmColor(hover.textColor),
      hoverDecoration: (hover.type ?? 'None').toLowerCase(),
      currentColor: rmColor(current.textColor),
      currentDecoration: (current.type ?? 'None').toLowerCase(),
      currentSize: current.size ?? 1,
      currentGap: current.padding ?? 0,
      order: index,
    };
    await prisma.linkStyle.upsert({ where: { key }, create: data, update: data });
  }
  log(`✓ ${linkStyleKeys.size} estilos de enlace`);

  // --- Assets ---------------------------------------------------------------
  const assets = new Map<string, AssetRecord>(); //  url → asset

  function registerAsset(picture: RmPicture | undefined, widget: RmWidget): string | null {
    const url = pictureUrl(picture);
    if (!url) return null;
    if (!assets.has(url)) {
      assets.set(url, buildAsset(url, widget.originalW, widget.originalH));
    }
    return assets.get(url)!.id;
  }

  const allWidgets: { widget: RmWidget; pageUri: string | null }[] = [];
  for (const [uri, page] of Object.entries(pages)) {
    for (const widget of page.widgetsData ?? []) allWidgets.push({ widget, pageUri: uri });
  }
  for (const widget of mag.aboveAllWidgets ?? []) allWidgets.push({ widget, pageUri: null });

  for (const { widget } of allWidgets) {
    registerAsset(widget.picture, widget);
    registerAsset(widget.viewport_phone_portrait?.picture, widget);
    // Los iconos guardan su imagen fuera de `picture`, así que hay que
    // registrarlos aquí también: si no, los bloques los referenciarían antes
    // de que existan.
    if (widget.tp === 'icon') {
      registerAsset(iconPicture(widget), widget);
      registerAsset(iconPicture(widget.viewport_phone_portrait), widget);
    }
  }

  for (const asset of assets.values()) {
    const existing = await prisma.asset.findUnique({
      where: { id: asset.id },
      select: { pathname: true, alt: true },
    });
    const data = {
      filename: asset.filename,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      isSvg: asset.isSvg,
      svgMarkup: asset.svgMarkup,
    };
    await prisma.asset.upsert({
      where: { id: asset.id },
      create: { id: asset.id, url: asset.url, ...data },
      // La URL solo se escribe si el asset sigue apuntando fuera. Un asset con
      // `pathname` ya vive en nuestro almacenamiento, y sobreescribirlo con la
      // del CDN de origen deshacía la migración cada vez que se reimportaba.
      update: existing?.pathname ? data : { url: asset.url, ...data },
    });
  }
  log(`✓ ${assets.size} assets`);

  // --- Páginas --------------------------------------------------------------
  const pageIdByRmId = new Map<string, string>();
  const pageIdByUri = new Map<string, string>();

  for (const [uri, page] of Object.entries(pages)) {
    const meta = PAGE_META[uri];
    if (!meta) {
      log(`⚠  página "${uri}" sin metadatos declarados: se omite`);
      continue;
    }
    const background = (page.widgetsData ?? []).find((w) => w.type === 'background');
    const data = {
      slug: meta.slug,
      kind: meta.kind,
      title: meta.title,
      order: meta.order,
      published: true,
      heightDesktop: Math.round(page.height),
      heightMobile: Math.round(page.viewport_phone_portrait?.height ?? page.height),
      backgroundColor: background?.color ? rmColor(background.color) : null,
    };
    await prisma.page.upsert({
      where: { id: page._id },
      create: { id: page._id, ...data },
      update: data,
    });
    pageIdByRmId.set(page._id, page._id);
    pageIdByUri.set(uri, page._id);
  }
  log(`✓ ${pageIdByUri.size} páginas`);

  // --- Bloques --------------------------------------------------------------
  // Los IDs de widget se reutilizan como IDs de bloque, así que el mapa de
  // disparadores de animación es la identidad.
  const identity = new Map<string, string>(allWidgets.map(({ widget }) => [widget.wid, widget.wid]));

  // Los enlaces internos dentro del texto apuntan al `pageId` de Readymag; hace
  // falta traducirlo al slug público para poder generar el href.
  const pageSlugById = new Map<string, string>();
  for (const [uri, page] of Object.entries(pages)) {
    const meta = PAGE_META[uri];
    if (meta) pageSlugById.set(page._id, meta.slug);
  }

  const homeId = pageIdByUri.get('main') ?? null;
  let blockCount = 0;
  const unresolvedLinks = new Set<string>();

  async function importWidget(widget: RmWidget, pageId: string | null, scope: 'PAGE' | 'GLOBAL') {
    if (widget.type === 'background') return; //  se guarda como color de página

    // Los iconos (el botón del menú y la equis) son "formas" en Readymag, pero
    // se dibujan como PNG rasterizados. Se importan como imágenes usando el
    // raster 3x, que a tamaño real queda a ~3 dpi y se ve nítido.
    const isIcon = widget.type === 'shape' && widget.tp === 'icon';

    const kind =
      widget.type === 'text' ? 'TEXT' : widget.type === 'picture' || isIcon ? 'IMAGE' : 'SHAPE';

    const viewport = widget.viewport_phone_portrait;
    const assetId = isIcon
      ? registerAsset(iconPicture(widget), widget)
      : registerAsset(widget.picture, widget);
    const mobileAssetId = isIcon
      ? registerAsset(iconPicture(viewport), widget)
      : registerAsset(viewport?.picture, widget);

    // Los enlaces apuntan al `_id` de una página. Algunos widgets conservan
    // referencias a páginas que ya no existen (quedaron de versiones previas);
    // esos caen al inicio y se listan al final para poder revisarlos.
    let linkPageId: string | null = null;
    if (widget.clickLink) {
      linkPageId = pageIdByRmId.get(widget.clickLink) ?? homeId;
      if (!pageIdByRmId.has(widget.clickLink)) unresolvedLinks.add(widget.clickLink);
    }

    const text =
      kind === 'TEXT'
        ? convertText(widget, styleKeys, linkStyleKeys, pageSlugById, widget.verticalAlign)
        : null;

    // El viewport móvil casi nunca redefine el texto, pero sí su tipografía:
    // trae `styles` y `blocksMeta` propios (tamaños e interlineados más
    // pequeños) reutilizando los mismos párrafos. Si solo se mirara `blocks`,
    // el móvil heredaría los cuerpos de escritorio y el texto desbordaría.
    const hasMobileTypography = Boolean(
      viewport && (viewport.blocks?.length || viewport.styles?.length || viewport.blocksMeta?.length)
    );
    const mobileText =
      kind === 'TEXT' && viewport && hasMobileTypography
        ? convertText(
            {
              blocks: viewport.blocks?.length ? viewport.blocks : widget.blocks,
              styles: viewport.styles?.length ? viewport.styles : widget.styles,
              blocksMeta: viewport.blocksMeta?.length ? viewport.blocksMeta : widget.blocksMeta,
              entityMap: viewport.entityMap ?? widget.entityMap,
            },
            styleKeys,
            linkStyleKeys,
            pageSlugById,
            widget.verticalAlign
          )
        : null;

    // En los widgets globales `hidden` no controla la visibilidad por viewport
    // sino la visibilidad por página (el detalle vive en un array `_hidden` con
    // una entrada por página). Los cuatro del menú lo traen a `true` y aun así
    // el original los dibuja en todas las páginas, así que aquí se fuerzan
    // visibles: el CMS gestiona su visibilidad con sus propios campos.
    const geometry = {
      ...desktopGeometry(widget),
      ...mobileGeometry(widget, viewport),
    };
    if (scope === 'GLOBAL') {
      geometry.dHidden = false;
      geometry.mHidden = false;
    }

    const data = {
      scope,
      pageId,
      kind: kind as 'TEXT' | 'IMAGE' | 'SHAPE',
      name: widget.name || null,
      z: widget.z ?? viewport?.z ?? 0,
      ...geometry,
      opacity: widget.opacity ?? 1,
      text: text as never,
      mobileText: mobileText as never,
      image: (isIcon
        ? { objectFit: 'contain', alt: '' }
        : kind === 'IMAGE'
          ? convertImage(widget)
          : null) as never,
      mobileImage: (isIcon
        ? { objectFit: 'contain', alt: '' }
        : kind === 'IMAGE' && viewport
          ? convertImage(widget, viewport)
          : null) as never,
      shape: (kind === 'SHAPE' ? convertShape(widget) : null) as never,
      assetId,
      mobileAssetId: mobileAssetId !== assetId ? mobileAssetId : null,
      linkPageId,
      linkTarget: widget.clickTarget || '_self',
      animations: convertAnimations(widget.animation, identity) as never,
    };

    await prisma.block.upsert({
      where: { id: widget.wid },
      create: { id: widget.wid, ...data },
      update: data,
    });
    blockCount += 1;
  }

  for (const [uri, page] of Object.entries(pages)) {
    const pageId = pageIdByUri.get(uri);
    if (!pageId) continue;
    for (const widget of page.widgetsData ?? []) {
      await importWidget(widget, pageId, 'PAGE');
    }
  }
  for (const widget of mag.aboveAllWidgets ?? []) {
    await importWidget(widget, null, 'GLOBAL');
  }
  log(`✓ ${blockCount} bloques`);
  if (unresolvedLinks.size) {
    log(
      `⚠  ${unresolvedLinks.size} enlaces apuntaban a páginas inexistentes y se ` +
        'redirigieron al inicio (revisar en el CMS):'
    );
    for (const id of unresolvedLinks) log(`     ${id}`);
  }

  // Assets nuevos descubiertos durante la importación de bloques.
  for (const asset of assets.values()) {
    await prisma.asset.upsert({
      where: { id: asset.id },
      create: {
        id: asset.id,
        url: asset.url,
        filename: asset.filename,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        isSvg: asset.isSvg,
        svgMarkup: asset.svgMarkup,
      },
      update: {},
    });
  }

  // --- Cabecera -------------------------------------------------------------
  await layoutChrome();
  await fixAboutMobile();

  // --- Proyectos ------------------------------------------------------------
  let projectCount = 0;
  for (const [uri, meta] of Object.entries(PROJECT_META)) {
    const pageId = pageIdByUri.get(uri);
    if (!pageId) continue;
    const data = {
      name: meta.name,
      client: meta.client ?? null,
      year: meta.year ?? null,
      supervision: meta.supervision ?? null,
      order: PAGE_META[uri].order,
      featured: true,
      nextPageId: pageIdByUri.get(meta.next) ?? null,
    };
    await prisma.project.upsert({
      where: { pageId },
      create: { pageId, ...data },
      update: data,
    });
    projectCount += 1;
  }
  log(`✓ ${projectCount} proyectos`);

  // --- Menú -----------------------------------------------------------------
  const nav = [
    { label: 'work', uri: 'main', order: 0 },
    { label: 'about', uri: 'about', order: 1 },
    { label: 'contact', uri: 'contacts', order: 2 },
  ];
  await prisma.navItem.deleteMany({});
  for (const item of nav) {
    await prisma.navItem.create({
      data: { label: item.label, order: item.order, pageId: pageIdByUri.get(item.uri) ?? null },
    });
  }
  log(`✓ ${nav.length} entradas de menú`);

  // --- Ajustes --------------------------------------------------------------
  const settings = {
    siteTitle: mag.title || 'Caroline Contreras',
    metaDescription: mag.description ?? '',
    backgroundColor: '#efefef',
    desktopWidth: mag.desktopWidth || 1024,
    mobileWidth: mag.phoneWidth || 320,
    tabletBreakpoint: 768,
    email: CONTACT.email,
    instagramUrl: CONTACT.instagram,
    linkedinUrl: CONTACT.linkedin,
  };
  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...settings },
    update: settings,
  });
  log('✓ ajustes del sitio');

  log('\nImportación completada.');
}

main()
  .catch((error) => {
    console.error('\n✗ La importación falló:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
