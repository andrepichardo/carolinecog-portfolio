import type { AnimationStep, BlockAnimation } from '@/lib/content-types';

/**
 * Aceleración `ease-both` de Readymag.
 *
 * Medida sobre el sitio original muestreando el `offsetDistance` del wordmark
 * cada 10px de scroll: la curva resultó ser ease-in-out cuadrático exacto
 * (p = 2t² en la primera mitad, p = 1 - 2(1-t)² en la segunda), no la cúbica
 * que usa CSS por defecto.
 */
export function easeInOutQuad(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}

export function easeOutBack(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easingFor(name: string | undefined): (t: number) => number {
  switch (name) {
    case 'ease-out-back':
      return easeOutBack;
    case 'linear':
      return (t) => Math.min(Math.max(t, 0), 1);
    default:
      return easeInOutQuad;
  }
}

/**
 * Longitud de scroll durante la que corre una animación de scroll.
 *
 * En el original coincide con la longitud del recorrido dividida por `speed`:
 * con speed 1, un píxel de scroll avanza un píxel de trayecto. Se verificó que
 * el rango no depende de la altura del viewport (169,5px con viewports de 600,
 * 900 y 1200px).
 */
export function scrollRangeFor(step: AnimationStep): number {
  const dx = step.dx ?? 0;
  const dy = step.dy ?? 0;
  const pathLength = Math.hypot(dx, dy);
  const speed = step.speed && step.speed > 0 ? step.speed : 1;
  // Sin desplazamiento no hay trayecto del que derivar el rango: se usa un
  // valor razonable para que las animaciones de solo escala/opacidad funcionen.
  return (pathLength > 0 ? pathLength : 400) / speed;
}

export interface ScrollFrame {
  translateX: number; //  en unidades de diseño
  translateY: number;
  scale: number;
  opacity: number;
  rotate: number;
}

/** Estado de una animación de scroll en un punto dado del recorrido. */
export function scrollFrameAt(step: AnimationStep, progress: number): ScrollFrame {
  const ease = easingFor(step.acceleration);
  const p = ease(progress);

  const fromScale = (step.fromScale ?? 100) / 100;
  const toScale = (step.scale ?? 100) / 100;
  const fromOpacity = (step.fromOpacity ?? 100) / 100;
  const toOpacity = (step.opacity ?? 100) / 100;

  return {
    translateX: step.useMove === false ? 0 : (step.dx ?? 0) * p,
    translateY: step.useMove === false ? 0 : (step.dy ?? 0) * p,
    scale: step.useScale ? fromScale + (toScale - fromScale) * p : 1,
    opacity: step.useOpacity ? fromOpacity + (toOpacity - fromOpacity) * p : 1,
    rotate: step.useRotate ? (step.rotate ?? 0) * p : 0,
  };
}

export function firstOfKind(
  animations: BlockAnimation[],
  kind: BlockAnimation['kind']
): BlockAnimation | undefined {
  return animations.find((a) => a.kind === kind);
}
