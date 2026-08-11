'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/auth';

export async function signInAction(formData: FormData) {
  const next = String(formData.get('next') ?? '/admin');
  const target = next.startsWith('/admin') ? next : '/admin';

  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'No se pudo iniciar sesión. Revisa el correo y la contraseña.' };
    }
    throw error;
  }

  // `redirect` lanza internamente, así que va fuera del try para no
  // confundirse con un fallo de autenticación.
  redirect(target);
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect('/admin/login');
}
