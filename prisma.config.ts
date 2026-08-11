import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Neon expone dos cadenas de conexión: la "pooled" que usa la app en runtime y
// la directa que necesitan las migraciones. Si solo hay una, se usa para ambas.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});
