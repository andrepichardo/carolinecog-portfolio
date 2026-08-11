import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Verifica la sesión en el servidor.
 *
 * El middleware solo mira si existe la cookie (corre en edge y no puede tocar
 * la base de datos); la comprobación real del JWT se hace aquí, y toda página o
 * acción de /admin debe llamarla antes de leer o escribir nada.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  return session.user;
}
