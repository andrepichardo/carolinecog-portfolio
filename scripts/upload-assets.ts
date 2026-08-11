/**
 * Migra las imágenes del CDN de Readymag a Vercel Blob.
 *
 * Tras el import inicial, los assets siguen apuntando a `*.rmcdn.net`, que es
 * infraestructura de Readymag: sirve mientras se valida la reconstrucción, pero
 * el sitio no debería depender de ella. Este script sube cada archivo a Blob y
 * reescribe la URL en la base de datos.
 *
 * Prefiere el archivo local de _reference/assets (es el original sin recomprimir)
 * y solo descarga del CDN si no está.
 *
 *   npm run assets:upload
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { prisma } from '../src/lib/prisma';

const ASSETS_DIR = join(process.cwd(), '_reference', 'assets');

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'Falta BLOB_READ_WRITE_TOKEN.\n' +
        'En Vercel: proyecto → Storage → Blob → conectar, y luego `vercel env pull` para traerlo.'
    );
  }

  const assets = await prisma.asset.findMany({ where: { pathname: null } });
  if (!assets.length) {
    console.log('No queda ningún asset por migrar.');
    return;
  }

  console.log(`Migrando ${assets.length} archivos…\n`);
  let migrated = 0;
  let failed = 0;

  for (const asset of assets) {
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

  console.log(`\n${migrated} migrados, ${failed} con error.`);
  if (migrated) {
    console.log(
      'Recuerda quitar los dominios rmcdn.net de `images.remotePatterns` en next.config.ts\n' +
        'cuando ya no quede ningún asset apuntando allí.'
    );
  }
}

main()
  .catch((error) => {
    console.error('\n✗ La migración falló:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
