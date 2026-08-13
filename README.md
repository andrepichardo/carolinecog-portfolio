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

- **Escritorio**: 111 bloques comparados, 12 fuera de ±2 px — exactamente los
  dos elementos de cabecera de cada página, reposicionados a propósito. Todo el
  contenido coincide.
- **Móvil**: 108 bloques, 19 fuera de ±2 px: los 15 de cabecera (wordmark y
  botón del menú), más los 4 de la sección de formación y experiencia de
  `/about`. Todos están en «Diferencias intencionadas».
- **Animaciones**: el desplazamiento del wordmark al hacer scroll reproduce la
  curva medida (ease-in-out cuadrático sobre un recorrido de 169,4 px), y el
  menú y los hover coinciden con el original.

### El container

Todo el portafolio se compone dentro de una columna de ancho fijo, centrada:

| | Escritorio | Móvil |
| --- | --- | --- |
| Ancho | 1024 unidades | 320 |
| Margen lateral | 48 | 20 |
| Franja de cabecera | 72 de alto | 50 |

El wordmark y el botón del menú se anclan **al container y a la parte superior
de la ventana**, alineados entre sí en la franja de cabecera. En el original se
anclan al centro del viewport, con lo que su altura depende de lo alta que sea
la pantalla: medido sobre el sitio real, el logo de `/norologio` cae en y = −15
—fuera de cuadro— con una ventana de 700 px y en y = 235, encima del contenido,
con una de 1200. Aquí queda a 19 px sea cual sea la altura.

En la portada el wordmark sigue entrando grande y encogiendo con el scroll hasta
posarse exactamente en esa franja. En el resto de páginas ya nace ahí; la
animación se retira porque no aportaba nada y en `/contact` —que no llega a
desplazarse— dejaba el logo a media altura sobre el texto para siempre.

El editor del CMS dibuja estas guías sobre el lienzo (bordes, márgenes y eje
central, más la franja de cabecera sombreada), ofrece alineación a izquierda,
centro, derecha y ancho completo, y al arrastrar engancha a esas líneas.

### Diferencias intencionadas

- **Cabecera**: anclada al container y a la parte superior, en lugar de flotar
  con el centro de la ventana (ver arriba).
- **Menú**: el panel ocupa la ventana entera. El del original es un rectángulo
  de tamaño fijo que en pantallas anchas no llega a cubrirla y que, cerrado,
  deja asomar sus enlaces por el borde derecho.
- **`/about` en móvil**: el original trae dos fallos que solo se ven en la
  versión de teléfono y aquí están corregidos (`fixAboutMobile()` en el
  importador). Primero, los rótulos estaban cruzados: «Education» encabezaba los
  empleos y «Experience» los títulos, al revés que en escritorio. Segundo, había
  178 unidades en blanco entre el último párrafo y la primera sección, más del
  triple de la separación que la propia página usa entre secciones; todo lo que
  va debajo sube 118 unidades y el alto de la página móvil pasa de 1267 a 1149.
