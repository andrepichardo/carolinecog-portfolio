import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Acceso al CMS.
 *
 * Sesión por JWT en lugar de sesión en base de datos: el portafolio tiene un
 * único usuario, así que no compensa una consulta extra por petición. El hash
 * de la contraseña vive en la tabla User y lo crea `yarn db:seed`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/admin/login' },
  logger: {
    error(error) {
      // Una cookie de sesión que no se puede descifrar no es un fallo de la
      // aplicación: pasa siempre que se rota AUTH_SECRET y el navegador
      // conserva la sesión anterior. Auth.js ya trata al visitante como no
      // autenticado, así que registrarlo como error solo genera ruido —y en
      // desarrollo lo muestra como si algo se hubiera roto.
      if (error.name === 'JWTSessionError') return;
      console.error('[auth]', error);
    },
    warn(code) {
      console.warn('[auth]', code);
    },
    debug() {},
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        // Se compara igualmente cuando el usuario no existe para que el tiempo
        // de respuesta no revele qué correos están dados de alta.
        const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!ok || !user) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
