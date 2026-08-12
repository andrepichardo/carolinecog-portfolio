/**
 * Levanta (o reinicia) la base de datos local de desarrollo.
 *
 * `prisma dev` arranca un Postgres embebido (PGlite) que evita depender de Neon
 * mientras se trabaja. Tiene dos limitaciones que este script sortea:
 *
 *   · solo acepta unas seis conexiones simultáneas y se degrada tras un rato de
 *     uso intenso (un `next build` con varios workers basta), así que conviene
 *     reiniciarlo antes de compilar;
 *   · al pararse de forma abrupta deja un lock que impide volver a arrancarlo.
 *
 * Cuando DATABASE_URL apunte a Neon, este script deja de hacer falta.
 *
 *   yarn db:local
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const NAME = 'carolinecog';
const LOCK = join(
  process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'),
  'prisma-dev-nodejs',
  'Data',
  'durable-streams',
  NAME,
  'server.lock.lock'
);

function quiet(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
  } catch (error) {
    return String(error.stdout ?? '') + String(error.stderr ?? '');
  }
}

const strip = (s) => s.replace(/\[[0-9;]*m/g, '').replace(/\]8;;[^]*/g, '');

console.log('· deteniendo el servidor anterior…');
quiet(`yarn prisma dev stop ${NAME}`);
await sleep(1500);

if (existsSync(LOCK)) {
  // Un cierre abrupto deja el lock puesto y el siguiente arranque falla con
  // "Lock file is already being held".
  rmSync(LOCK, { recursive: true, force: true });
  console.log('· lock obsoleto eliminado');
}

console.log('· arrancando el servidor…');
const startOutput = strip(quiet(`yarn prisma dev --name ${NAME} --detach`));
let url = startOutput.match(/postgres:\/\/[^\s"']+template1[^\s"']*/)?.[0] ?? null;

// El arranque en segundo plano tarda un momento en quedar operativo; se espera
// a que `ls` lo dé por vivo antes de tocar la base.
const deadline = Date.now() + 45_000;
let running = false;
while (Date.now() < deadline && !running) {
  await sleep(1000);
  const listing = strip(quiet('yarn prisma dev ls'));
  running = new RegExp(`${NAME}\\s+running`).test(listing);
  if (!url) url = listing.match(/postgres:\/\/[^\s"']+template1[^\s"']*/)?.[0] ?? null;
}

if (!running || !url) {
  console.error('No se pudo arrancar el servidor. Salida:\n', startOutput.slice(-1200));
  process.exit(1);
}

console.log('  URL:', url);

const envPath = '.env';
const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const next = env.includes('DATABASE_URL=')
  ? env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url}"`)
  : `${env}\nDATABASE_URL="${url}"\n`;
if (next !== env) {
  writeFileSync(envPath, next);
  console.log('  .env actualizado');
}

console.log('· sincronizando el schema…');
console.log('  ' + strip(quiet('yarn prisma db push --skip-generate')).trim().split('\n').slice(-1)[0]);

console.log('· importando el contenido…');
console.log(
  strip(quiet('yarn tsx scripts/import-readymag.ts'))
    .split('\n')
    .filter((line) => line.startsWith('✓') || line.startsWith('⚠') || line.startsWith('✗'))
    .map((line) => '  ' + line)
    .join('\n')
);

console.log('· creando el usuario administrador…');
console.log(
  strip(quiet('yarn tsx prisma/seed.ts'))
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => '  ' + line)
    .join('\n')
);

console.log('\nBase local lista.');
