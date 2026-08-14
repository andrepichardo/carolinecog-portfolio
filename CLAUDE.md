@AGENTS.md

# Portafolio de Caroline Contreras

Reconstrucción de un portafolio hecho originalmente en Readymag, más un CMS para
editarlo entero. Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 ·
Prisma 7 · PostgreSQL en Neon · imágenes en Vercel Blob · Auth.js 5.

El README documenta el producto y la puesta en marcha. Este archivo recoge lo
que **no** se deduce leyendo el código.

## El sitio es un lienzo, no un layout de flujo

Cada elemento tiene coordenadas absolutas en dos viewports independientes: uno
de 1024 unidades de ancho (escritorio) y otro de 320 (móvil). No hay secciones
ni grids. Reescribirlo como layout de flujo cambiaría la composición: no se
hace.

Toda la geometría se guarda en unidades de diseño y una sola variable CSS
—`--u`, registrada con `@property` en [globals.css](src/app/globals.css)— las
convierte a píxeles. El escalado es **CSS puro**: nada de medir en JavaScript,
así que no hay salto entre el HTML servido y la hidratación. Si algo tienta a
resolverse con un `useEffect` que mida el ancho, casi siempre hay una forma con
`cqw` o con `--u`.

Las páginas más cortas que la ventana se centran verticalmente, como el
original. No es un bug.

## El importador es la fuente de verdad

[`_reference/model/project.json`](_reference/model/) es el volcado del proyecto
original y [`scripts/import-readymag.ts`](scripts/import-readymag.ts) lo
traduce al schema. Reutiliza los identificadores de Readymag como IDs de página
y de bloque, así que **es idempotente**: volver a ejecutarlo actualiza, no
duplica.

Consecuencia práctica: cualquier corrección de contenido o de posición que deba
sobrevivir a un reimport va **dentro del importador**, no editada a mano en la
base. Ya hay dos funciones así, y son el patrón a seguir:

- `layoutChrome()` — ancla el wordmark y el botón del menú al container.
- `fixAboutMobile()` — arregla los dos fallos de `/about` en móvil.

Al añadir una, comprobar que sigue siendo idempotente ejecutando el import dos
veces seguidas y comparando. Ojo con las operaciones relativas (`valor - N`):
solo son seguras si el upsert previo restablece el valor desde el modelo.

`_reference/assets|shots|snippets|fonts` no se versiona (~49 MB). Las capturas
`full-mobile-*.png` **no sirven como referencia móvil**: se tomaron a 390 px de
ancho pero el original sirvió el layout de escritorio recortado. Para móvil, la
verdad es `viewport_phone_portrait` dentro del modelo.

## Trampas ya pagadas

Cada una costó una sesión de depuración. No volver a caer:

- **Prisma 7** no acepta `url` en el schema: va en `prisma.config.ts`, y exige
  un driver adapter (`PrismaNeon`).
- **Next 16** renombró Middleware a **Proxy**: [`src/proxy.ts`](src/proxy.ts)
  con un export llamado `proxy`.
- **`position: fixed` crea un contexto de apilamiento** con `z-index` auto = 0.
  Por eso los bloques del lienzo (z 302–376) tapaban el logo.
- **Todos los bloques de una página se pintan en el mismo contexto aislado**
  ([`Canvas.tsx`](src/components/canvas/Canvas.tsx)), fijos y no fijos juntos.
  Separarlos en capas rompe el orden interno: el texto de la portada también es
  fijo (z 301) y tiene que quedar **debajo** de las imágenes de proyecto.
- **Especificidad CSS**: `.rm-image img` (0,1,1) gana a `.rm-only-mobile`
  (0,1,0). Cualquier regla `.rm-only-*` necesita ir cualificada.
- **Orden de las media queries**: la que desactiva la animación en móvil tiene
  que ir *después* de la regla base `.rm-anim`, no antes.
- **React ejecuta los updaters durante el render**, no al llamarlos. Leer el
  resultado de `setBlocks(prev => …)` da null en los frames agrupados; por eso
  [`PageEditor.tsx`](src/components/admin/PageEditor.tsx) mantiene `blocksRef`
  como espejo síncrono.
- **Los listeners de arrastre viven en `window`**, no en el bloque: el bloque se
  vuelve a renderizar y se mueve bajo el cursor, y pierde los eventos.
- **Saltos de párrafo**: Readymag los guarda como `\r\r\n` (salto blando + salto
  real = línea en blanco). El parser de HTML funde CR y CRLF en un solo LF, así
  que hay que normalizar en la conversión —`normalizeBreaks()` en
  [`convert.ts`](scripts/readymag/convert.ts)— **reajustando los offsets** de
  los rangos de formato, que vienen en coordenadas del texto original.
