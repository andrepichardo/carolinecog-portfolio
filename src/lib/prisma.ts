import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Prisma 7 exige un driver adapter explícito.
 *
 * En producción la base vive en Neon y se habla por WebSocket, que es lo que
 * funciona desde las funciones serverless de Vercel. En local, `prisma dev`
 * levanta un Postgres normal, así que se usa el driver `pg`. La elección
 * depende de la URL y no de NODE_ENV: así apuntar el entorno local a Neon (o
 * un despliegue a otro Postgres) funciona sin tocar código.
 */
function createAdapter(connectionString: string) {
  const isNeon = /\.neon\.tech|neon\.database|\bneondb\b/.test(connectionString);
  if (isNeon) return new PrismaNeon({ connectionString });

  // La base local de `prisma dev` corre sobre PGlite, que solo acepta unas seis
  // conexiones simultáneas. El servidor de desarrollo de Next evalúa los
  // módulos dos veces (capa RSC y capa SSR), así que con el pool por defecto de
  // diez por instancia se agotan y las consultas mueren con "ConnectionClosed".
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  return new PrismaPg({ connectionString, max: isLocal ? 1 : 10 });
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Falta DATABASE_URL. Copia .env.example a .env y pega la cadena de conexión de Neon,\n' +
        'o levanta una base local con: yarn db:local'
    );
  }
  return new PrismaClient({
    adapter: createAdapter(connectionString),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// En desarrollo Next recarga los módulos en cada cambio; sin este caché se
// abriría una conexión nueva por recarga hasta agotar el pool.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
