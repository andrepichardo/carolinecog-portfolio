'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/admin/session';
import { del } from '@vercel/blob';

/**
 * Acciones de escritura del CMS.
 *
 * Todas empiezan verificando la sesión: una acción de servidor es un endpoint
 * público, y que el enlace viva bajo /admin no impide que alguien la invoque
 * directamente.
 *
 * Tras cada cambio se revalida `/` y la ruta afectada, porque las páginas del
 * sitio son estáticas y no volverían a leer la base de datos por su cuenta.
 */

function revalidateSite(slug?: string | null) {
  revalidatePath('/', 'layout');
  if (slug) revalidatePath(slug === '' ? '/' : `/${slug}`);
}

type ActionResult = { ok: true } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult> {
  await requireUser();
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    console.error('[cms]', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong' };
  }
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

const pageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title cannot be empty'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, 'Slug accepts lowercase letters, numbers and hyphens only')
    .transform((v) => v.trim()),
  published: z.boolean(),
  heightDesktop: z.number().int().min(1).max(20000),
  heightMobile: z.number().int().min(1).max(20000),
  backgroundColor: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
});

export async function updatePage(input: z.input<typeof pageSchema>): Promise<ActionResult> {
  return guard(async () => {
    const data = pageSchema.parse(input);
    const previous = await prisma.page.findUnique({
      where: { id: data.id },
      select: { slug: true },
    });
    const { id, ...rest } = data;
    await prisma.page.update({ where: { id }, data: rest });
    revalidateSite(previous?.slug);
    revalidateSite(data.slug);
  });
}

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

const geometrySchema = z.object({
  dX: z.number().nullable(),
  dY: z.number().nullable(),
  dW: z.number().nullable(),
  dH: z.number().nullable(),
  dRotation: z.number(),
  dHidden: z.boolean(),
  mX: z.number().nullable(),
  mY: z.number().nullable(),
  mW: z.number().nullable(),
  mH: z.number().nullable(),
  mRotation: z.number(),
  mHidden: z.boolean(),
  z: z.number().int(),
  opacity: z.number().min(0).max(1),
});

const blockSchema = geometrySchema.partial().extend({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  text: z.unknown().optional(),
  mobileText: z.unknown().optional(),
  image: z.unknown().optional(),
  shape: z.unknown().optional(),
  assetId: z.string().nullable().optional(),
  linkUrl: z.string().nullable().optional(),
  linkPageId: z.string().nullable().optional(),
  linkTarget: z.string().optional(),
});

export async function updateBlock(input: z.input<typeof blockSchema>): Promise<ActionResult> {
  return guard(async () => {
    const { id, ...data } = blockSchema.parse(input);
    const block = await prisma.block.update({
      where: { id },
      data: data as never,
      select: { page: { select: { slug: true } } },
    });
    revalidateSite(block.page?.slug);
  });
}

/** Guarda la geometría de varios bloques a la vez (arrastrar en el editor). */
export async function updateBlockGeometry(
  updates: { id: string; geometry: Partial<z.infer<typeof geometrySchema>> }[]
): Promise<ActionResult> {
  return guard(async () => {
    if (!updates.length) return;
    const parsed = updates.map((u) => ({
      id: z.string().min(1).parse(u.id),
      geometry: geometrySchema.partial().parse(u.geometry),
    }));
    await prisma.$transaction(
      parsed.map((u) => prisma.block.update({ where: { id: u.id }, data: u.geometry }))
    );
    const first = await prisma.block.findUnique({
      where: { id: parsed[0].id },
      select: { page: { select: { slug: true } } },
    });
    revalidateSite(first?.page?.slug);
  });
}

export async function createBlock(
  pageId: string,
  kind: 'TEXT' | 'IMAGE' | 'SHAPE'
): Promise<ActionResult> {
  return guard(async () => {
    const page = await prisma.page.findUniqueOrThrow({
      where: { id: pageId },
      select: { slug: true },
    });
    const top = await prisma.block.aggregate({ where: { pageId }, _max: { z: true } });

    const defaults = {
      TEXT: {
        text: { paragraphs: [{ text: 'New text', fontSize: 18, lineHeight: 24 }] },
        dW: 300,
        dH: 60,
        mW: 280,
        mH: 60,
      },
      IMAGE: { image: { objectFit: 'cover' as const }, dW: 320, dH: 240, mW: 280, mH: 210 },
      SHAPE: {
        shape: { kind: 'RECTANGLE' as const, fill: '#000000', opacity: 1 },
        dW: 240,
        dH: 4,
        mW: 280,
        mH: 4,
      },
    }[kind];

    await prisma.block.create({
      data: {
        pageId,
        kind,
        name: kind === 'TEXT' ? 'Text' : kind === 'IMAGE' ? 'Image' : 'Shape',
        z: (top._max.z ?? 300) + 1,
        dX: 48,
        dY: 48,
        mX: 20,
        mY: 48,
        ...defaults,
      } as never,
    });
    revalidateSite(page.slug);
  });
}

