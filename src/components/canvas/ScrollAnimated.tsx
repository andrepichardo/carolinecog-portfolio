'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { scrollFrameAt, scrollRangeFor } from '@/lib/animation';
import type { BlockAnimation } from '@/lib/content-types';

interface ScrollAnimatedProps {
  animation: BlockAnimation;
  children: ReactNode;
}

/**
 * Animación dirigida por el scroll.
 *
 * Escribe variables CSS en unidades de diseño (`--tx`, `--ty`) en lugar de
 * píxeles, para que la animación escale igual que el resto del lienzo: la
 * conversión a píxeles la hace `--u` en globals.css.
 *
 * Se hace en JavaScript y no con `animation-timeline: scroll()` porque el
 * original usa ease-in-out cuadrático, que no es una de las curvas nativas de
 * CSS, y porque así funciona en todos los navegadores sin fallback.
 */
export function ScrollAnimated({ animation, children }: ScrollAnimatedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = ref.current;
    const step = animation.steps[0];
    if (!el || !step) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const range = scrollRangeFor(step);

    const apply = () => {
      frame.current = 0;
      const progress = range > 0 ? window.scrollY / range : 0;
      const f = scrollFrameAt(step, progress);
      el.style.setProperty('--tx', String(f.translateX));
      el.style.setProperty('--ty', String(f.translateY));
      el.style.setProperty('--sc', String(f.scale));
      el.style.setProperty('--op', String(f.opacity));
      if (f.rotate) el.style.setProperty('--rot', `${f.rotate}deg`);
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [animation]);

  return (
    <div ref={ref} className="rm-anim">
      {children}
    </div>
  );
}
