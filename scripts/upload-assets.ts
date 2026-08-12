/**
 * Deja todas las imágenes servidas desde Vercel Blob.
 *
 * Hace dos cosas, y es seguro ejecutarlo tantas veces como haga falta:
 *
 *   1. Sube a Blob los assets que todavía apunten fuera (tras el import
 *      inicial, las URLs son las del CDN de Readymag).
 *   2. Repara los que ya están en Blob pero cuya URL no coincide con el
 *      archivo, cotejando contra el contenido real del store.
 *
 * Prefiere el archivo local de _reference/assets (es el original sin
 * recomprimir) y solo descarga del CDN si no está.
 *
 *   yarn assets:upload
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { list, put } from '@vercel/blob';
import { prisma } from '../src/lib/prisma';

const ASSETS_DIR = join(process.cwd(), '_reference', 'assets');

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is missing.\n' +
        'In Vercel: project → Storage → Blob → connect, then copy the token into .env.'
    );
  }

  const assets = await prisma.asset.findMany();

  // --- 1. reparar los que ya están en Blob ---------------------------------
  const stored = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    for (const blob of page.blobs) stored.set(blob.pathname, blob.url);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  let repaired = 0;
  for (const asset of assets) {
    if (!asset.pathname) continue;
    const url = stored.get(asset.pathname);
    if (url && url !== asset.url) {
      await prisma.asset.update({ where: { id: asset.id }, data: { url } });
      repaired += 1;
    }
  }
  if (repaired) console.log(`✓ ${repaired} URLs repaired against the Blob store`);

  // --- 2. subir lo que falte -----------------------------------------------
  const pending = assets.filter((a) => !a.pathname);
  if (!pending.length) {
    console.log(repaired ? 'Nothing left to upload.' : 'Everything is already on Blob.');
    return;
  }

  console.log(`Uploading ${pending.length} files…\n`);
  let migrated = 0;
  let failed = 0;

  for (const asset of pending) {
    const localPath = join(ASSETS_DIR, asset.filename);
    try {
      let data: Buffer;
      if (existsSync(localPath)) {
        data = readFileSync(localPath);
      } else {
        const response = await fetch(asset.url, {
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://readymag.website/' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = Buffer.from(await response.arrayBuffer());
      }

      const blob = await put(`portfolio/${asset.filename}`, data, {
        access: 'public',
        addRandomSuffix: true,
        contentType: asset.mimeType,
      });

      await prisma.asset.update({
        where: { id: asset.id },
        data: { url: blob.url, pathname: blob.pathname, bytes: data.length },
      });

      migrated += 1;
      console.log(`  ✓ ${asset.filename}`);
    } catch (error) {
      failed += 1;
      console.log(`  ✗ ${asset.filename} — ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n${migrated} uploaded, ${failed} failed.`);
}

main()
  .catch((error) => {
    console.error('\n✗ Failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