export async function duplicateBlock(id: string): Promise<ActionResult> {
  return guard(async () => {
    const source = await prisma.block.findUniqueOrThrow({ where: { id } });
    const { id: _omit, createdAt, updatedAt, ...rest } = source;
    await prisma.block.create({
      data: {
        ...rest,
        name: source.name ? `${source.name} (copy)` : null,
        dX: (source.dX ?? 0) + 16,
        dY: (source.dY ?? 0) + 16,
        z: source.z + 1,
      } as never,
    });
    const page = source.pageId
      ? await prisma.page.findUnique({ where: { id: source.pageId }, select: { slug: true } })
      : null;
    revalidateSite(page?.slug);
  });
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  return guard(async () => {
    const block = await prisma.block.findUniqueOrThrow({
      where: { id },
      select: { page: { select: { slug: true } } },
    });
    await prisma.block.delete({ where: { id } });
    revalidateSite(block.page?.slug);
  });
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  client: z.string().nullable(),
  year: z.string().nullable(),
  supervision: z.string().nullable(),
  summary: z.string().nullable(),
  order: z.number().int(),
  featured: z.boolean(),
  nextPageId: z.string().nullable(),
});

export async function updateProject(input: z.input<typeof projectSchema>): Promise<ActionResult> {
  return guard(async () => {
    const { id, ...data } = projectSchema.parse(input);
    await prisma.project.update({ where: { id }, data });
    revalidateSite();
  });
}

/**
 * Fija el orden de los proyectos a partir de la lista que envía el CMS.
 *
 * Se recibe la secuencia completa y se renumera de cero en adelante, en vez de
 * guardar el número de cada uno por separado: así el orden que se ve en la
 * pantalla es literalmente el que se guarda, y no hay forma de acabar con dos
 * proyectos compartiendo posición.
 */
export async function reorderProjects(ids: string[]): Promise<ActionResult> {
  return guard(async () => {
    const parsed = z.array(z.string().min(1)).min(1).parse(ids);
    await prisma.$transaction(
      parsed.map((id, index) =>
        prisma.project.update({ where: { id }, data: { order: index } })
      )
    );
    revalidateSite();
  });
}

const newProjectSchema = z.object({
  name: z.string().min(1, 'Give the project a name'),
  slug: z
    .string()
    .min(1, 'Give the project a web address')
    .regex(/^[a-z0-9-]+$/, 'The address accepts lowercase letters, numbers and hyphens only'),
  templatePageId: z.string().nullable(),
});

/**
 * Crea un proyecto, opcionalmente copiando otro como plantilla.
 *
 * Una página en blanco sería un lienzo vacío de más de dos mil unidades de
 * alto: inservible como punto de partida. Copiando un proyecto existente se
 * hereda la retícula, la tipografía y la ficha técnica, y solo queda sustituir
 * textos e imágenes.
 *
 * Al copiar hay dos referencias que no se pueden arrastrar tal cual:
 *   · `animations[].triggerBlockIds` apunta a otros bloques (las imágenes que
 *     se atenúan al pasar por encima de un rectángulo invisible);
 *   · `linkPageId` puede apuntar a la propia página de la plantilla.
 * Ambas se reescriben hacia los bloques y la página nuevos.
 */