- **Escala de recorte de imágenes**: el valor guardado para móvil es en realidad
  el de escritorio. `convertImage` la deriva (`ancho del bloque / ancho del
  recorte`) en vez de fiarse.
- **Un bloque puede existir en un solo viewport.** Los que solo aparecen en
  móvil traen el widget de escritorio vacío y *todo* —recorte, dimensiones del
  original, imagen— cuelga de `viewport_phone_portrait`. Dos sitios daban por
  hecho que siempre hay versión de escritorio: `convertImage` leía `originalW/H`
  únicamente del widget (y sin ellas descartaba el recorte entero) y `ImageView`
  decidía la clase `rm-image--cropped` mirando solo el contenido de escritorio.
  El síntoma es silencioso y fácil de confundir con un problema de maquetación:
  la imagen se dibuja completa dentro de su caja, encogida y rodeada de vacío.
- **El iframe del editor no se entera de los cambios en servidor.** Al borrar un
  bloque el elemento seguía dibujado hasta recargar. Un borrado se resuelve
  quitando el nodo a mano (`removeFromPreview`); lo que se crea o se duplica no
  se puede fabricar, así que ahí toca recargar el iframe subiendo `previewKey`.
- **La vista previa se pinta a mano, no re-renderizando.** El inspector escribe
  sus cambios directamente sobre el iframe (`live-preview.ts`), porque todo lo
  que edita se dibuja con variables CSS. Dos trampas: hay que guardar el `style`
  original de cada nodo y **partir de él en cada pasada**, o vaciar un campo
  —que significa «hereda del estilo del proyecto», y el editor no conoce esos
  estilos— dejaría en pantalla el último valor tecleado; y las funciones de
  reponer tienen que ejecutarse **aunque el contenido sea nulo**, porque el
  inspector convierte `image`/`shape` de null a objeto al editarlos y al
  descartar volvían a null, saltándose la rama que lo limpiaba.
- **`loading="eager"`, no `priority`, para el LCP.** Escritorio y móvil son dos
  maquetaciones sobre el mismo DOM y su imagen mayor **no es la misma**; un
  `<link rel=preload>` no entiende de media queries. Se marca una por viewport
  (`eagerImages` en Canvas.tsx) ordenando por **área visible**, no total: en la
  portada móvil hay una imagen más grande que asoma doce unidades por el pliegue
  y ganaba sin ser la que pinta. Next precarga igualmente toda imagen no
  diferida, así que en `/about` y `/norologio` se descarga de más la variante del
  viewport contrario: es el precio de no diferir el LCP en ninguno de los dos.
- **El original sube un archivo por cada colocación**, así que hay parejas de
  ficheros con nombre distinto y contenido idéntico —la foto de `/about` está
  dos veces, una por viewport, y cada proyecto repite alguna—. El importador las
  agrupa por sha256 del archivo local y deja una sola (`idByHash` en
  `registerAsset`): 40 assets pasaron a 30 y 10,8 MB de Blob se liberaron.
- **Las tres páginas de proyecto apilan dos imágenes en el mismo sitio** en
  escritorio (524×339 debajo, 524×352 encima, misma x/y): la de abajo queda
  tapada por completo. **No son bloques que sobren**: en móvil van a alturas
  distintas y ahí sí se ven las dos, con fotos distintas. Está así en el
  original. Lo que se hace es ocultarlas solo en escritorio
  (`hideBuriedBlocks()`), que ahorra tres descargas grandes sin cambiar nada:
  comprobado capturando las tres páginas antes y después, 0 subpíxeles de
  diferencia sobre 40 millones. Por eso la fidelidad de escritorio empareja 108
  bloques y no 111.
- **El importador verifica su salida.** El contador de bloques cuenta llamadas
  al upsert, no filas: una imagen de `/norologio` estuvo ausente varias
  importaciones seguidas mientras el resumen decía que estaban todas. Ahora
  compara con la base y lanza un error. Si aparece, no silenciarlo.
- **Tipografía móvil**: `viewport_phone_portrait.styles` trae los tamaños de
  móvil aunque no traiga `blocks`. Y si todos los tramos comparten formato, hay
  que subirlo al párrafo (`hoistUniformRuns`) o el tamaño se queda en el del
  tramo.
- **Enlaces del menú**: la página destino está en `entityMap.data.pageId`, no en
  `url` (que guarda el uri interno de Readymag).

## Desviaciones deliberadas del original

Están todas listadas en el README, sección «Diferencias intencionadas». **No
son bugs**: si una verificación las marca, es que la verificación mide bien.
Resumen:

