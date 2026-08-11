import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protege el CMS.
 *
 * (En Next.js 16 esto es el Proxy; en versiones anteriores se llamaba Middleware.)
 *
 * Aquí solo se comprueba que exista la cookie de sesión: validar el JWT en este
 * punto obligaría a arrastrar la configuración de Auth.js —y Prisma— al runtime
 * edge. La verificación real la hace cada página de /admin con `requireUser()`,
 * que corre en Node. Esta comprobación optimista evita ver el panel un instante
 * antes de que la redirección ocurra.
 */
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login') return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
