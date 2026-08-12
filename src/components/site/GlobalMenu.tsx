'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { BlockView } from '@/components/canvas/BlockView';
import type { BlockData, TextStyleData } from '@/lib/content';
import { firstOfKind } from '@/lib/animation';

interface GlobalMenuProps {
  blocks: BlockData[];
  textStyles: TextStyleData[];
}

/**
 * Menú hamburguesa.
 *
 * En el diseño original el panel es un rectángulo de 1068 unidades que vive
 * fuera de cuadro y entra desplazándose. Eso funciona a la anchura para la que
 * se dibujó, pero en una pantalla grande deja los bordes sin cubrir y, cerrado,
 * los enlaces asoman por la derecha. Aquí el panel ocupa la ventana entera y se
 * retira un ancho completo de pantalla, de modo que el resultado es el mismo a
 * cualquier tamaño: el panel comparte color con el fondo de la página, así que
 * lo único que se ve moverse son los enlaces.
 *
 * Los enlaces se dibujan directamente en su posición de apertura (su
 * coordenada de diseño más el desplazamiento de la animación) y es el panel
 * quien se mueve, en lugar de animar cada bloque por separado.
 */
export function GlobalMenu({ blocks, textStyles }: GlobalMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const styleMap = useMemo(() => new Map(textStyles.map((s) => [s.key, s])), [textStyles]);

  // El panel y los enlaces son los bloques que la animación de clic desplaza;
  // los iconos son los que cambia de opacidad.
  const { panel, sliding, icons } = useMemo(() => {
    const sliding: BlockData[] = [];
    const icons: BlockData[] = [];
    let panel: BlockData | null = null;

    for (const block of blocks) {
      const step = firstOfKind(block.animations, 'CLICK')?.steps[0];
      if (step?.useMove) {
        if (block.kind === 'SHAPE' && !panel) panel = block;
        else sliding.push(block);
      } else if (step?.useOpacity) {
        icons.push(block);
      } else {
        sliding.push(block);
      }
    }
    return { panel, sliding, icons };
  }, [blocks]);

  const shift = useMemo(() => {
    const step = panel ? firstOfKind(panel.animations, 'CLICK')?.steps[0] : undefined;
    return step?.dx ?? -1062;
  }, [panel]);

  const easing = useMemo(() => {
    const step = panel ? firstOfKind(panel.animations, 'CLICK')?.steps[0] : undefined;
    // `ease-out-back` sobrepasa ligeramente el destino antes de asentarse: es
    // lo que da al panel su entrada con rebote.
    return step?.acceleration === 'ease-out-back'
      ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'cubic-bezier(0.45, 0, 0.55, 1)';
  }, [panel]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Bloquea el desplazamiento de la página mientras el menú está abierto.
  useEffect(() => {
    if (open) document.body.dataset.menuOpen = 'true';
    else delete document.body.dataset.menuOpen;
    return () => {
      delete document.body.dataset.menuOpen;
    };
  }, [open]);

  const layerStyle = {
    '--menu-fill': (panel?.shape?.fill ?? '#efefef') as string,
    '--menu-ease': easing,
    '--menu-duration': '0.6s',
  } as CSSProperties;

  return (
    <>
      <div className="rm-menu-layer" style={layerStyle}>
        <div
          className="rm-menu"
          data-open={open}
          id="site-menu"
          aria-hidden={!open}
          // Cerrado, el panel queda fuera de la ventana; `inert` lo retira
          // además del foco para que el tabulador no llegue a unos enlaces
          // invisibles.
          inert={!open}
        >
          <div className="rm-menu__backdrop" />
          {sliding.map((block) => (
            <BlockView
              key={block.id}
              block={shiftBlock(block, shift)}
              textStyles={styleMap}
              attrs={{ onClick: toggle }}
            />
          ))}
        </div>
      </div>

      <div className="rm-menu-icons" style={layerStyle}>
        {icons.map((block) => {
          const step = firstOfKind(block.animations, 'CLICK')?.steps[0];
          const from = (step?.fromOpacity ?? 100) / 100;
          const to = (step?.opacity ?? 100) / 100;
          const value = open ? to : from;
          const hidden = value === 0;

          return (
            <BlockView
              key={block.id}
              block={block}
              textStyles={styleMap}
              styleOverride={
                {
                  '--opacity': value,
                  cursor: 'pointer',
                  pointerEvents: hidden ? 'none' : undefined,
                  transition: 'opacity 0.45s ease',
                } as CSSProperties
              }
              attrs={{
                role: 'button',
                tabIndex: hidden ? -1 : 0,
                'aria-label': open ? 'Close menu' : 'Open menu',
                'aria-expanded': open,
                'aria-controls': 'site-menu',
                'aria-hidden': hidden || undefined,
                onClick: toggle,
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggle();
                  }
                },
              }}
            />
          );
        })}
      </div>
    </>
  );
}

/**
 * Coloca un bloque en su posición de apertura.
 *
 * El desplazamiento lo hace ahora el panel entero, así que los bloques de
 * dentro se dibujan ya desplazados en lugar de animarse uno a uno.
 */
function shiftBlock(block: BlockData, dx: number): BlockData {
  return {
    ...block,
    d: { ...block.d, x: block.d.x + dx },
    m: { ...block.m, x: block.m.x + dx },
  };
}
