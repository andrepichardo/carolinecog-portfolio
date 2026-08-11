import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { imageSize } from 'image-size';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sanitizeSvg, svgDimensions } from '@/lib/svg';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

/**
 * Sube una imagen a Vercel Blob y la registra en la biblioteca.
 *
 * Los SVG se guardan además como markup para poder incrustarlos en línea (así
 * escalan sin pérdida y heredan color), pasando antes por el saneador: acaban
 * dentro de dangerouslySetInnerHTML.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Falta BLOB_READ_WRITE_TOKEN. Conecta un store de Blob al proyecto en Vercel (Storage → Blob).',
      },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera los 25 MB' }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `Formato no admitido: ${file.type || 'desconocido'}` },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isSvg = file.type === 'image/svg+xml';

  let width: number | null = null;
  let height: number | null = null;
  let svgMarkup: string | null = null;

  if (isSvg) {
    svgMarkup = sanitizeSvg(buffer.toString('utf8'));
    const dims = svgDimensions(svgMarkup);
    width = dims?.width ?? null;
    height = dims?.height ?? null;
  } else {
    try {
      const dims = imageSize(buffer);
      width = dims.width ?? null;
      height = dims.height ?? null;
    } catch {
      // Sin dimensiones, next/image usa las del bloque.
    }
  }

  const blob = await put(`portfolio/${file.name}`, buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  });

  const asset = await prisma.asset.create({
    data: {
      url: blob.url,
      pathname: blob.pathname,
      filename: file.name,
      mimeType: file.type,
      bytes: file.size,
      width,
      height,
      isSvg,
      svgMarkup,
    },
  });

  return NextResponse.json({ asset });
}
