# Caroline Contreras — Portafolio

Reconstrucción del portafolio de Caroline Contreras (originalmente hecho en
Readymag) como aplicación propia, con un CMS para editar todo el contenido.

- **Sitio**: Next.js 16 (App Router) · React 19 · Tailwind CSS 4
- **Datos**: Prisma 7 · PostgreSQL (Neon)
- **Imágenes**: Vercel Blob
- **Acceso al CMS**: Auth.js 5 con usuario y contraseña

## Cómo está construido el sitio

El diseño original es un **lienzo de posición absoluta**: cada elemento tiene
coordenadas propias en dos viewports independientes, uno de 1024 unidades de
ancho (escritorio) y otro de 320 (móvil). No es un layout de flujo, así que
reproducirlo con secciones y grids habría cambiado la composición.

La reconstrucción conserva ese modelo. Toda la geometría se guarda en unidades
de diseño y una sola variable CSS (`--u` en `src/app/globals.css`) las convierte
a píxeles:

| Ancho de pantalla | Lienzo base | `--u` |
| --- | --- | --- |
| ≥ 1024 px | 1024 | `1px` (sin escalar, centrado) |
| 768 – 1023 px | 1024 | `100cqw / 1024` |
| < 768 px | 320 | `100cqw / 320` |

Son las mismas reglas que se midieron en el sitio original. El escalado es CSS
puro: no hay medición en JavaScript, así que no hay salto entre el HTML servido
y la hidratación.

Las páginas más cortas que la ventana se centran verticalmente, como en el
original.

### Fidelidad verificada

`_reference/` contiene el volcado del proyecto original (extraído del propio
visor de Readymag), los assets y capturas de referencia. La comparación se hizo
emparejando cada bloque con su widget original por id y midiendo su rectángulo:

- **Escritorio**: 123 bloques comparados, 0 diferencias por encima de 1 px.
- **Móvil**: 120 bloques comparados, coincidencia salvo el botón del menú
  (ver «Diferencias intencionadas»).
- **Animaciones**: el desplazamiento del wordmark al hacer scroll reproduce la
  curva medida (ease-in-out cuadrático sobre un recorrido de 169,4 px), y el
  menú y los hover coinciden con el original.

### Diferencias intencionadas

- **Botón del menú en móvil**: el original lo coloca en coordenadas sin escalar,
  de modo que solo queda bien alineado en pantallas de exactamente 320 px; en
  cualquier móvil actual aparece separado del borde. Aquí escala como el resto
  del lienzo. Si se prefiere replicar el comportamiento original, basta con
  quitar el escalado de ese bloque.
- **Tipografía**: ver más abajo.

## Tipografía

El original usa cuatro familias servidas por Adobe Fonts bajo la licencia de
Readymag. Ese kit está atado a esa cuenta y no funciona en otro dominio.

| Uso | Fuente original | Ahora | Fidelidad |
| --- | --- | --- | --- |
| Cuerpo y párrafos (126 usos) | DM Sans / 18 pt / 36 pt | **DM Sans** (Google Fonts) | exacta |
| Titulares y enlaces (30) | Aktiv Grotesk | Inter | muy cercana |
| Títulos serif (18) | Benton Modern Display Condensed | Instrument Serif | cercana |
| Acentos (2) | All Round Gothic | Poppins | cercana |

DM Sans es la familia dominante y es la original: se sirve en su versión
variable y el eje `opsz` reproduce los tres cortes ópticos que usa el diseño.