- **Botón del menú en móvil**: el original lo coloca en coordenadas sin escalar,
  de modo que solo queda bien alineado en pantallas de exactamente 320 px; en
  cualquier móvil actual aparece separado del borde. Aquí escala como el resto
  del lienzo.
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
yarn install
cp .env.example .env       # rellenar DATABASE_URL, AUTH_SECRET y ADMIN_PASSWORD
yarn db:push               # crea las tablas
yarn import:readymag       # importa el contenido original
yarn db:seed               # crea el usuario del CMS
yarn dev
```

Para generar `AUTH_SECRET` y una contraseña de administración:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

El CMS queda en `/admin`.

### Sin base de datos remota

Para trabajar sin configurar Neon:

```bash
yarn db:local
```

Levanta un Postgres embebido (`prisma dev`), sincroniza el schema, importa el
contenido y crea el usuario. Escribe la `DATABASE_URL` en `.env`.

> Ese Postgres embebido solo acepta unas seis conexiones simultáneas y se
> degrada tras un uso intenso. Si aparece «Server has closed the connection» o
> «Connection terminated unexpectedly», vuelve a ejecutar `yarn db:local`.
>
> Si se cae con frecuencia, arráncalo en una terminal propia y déjalo abierto —
> en segundo plano no siempre sobrevive al proceso que lo lanzó:
>
> ```bash
> yarn prisma dev --name carolinecog   # dejar corriendo
> yarn db:local                        # en otra terminal
> ```
>
> Nada de esto aplica con Neon.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `yarn dev` | Servidor de desarrollo |
| `yarn build` | Compila y prerenderiza las páginas públicas |
| `yarn typecheck` | Comprueba tipos |
| `yarn db:push` | Sincroniza el schema con la base de datos |
| `yarn db:studio` | Explorador de datos de Prisma |
| `yarn db:local` | Base de datos local de desarrollo (ver arriba) |
| `yarn import:readymag` | Reimporta el contenido desde `_reference/` |
| `yarn db:seed` | Crea o actualiza el usuario del CMS |
| `yarn assets:upload` | Migra a Vercel Blob las imágenes que sigan fuera |
| `yarn favicon` | Regenera `src/app/icon.svg` desde el wordmark |

## El CMS

En `/admin`:

- **Páginas** — editor visual de cada lienzo. La vista previa es el sitio real
  dentro de un iframe, así que lo que se ve es exactamente lo que se publica.
  Los bloques se arrastran, se redimensionan y se ajustan con las flechas
  (Mayús = 10 unidades). Escritorio y móvil se editan por separado. El panel de
  capas permite seleccionar bloques tapados por otros. Al arrastrar, los bloques
  **enganchan** a los márgenes y al eje del container —por su borde izquierdo,
  su centro o su derecho, el que quede más cerca— y la guía que atrapa se
  ilumina; con Alt se coloca libremente. `Ctrl+Z` deshace y `Ctrl+Mayús+Z`
  rehace: un arrastre entero cuenta como un solo paso, igual que una ráfaga de
  flechas sobre el mismo bloque. Todo lo que se toca en el panel lateral
  —tipografía, color, recorte, posición— **se ve al momento** en la vista
  previa; `Save block` guarda y `Discard` deshace lo tanteado.
- **Proyectos** — ficha técnica (cliente, año, supervisión) y proyecto
  siguiente. El orden se cambia arrastrando la lista de arriba, o con las
  flechas; se guarda la secuencia entera, así que no hay forma de dejar dos
  proyectos en la misma posición.
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

La base de datos y el almacenamiento **ya están aprovisionados**: Neon tiene el
schema y el contenido, y las 40 imágenes están en un store público de Vercel
Blob (`carolinecog-portfolio-blob`, región `iad1`). Ya no queda nada apuntando
al CDN de Readymag.

Para desplegar:

1. Importar el repositorio en [vercel.com/new](https://vercel.com/new).
2. Añadir las variables de entorno del proyecto (las mismas del `.env` local):
   - `DATABASE_URL` — cadena *pooled* de Neon
   - `DIRECT_URL` — cadena directa, sin `-pooler` (la usan las migraciones)
   - `AUTH_SECRET`
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`
   - `NEXT_PUBLIC_SITE_URL` — **solo si hay dominio propio**. Sin ella se usa
     el dominio de producción que Vercel inyecta, así que el sitemap y las
     etiquetas Open Graph salen correctos igualmente (ver `src/lib/site-url.ts`).
     Ojo: son valores que se resuelven **en tiempo de compilación**, así que
     añadirla obliga a redesplegar
   - `NEXT_PUBLIC_ADOBE_FONTS_KIT` — opcional
3. `BLOB_READ_WRITE_TOKEN` y `BLOB_STORE_ID` los inyecta Vercel al tener el
   store conectado; no hay que añadirlos a mano.
4. Desplegar.

### Si hubiera que rehacer la base desde cero

Con `.env` apuntando a Neon:

```bash
yarn db:push               # schema
yarn import:readymag       # contenido desde _reference/
yarn db:seed               # usuario del CMS
yarn assets:upload         # imágenes a Blob (solo las que sigan fuera)
```

`assets:upload` es incremental: solo toca los assets que aún no tienen
`pathname`, así que volver a ejecutarlo no duplica nada.

## `_reference/`

Material extraído del portafolio original, que es la fuente del importador:

- `model/project.json` — el modelo completo del proyecto (páginas, widgets,
  estilos, animaciones).
- `model/REPORTE.txt` — el mismo contenido en texto legible.
- `assets/`, `shots/`, `snippets/`, `fonts/` — imágenes originales, capturas de
  referencia, HTML renderizado y los archivos de fuentes usados para
  identificarlas. No se versionan por tamaño (~49 MB); son necesarios solo para
  volver a importar desde cero.
