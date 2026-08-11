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
 * Reproduce la interacción del original, que es un panel del ancho de la
 * pantalla situado fuera de cuadro y que entra desplazándose. Los cuatro
 * elementos (panel, enlaces, icono de abrir e icono de cerrar) son bloques
 * normales con una animación de tipo `click`; aquí solo se decide el estado y
 * se aplican los valores que esa animación describe.
 *
 * El original no marca los iconos como botones: se añaden rol, foco, teclado y
 * cierre con Escape, que no cambian nada visual y hacen el menú usable sin ratón.
 */
export function GlobalMenu({ blocks, textStyles }: GlobalMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const styleMap = useMemo(() => new Map(textStyles.map((s) => [s.key, s])), [textStyles]);

  // Los disparadores declarados por las animaciones: los dos iconos y el propio
  // bloque de enlaces (al pulsar un enlace, el menú se cierra).
  const triggerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of blocks) {
      const click = firstOfKind(block.animations, 'CLICK');
      for (const id of click?.triggerBlockIds ?? []) ids.add(id);
    }
    return ids;
  }, [blocks]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Navegar cierra el panel.
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

  return (
    <div className="rm-fixed-layer" data-menu-open={open || undefined}>
      {blocks.map((block) => {
        const click = firstOfKind(block.animations, 'CLICK');
        const step = click?.steps[0];

        const style: CSSProperties = {};
        if (step) {
          if (step.useMove) {
            style['--bx' as never] = (open ? (step.dx ?? 0) : 0) as never;
            style['--by' as never] = (open ? (step.dy ?? 0) : 0) as never;
          }
          if (step.useOpacity) {
            const from = (step.fromOpacity ?? 100) / 100;
            const to = (step.opacity ?? 100) / 100;
            style['--opacity' as never] = (open ? to : from) as never;
          }
          // `ease-out-back` sobrepasa ligeramente el destino antes de asentarse:
          // es lo que da al panel su entrada con rebote.
          style['--anim-ease' as never] = (step.acceleration === 'ease-out-back'
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'cubic-bezier(0.45, 0, 0.55, 1)') as never;
        }

        const isTrigger = triggerIds.has(block.id);
        const isIcon = isTrigger && block.kind === 'IMAGE';

        const attrs: Record<string, unknown> = {};
        if (step) attrs['data-click-anim'] = '';
        if (isTrigger) {
          attrs.onClick = toggle;
          attrs.style = undefined; //  no pisar el style calculado
        }
        if (isIcon) {
          attrs.role = 'button';
          attrs.tabIndex = 0;
          attrs['aria-label'] = open ? 'Cerrar menú' : 'Abrir menú';
          attrs['aria-expanded'] = open;
          // El icono oculto no debe recibir foco ni clics.
          attrs['aria-hidden'] = isHidden(step, open) || undefined;
          attrs.onKeyDown = (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggle();
            }
          };
          if (isHidden(step, open)) {
            attrs.tabIndex = -1;
            style.pointerEvents = 'none';
          }
          style.cursor = 'pointer';
        }
        if (isTrigger) delete attrs.style;

        return (
          <BlockView
            key={block.id}
            block={block}
            textStyles={styleMap}
            styleOverride={style}
            attrs={attrs}
          />
        );
      })}
    </div>
  );
}

/** Un icono con animación de opacidad está oculto cuando su valor actual es 0. */
function isHidden(step: { useOpacity?: boolean; opacity?: number; fromOpacity?: number } | undefined, open: boolean) {
  if (!step?.useOpacity) return false;
  const value = open ? (step.opacity ?? 100) : (step.fromOpacity ?? 100);
  return value === 0;
}