export async function createProject(
  input: z.input<typeof newProjectSchema>
): Promise<ActionResult & { pageId?: string }> {
  await requireUser();
  try {
    const data = newProjectSchema.parse(input);

    const clash = await prisma.page.findUnique({ where: { slug: data.slug } });
    if (clash) throw new Error(`The address /${data.slug} is already taken.`);

    const template = data.templatePageId
      ? await prisma.page.findUnique({
          where: { id: data.templatePageId },
          include: { blocks: true, project: true },
        })
      : null;

    const lastOrder = await prisma.page.aggregate({ _max: { order: true } });
    const pageId = randomUUID();

    // Los IDs se generan por adelantado para poder reescribir las referencias
    // entre bloques antes de insertarlos.
    const idMap = new Map<string, string>();
    for (const block of template?.blocks ?? []) idMap.set(block.id, randomUUID());

    const remapAnimations = (animations: unknown) => {
      if (!Array.isArray(animations)) return animations;
      return animations.map((animation) => {
        if (typeof animation !== 'object' || animation === null) return animation;
        const a = animation as { triggerBlockIds?: unknown };
        if (!Array.isArray(a.triggerBlockIds)) return animation;
        return {
          ...a,
          triggerBlockIds: a.triggerBlockIds.map((id) =>
            typeof id === 'string' ? (idMap.get(id) ?? id) : id
          ),
        };
      });
    };

    await prisma.$transaction(async (tx) => {
      await tx.page.create({
        data: {
          id: pageId,
          slug: data.slug,
          kind: 'PROJECT',
          title: data.name,
          order: (lastOrder._max.order ?? 0) + 1,
          published: false, //  nace como borrador: se publica cuando esté lista
          heightDesktop: template?.heightDesktop ?? 2800,
          heightMobile: template?.heightMobile ?? 2700,
          backgroundColor: template?.backgroundColor ?? null,
        },
      });

      for (const block of template?.blocks ?? []) {
        const { id, createdAt, updatedAt, pageId: _oldPage, ...rest } = block;
        await tx.block.create({
          data: {
            ...rest,
            id: idMap.get(id)!,
            pageId,
            // Un enlace a la propia plantilla debe apuntar a la página nueva.
            linkPageId: block.linkPageId === template?.id ? pageId : block.linkPageId,
            animations: remapAnimations(block.animations) as never,
          } as never,
        });
      }

      await tx.project.create({
        data: {
          pageId,
          name: data.name,
          client: template?.project?.client ?? null,
          year: template?.project?.year ?? null,
          supervision: template?.project?.supervision ?? null,
          order: (template?.project?.order ?? 0) + 1,
          featured: false,
        },
      });
    });

    revalidateSite();
    return { ok: true, pageId };
  } catch (error) {
    console.error('[cms]', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong' };
  }
}

/** Borra un proyecto y su página. Los bloques caen en cascada. */
export async function deleteProject(id: string): Promise<ActionResult> {
  return guard(async () => {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id },
      select: { pageId: true },
    });
    // Borrar la página arrastra sus bloques y el propio proyecto; los demás
    // proyectos que la tuvieran como "siguiente" se quedan sin ella, no rotos.
    await prisma.page.delete({ where: { id: project.pageId } });
    revalidateSite();
  });
}

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------

const textStyleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fontToken: z.enum(['SANS', 'GROTESK', 'DISPLAY', 'ROUND']),
  fontOpticalSize: z.number().int().nullable(),
  fontWeight: z.number().int().min(100).max(900),
  fontSize: z.number().min(1).max(400),
  lineHeight: z.number().min(1).max(400),
  letterSpacing: z.number().min(-40).max(40),
  textTransform: z.string(),
  textAlign: z.string(),
  color: z.string(),
});

export async function updateTextStyle(
  input: z.input<typeof textStyleSchema>
): Promise<ActionResult> {
  return guard(async () => {
    const { id, ...data } = textStyleSchema.parse(input);
    await prisma.textStyle.update({ where: { id }, data });
    revalidateSite();
  });
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  siteTitle: z.string().min(1),
  metaDescription: z.string(),
  backgroundColor: z.string(),
  email: z.string(),
  instagramUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  adobeFontsKit: z.string().nullable(),
  faviconId: z.string().nullable(),
  ogImageId: z.string().nullable(),
});

export async function updateSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  return guard(async () => {
    const data = settingsSchema.parse(input);
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
    revalidateSite();
  });
}

// ---------------------------------------------------------------------------
// Menú
// ---------------------------------------------------------------------------

const navSchema = z.array(
  z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    pageId: z.string().nullable(),
    url: z.string().nullable(),
  })
);

export async function saveNavItems(input: z.input<typeof navSchema>): Promise<ActionResult> {
  return guard(async () => {
    const items = navSchema.parse(input);
    await prisma.$transaction([
      prisma.navItem.deleteMany({}),
      ...items.map((item, index) =>
        prisma.navItem.create({
          data: { label: item.label, pageId: item.pageId, url: item.url, order: index },
        })
      ),
    ]);
    revalidateSite();
  });
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

export async function updateAssetAlt(id: string, alt: string): Promise<ActionResult> {
  return guard(async () => {
    await prisma.asset.update({ where: { id }, data: { alt: alt || null } });
    revalidateSite();
  });
}

/**
 * Borra una imagen de la biblioteca.
 *
 * Si está en uso hace falta `force`, que confirma que se acepta la
 * consecuencia: los bloques que la usaban se quedan sin imagen (el schema los
 * pone a null, no los borra), así que la página sigue funcionando y basta con
 * asignarles otra desde el editor.
 */
export async function deleteAsset(id: string, force = false): Promise<ActionResult> {
  return guard(async () => {
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id } });
    const used = await prisma.block.count({
      where: { OR: [{ assetId: id }, { mobileAssetId: id }] },
    });
    if (used > 0 && !force) {
      throw new Error(`${used} block(s) still use this image.`);
    }
    // Solo se borra del almacenamiento lo que subimos nosotros; un asset que
    // todavía apunte a un CDN externo no es nuestro.
    if (asset.pathname) {
      try {
        await del(asset.pathname);
      } catch (error) {
        console.warn('[cms] could not delete from Blob:', error);
      }
    }
    await prisma.asset.delete({ where: { id } });
    revalidateSite();
  });
}
