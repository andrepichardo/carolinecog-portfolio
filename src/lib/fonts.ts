import { DM_Sans, Inter, Instrument_Serif, Poppins } from 'next/font/google';

/**
 * Tipografía del portafolio.
 *
 * El original usa cuatro familias servidas por Adobe Fonts a través de la
 * licencia de Readymag. Ese kit está atado a su cuenta y no funciona en otro
 * dominio, así que aquí se sirven equivalentes libres:
 *
 *   token     original                          sustituto libre   fidelidad
 *   ────────  ────────────────────────────────  ────────────────  ─────────
 *   SANS      DM Sans / 18pt / 36pt             DM Sans           exacta
 *   GROTESK   Aktiv Grotesk                     Inter             muy cercana
 *   DISPLAY   Benton Modern Display Condensed   Instrument Serif  cercana
 *   ROUND     All Round Gothic                  Poppins           cercana
 *
 * DM Sans es la familia dominante (126 de los 176 usos) y es la misma fuente
 * que en el original: se sirve variable con el eje `opsz`, que reproduce las
 * tres versiones ópticas (DM Sans = 14, DM Sans 18pt = 18, DM Sans 36pt = 36).
 *
 * Para volver a las fuentes originales basta definir NEXT_PUBLIC_ADOBE_FONTS_KIT
 * con el ID del proyecto web de Caroline en fonts.adobe.com: `AdobeFonts` lo
 * carga y las variables CSS de globals.css apuntan a las familias reales.
 */

const dmSans = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-sans-local',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-grotesk-local',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-display-local',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-round-local',
});

export const fontVariables = [
  dmSans.variable,
  inter.variable,
  instrumentSerif.variable,
  poppins.variable,
].join(' ');

/** Familias originales, por si el kit de Adobe Fonts está configurado. */
export const ADOBE_FAMILIES = {
  SANS: 'dm-sans',
  GROTESK: 'aktiv-grotesk',
  DISPLAY: 'benton-modern-display-condensed',
  ROUND: 'all-round-gothic',
} as const;
