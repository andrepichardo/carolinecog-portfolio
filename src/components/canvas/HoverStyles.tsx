import type { BlockData } from '@/lib/content';
import { firstOfKind } from '@/lib/animation';

/**
 * Animaciones de hover, sin JavaScript.
 *
 * En el original el elemento que se anima y el que recibe el ratón suelen ser
 * distintos: sobre cada imagen de proyecto hay un rectángulo transparente que
 * define el área sensible. Como los selectores necesitan los IDs concretos, se
 * emite una hoja de estilo por página con las reglas exactas, en vez de
 * cablear listeners en el cliente.
 */
export function HoverStyles({ blocks }: { blocks: BlockData[] }) {
  const rules: string[] = [];

  for (const block of blocks) {
    const hover = firstOfKind(block.animations, 'HOVER');
    const step = hover?.steps[0];
    if (!step) continue;

    const declarations: string[] = [];
    if (step.useOpacity) declarations.push(`opacity:${(step.opacity ?? 100) / 100}`);
    if (step.useScale) declarations.push(`scale:${(step.scale ?? 100) / 100}`);
    if (step.useMove) {
      declarations.push(
        `translate:calc(${step.dx ?? 0} * var(--u)) calc(${step.dy ?? 0} * var(--u))`
      );
    }
    if (!declarations.length) continue;

    const duration = step.duration ?? 0.2;
    const triggers = hover?.triggerBlockIds?.length ? hover.triggerBlockIds : [block.id];
    const target = `[data-hv-target="${cssEscape(block.id)}"]`;

    rules.push(`${target}{transition:opacity ${duration}s ease,scale ${duration}s ease,translate ${duration}s ease}`);

    for (const trigger of triggers) {
      rules.push(
        `.rm-canvas:has([data-hv-trigger="${cssEscape(trigger)}"]:hover) ${target}{${declarations.join(';')}}`
      );
    }
  }

  if (!rules.length) return null;
  return <style>{rules.join('\n')}</style>;
}

/** Los IDs son cuid() (alfanuméricos), pero se filtra por si acaso. */
function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}