Ningún componente nombra una fuente concreta: todos usan `var(--font-*)`. Para
recuperar las tres familias de pago basta con crear un proyecto web en
[fonts.adobe.com](https://fonts.adobe.com) (requiere Creative Cloud) y definir
`NEXT_PUBLIC_ADOBE_FONTS_KIT` con el ID del kit.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # rellenar DATABASE_URL, AUTH_SECRET y ADMIN_PASSWORD
npx auth secret           # genera AUTH_SECRET
npm run db:push           # crea las tablas
npm run import:readymag   # importa el contenido original
npm run db:seed           # crea el usuario del CMS
npm run dev
```

El CMS queda en `/admin`.

### Sin base de datos remota

Para trabajar sin configurar Neon:

```bash
npm run db:local
```

Levanta un Postgres embebido (`prisma dev`), sincroniza el schema, importa el
contenido y crea el usuario. Escribe la `DATABASE_URL` en `.env`.

> Ese Postgres embebido solo acepta unas seis conexiones simultáneas y se
> degrada tras un uso intenso. Si aparece «Server has closed the connection» o
> «Connection terminated unexpectedly», vuelve a ejecutar `npm run db:local`.
>
> Si se cae con frecuencia, arráncalo en una terminal propia y déjalo abierto —
> en segundo plano no siempre sobrevive al proceso que lo lanzó:
>
> ```bash
> npx prisma dev --name carolinecog   # dejar corriendo
> npm run db:local                     # en otra terminal
> ```
>
> Nada de esto aplica con Neon.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila y prerenderiza las páginas públicas |
| `npm run typecheck` | Comprueba tipos |
| `npm run db:push` | Sincroniza el schema con la base de datos |
| `npm run db:studio` | Explorador de datos de Prisma |
| `npm run db:local` | Base de datos local de desarrollo (ver arriba) |
| `npm run import:readymag` | Reimporta el contenido desde `_reference/` |
| `npm run db:seed` | Crea o actualiza el usuario del CMS |
| `npm run assets:upload` | Migra las imágenes del CDN de Readymag a Vercel Blob |

## El CMS

En `/admin`:

- **Páginas** — editor visual de cada lienzo. La vista previa es el sitio real
  dentro de un iframe, así que lo que se ve es exactamente lo que se publica.
  Los bloques se arrastran, se redimensionan y se ajustan con las flechas
  (Mayús = 10 unidades). Escritorio y móvil se editan por separado. El panel de
  capas permite seleccionar bloques tapados por otros.
- **Proyectos** — ficha técnica (cliente, año, supervisión), orden y proyecto
  siguiente.
- **Imágenes** — biblioteca compartida, con subida a Vercel Blob y texto
  alternativo. No deja borrar una imagen que esté en uso.
- **Tipografía** — los estilos compartidos del proyecto. Cambiar uno afecta a
  todos los textos que lo usan.
- **Menú** — entradas del menú hamburguesa.
- **Ajustes** — título, descripción, favicon, imagen para redes, color de fondo,
  contacto y el kit de Adobe Fonts.

Las páginas públicas son estáticas; cada guardado revalida las rutas afectadas.

## Modelo de datos

- `Page` — una página, con el alto del lienzo en cada viewport y sus datos SEO.
- `Block` — un elemento del lienzo (`TEXT`, `IMAGE` o `SHAPE`) con geometría
  independiente para escritorio (`d*`) y móvil (`m*`), enlace y animaciones.
  Los de `scope: GLOBAL` se dibujan sobre todas las páginas: son el menú.
- `Project` — metadatos de las páginas de proyecto.
- `TextStyle` / `LinkStyle` — el sistema tipográfico, referenciado por los
  párrafos mediante una clave estable.
- `Asset` — la biblioteca de imágenes. Los SVG guardan además su markup para
  poder incrustarse en línea.
- `SiteSettings`, `NavItem`, `User`.

El importador reutiliza los identificadores de Readymag como IDs de página y de
bloque, así que se puede volver a ejecutar sin duplicar nada.

## Despliegue en Vercel

1. Crear una base en [Neon](https://console.neon.tech) y copiar las dos cadenas
   de conexión (la *pooled* y la directa).
2. Importar el repositorio en Vercel.
3. Variables de entorno del proyecto:
   - `DATABASE_URL` — cadena *pooled* de Neon
   - `DIRECT_URL` — cadena directa (la usan las migraciones)
   - `AUTH_SECRET` — `npx auth secret`
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`
   - `NEXT_PUBLIC_SITE_URL` — el dominio final
   - `NEXT_PUBLIC_ADOBE_FONTS_KIT` — opcional
4. Storage → Blob → conectar al proyecto (inyecta `BLOB_READ_WRITE_TOKEN`).
5. Desde local, apuntando `.env` a Neon:
   ```bash
   npm run db:push
   npm run import:readymag
   npm run db:seed
   npm run assets:upload
   ```
6. Desplegar.

Cuando ya no quede ninguna imagen apuntando a `rmcdn.net`, se pueden quitar esos
dominios de `images.remotePatterns` en `next.config.ts`.

## `_reference/`

Material extraído del portafolio original, que es la fuente del importador:

- `model/project.json` — el modelo completo del proyecto (páginas, widgets,
  estilos, animaciones).
- `model/REPORTE.txt` — el mismo contenido en texto legible.
- `assets/`, `shots/`, `snippets/`, `fonts/` — imágenes originales, capturas de
  referencia, HTML renderizado y los archivos de fuentes usados para
  identificarlas. No se versionan por tamaño (~49 MB); son necesarios solo para
  volver a importar desde cero.
