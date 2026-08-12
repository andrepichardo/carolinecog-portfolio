/**
 * URL pública del sitio.
 *
 * Se usa para el sitemap, robots.txt y las etiquetas Open Graph, que necesitan
 * URLs absolutas. El orden de preferencia evita que un despliegue quede
 * publicando enlaces a localhost por olvidar una variable:
 *
 *   1. NEXT_PUBLIC_SITE_URL — el dominio definitivo, cuando lo haya.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — el dominio de producción que Vercel
 *      inyecta solo. Es estable entre despliegues, al contrario que VERCEL_URL,
 *      que cambia en cada uno y no sirve para un sitemap.
 *   3. localhost, solo en desarrollo.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}
