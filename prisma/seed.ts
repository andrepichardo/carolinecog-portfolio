/**
 * Crea el usuario administrador del CMS.
 *
 * El contenido del portafolio no se siembra aquí: lo importa
 * `npm run import:readymag` desde el volcado del proyecto original.
 *
 *   npm run db:seed
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error(
      'Faltan ADMIN_EMAIL y ADMIN_PASSWORD en .env: son las credenciales de acceso al CMS.'
    );
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Caroline Contreras', passwordHash },
    update: { passwordHash },
  });

  console.log(`✓ usuario administrador listo: ${user.email}`);
  console.log('  (la contraseña se toma de ADMIN_PASSWORD y se guarda hasheada)');
}

main()
  .catch((error) => {
    console.error('\n✗ El seed falló:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