| Qué | Por qué |
| --- | --- |
| Cabecera anclada al container y arriba | El original la ancla al centro de la ventana: el logo caía en y=−15 con 700 px de alto y en y=235 —sobre el contenido— con 1200 |
| Menú a pantalla completa | El del original es un rectángulo fijo que no cubre pantallas anchas y deja asomar sus enlaces cerrado |
| Botón del menú escalado en móvil | El original lo posiciona sin escalar: solo cuadra a exactamente 320 px |
| `/about` móvil: rótulos y hueco | El original cruza «Education»/«Experience» y deja 178 unidades vacías |
| Tres tipografías sustituidas | El kit de Adobe Fonts está atado a la cuenta de Readymag |

## Verificación

El método de este proyecto es **medir, no mirar**. Casi todo lo que parecía un
juicio estético resultó ser un número exacto en el original (el easing del
scroll, los breakpoints de escala, el centrado vertical). Ante una duda de
fidelidad: medir el original primero.

Las comprobaciones se hacen con Playwright contra `http://localhost:3100`
(`yarn dev --port 3100`). Cubren fidelidad bloque a bloque emparejando por id,
el menú en 7 anchos × 6 páginas, la cabecera en 7 tamaños, el editor del CMS y
el arrastre.

Dos avisos, por experiencia:

1. **Comprobar siempre contra localhost, no contra el dominio de Vercel.** Un
   script apuntaba a producción y estuvo dando por buenos unos cambios que ni
   siquiera estaban desplegados.
2. **Los falsos positivos son frecuentes** y hay que descartarlos midiendo más
   fino, no relajando el umbral. Ejemplo real: un test daba colisión entre el
   logo y un título de `/contact`; el título empieza con una línea vacía, así
   que su caja arranca en y=37 pero su primera letra está en 96. Comparando
   tinta en vez de cajas, 35 px de aire.
3. **Y los cambios de cuenta tampoco son ruido.** El total de bloques
   emparejados bajó de 111 a 110 y parecía una fluctuación de red; era una
   imagen que faltaba de verdad. Ante una diferencia de uno, comparar los
   conjuntos de ids en lugar de suponer.

Para medir separaciones tal y como se perciben, comparar **tinta**: recorrer el
render fila a fila y anotar los tramos sin píxeles. Las cajas de los bloques
mienten —una imagen sin recorte deja aire dentro de su propia caja.

Antes de dar algo por terminado: `yarn typecheck` y `yarn build`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `yarn dev` | Servidor de desarrollo |
| `yarn build` | Compila y prerenderiza las páginas públicas |
| `yarn typecheck` | Comprueba tipos |
| `yarn db:push` | Sincroniza el schema |
| `yarn import:readymag` | Reimporta el contenido desde `_reference/` |
| `yarn db:seed` | Crea o actualiza el usuario del CMS |
| `yarn assets:upload` | Sube a Blob las imágenes que sigan fuera (incremental) |
| `yarn favicon` | Regenera `src/app/icon.svg` desde el wordmark |

`yarn lint` está roto: ejecuta `next lint`, que Next 16 eliminó, y no hay
configuración de ESLint en el repo.

Solo un `next dev` puede correr a la vez por directorio. Si se queda uno
colgado, el segundo falla con «Another next dev server is already running» e
indica el PID. Y no lanzarlo con `| head`: el SIGPIPE lo mata en cuanto llena
el buffer.

## Convenciones

- **Comentarios en español**, y explicando el *porqué* —sobre todo cuando el
  código parece raro pero responde a una restricción real—. Los de
  `src/components/admin/` quedaron en inglés por descuido; conviene unificarlos.
- **La interfaz del CMS va íntegramente en inglés.** Es un requisito explícito.
- El CMS debe sentirse parte del portafolio, con su mismo lenguaje visual.
- Ningún componente nombra una fuente concreta: siempre `var(--font-*)`.
- Las páginas públicas son estáticas; cada guardado revalida sus rutas.

## Entorno y despliegue

Neon y Vercel Blob ya están aprovisionados y no queda nada apuntando al CDN de
Readymag. Las variables van en `.env` (ignorado por git) y en el proyecto de
Vercel: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD` y, opcionales, `NEXT_PUBLIC_SITE_URL` y
`NEXT_PUBLIC_ADOBE_FONTS_KIT`. Las de Blob las inyecta Vercel. **Nunca copiar
credenciales a un archivo versionado, este incluido.**

`NEXT_PUBLIC_SITE_URL` solo hace falta con dominio propio; sin ella se usa el
dominio de producción que inyecta Vercel (ver `src/lib/site-url.ts`). Se
resuelve en tiempo de compilación: añadirla obliga a redesplegar.

El push lo hace el usuario. No hacer commit ni push sin que lo pida.
