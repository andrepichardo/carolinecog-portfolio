'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  createBlock,
  deleteBlock,
  duplicateBlock,
  updateBlockGeometry,
  updatePage,
} from '@/lib/actions/content';
import { BlockInspector, type EditorAsset, type EditorBlock } from './BlockInspector';

export interface EditorPage {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  heightDesktop: number;
  heightMobile: number;
  backgroundColor: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

type Viewport = 'desktop' | 'mobile';

/** Anchos con los que se renderiza la vista previa en cada viewport. */
const FRAME_WIDTH: Record<Viewport, number> = { desktop: 1024, mobile: 390 };
/** Unidades de diseño del lienzo en cada viewport. */
const DESIGN_WIDTH: Record<Viewport, number> = { desktop: 1024, mobile: 320 };

/** Etiqueta legible para un bloque sin nombre propio. */
function describe(block: EditorBlock): string {
  if (block.kind === 'TEXT') {
    const paragraphs = (block.text as { paragraphs?: { text: string }[] } | null)?.paragraphs;
    const first = paragraphs?.find((p) => p.text.trim())?.text.trim();
    if (first) return first.length > 42 ? `${first.slice(0, 42)}…` : first;
    return 'Texto vacío';
  }
  if (block.kind === 'IMAGE') return 'Imagen';
  const shape = block.shape as { kind?: string } | null;
  return shape?.kind === 'LINE' ? 'Línea' : 'Forma';
}

export function PageEditor({
  page,
  blocks: initialBlocks,
  assets,
  pages,
  textStyles,
}: {
  page: EditorPage;
  blocks: EditorBlock[];
  assets: EditorAsset[];
  pages: { id: string; title: string; slug: string }[];
  textStyles: { key: string; label: string }[];
}) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [previewKey, setPreviewKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);

  useEffect(() => setBlocks(initialBlocks), [initialBlocks]);

  // El lienzo se dibuja a tamaño real y se escala con CSS: así las coordenadas
  // que se guardan siguen siendo unidades de diseño, sin conversiones.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(el);
    setStageWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const frameWidth = FRAME_WIDTH[viewport];
  const designWidth = DESIGN_WIDTH[viewport];
  const designHeight = viewport === 'desktop' ? page.heightDesktop : page.heightMobile;
  // Píxeles del iframe por unidad de diseño (lo mismo que `--u` en el sitio).
  const unit = frameWidth / designWidth;
  const frameHeight = Math.round(designHeight * unit);
  const zoom = stageWidth > 0 ? Math.min(1, stageWidth / frameWidth) : 1;

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const geometryOf = useCallback(
    (block: EditorBlock) =>
      viewport === 'desktop'
        ? { x: block.dX ?? 0, y: block.dY ?? 0, w: block.dW ?? 0, h: block.dH ?? 0, hidden: block.dHidden, fixed: block.dFixed }
        : {
            x: block.mX ?? block.dX ?? 0,
            y: block.mY ?? block.dY ?? 0,
            w: block.mW ?? block.dW ?? 0,
            h: block.mH ?? block.dH ?? 0,
            hidden: block.mHidden,
            fixed: block.mFixed,
          },
    [viewport]
  );

  const patchGeometry = useCallback(
    (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const round = (n: number) => Math.round(n * 100) / 100;
          return viewport === 'desktop'
            ? {
                ...b,
                dX: patch.x !== undefined ? round(patch.x) : b.dX,
                dY: patch.y !== undefined ? round(patch.y) : b.dY,
                dW: patch.w !== undefined ? round(Math.max(4, patch.w)) : b.dW,
                dH: patch.h !== undefined ? round(Math.max(4, patch.h)) : b.dH,
              }
            : {
                ...b,
                mX: patch.x !== undefined ? round(patch.x) : b.mX,
                mY: patch.y !== undefined ? round(patch.y) : b.mY,
                mW: patch.w !== undefined ? round(Math.max(4, patch.w)) : b.mW,
                mH: patch.h !== undefined ? round(Math.max(4, patch.h)) : b.mH,
              };
        })
      );
      setDirty((prev) => new Set(prev).add(id));
    },
    [viewport]
  );

  // --- arrastrar y redimensionar -------------------------------------------
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const onPointerDown = (
    event: React.PointerEvent,
    block: EditorBlock,
    mode: 'move' | 'resize'
  ) => {
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    setSelectedId(block.id);
    const g = geometryOf(block);
    dragRef.current = {
      id: block.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: g.x, y: g.y, w: g.w, h: g.h },
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    // De píxeles de pantalla a unidades de diseño: hay que deshacer el zoom del
    // editor y la escala del propio viewport.
    const dx = (event.clientX - drag.startX) / (zoom * unit);
    const dy = (event.clientY - drag.startY) / (zoom * unit);
    const step = event.shiftKey ? 10 : 1;
    const snap = (n: number) => Math.round(n / step) * step;

    if (drag.mode === 'move') {
      patchGeometry(drag.id, { x: snap(drag.origin.x + dx), y: snap(drag.origin.y + dy) });
    } else {
      patchGeometry(drag.id, { w: snap(drag.origin.w + dx), h: snap(drag.origin.h + dy) });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Flechas para ajustar al píxel sin ratón.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      const step = event.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = deltas[event.key];
      if (!delta) return;
      event.preventDefault();
      const block = blocks.find((b) => b.id === selectedId);
      if (!block) return;
      const g = geometryOf(block);
      patchGeometry(selectedId, { x: g.x + delta[0], y: g.y + delta[1] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, blocks, geometryOf, patchGeometry]);

  // --- guardado -------------------------------------------------------------
  const saveGeometry = () => {
    const updates = blocks
      .filter((b) => dirty.has(b.id))
      .map((b) => ({
        id: b.id,
        geometry: {
          dX: b.dX,
          dY: b.dY,
          dW: b.dW,
          dH: b.dH,
          mX: b.mX,
          mY: b.mY,
          mW: b.mW,
          mH: b.mH,
        },
      }));
    if (!updates.length) return;
    startTransition(async () => {
      const result = await updateBlockGeometry(updates);
      if (result.ok) {
        setDirty(new Set());
        setMessage('Posiciones guardadas');
        setPreviewKey((k) => k + 1);
      } else {
        setMessage(result.error);
      }
    });
  };

  const refreshPreview = () => setPreviewKey((k) => k + 1);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const previewSrc = useMemo(
    () => `${page.slug === '' ? '/' : `/${page.slug}`}?editor=${previewKey}`,
    [page.slug, previewKey]
  );

  return (
    <div className="flex flex-col gap-3 xl:flex-row">
      <div className="min-w-0 flex-1">
        {/* Barra de herramientas */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[var(--admin-border)]">
            {(['desktop', 'mobile'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                aria-pressed={viewport === v}
                className={`px-3 py-1.5 ${
                  viewport === v ? 'bg-[var(--admin-accent)] text-white' : 'bg-[var(--admin-bg)]'
                }`}
              >
                {v === 'desktop' ? 'Escritorio' : 'Móvil'}
              </button>
            ))}
          </div>

          <span className="text-[12px] text-[var(--admin-muted)]">
            {designWidth} × {designHeight} · zoom {Math.round(zoom * 100)}%
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {(['TEXT', 'IMAGE', 'SHAPE'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className="admin-btn"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await createBlock(page.id, kind);
                    setMessage(result.ok ? 'Bloque añadido' : result.error);
                    if (result.ok) window.location.reload();
                  })
                }
              >
                + {kind === 'TEXT' ? 'Texto' : kind === 'IMAGE' ? 'Imagen' : 'Forma'}
              </button>
            ))}
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={saveGeometry}
              disabled={pending || dirty.size === 0}
            >
              {dirty.size ? `Guardar ${dirty.size} cambio(s)` : 'Sin cambios'}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mb-3 rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-[13px]">{message}</p>
        ) : null}

        {/* Lienzo: iframe del sitio real + capa de manipulación encima */}
        <div ref={stageRef} className="overflow-auto rounded-xl border border-[var(--admin-border)] p-3">
          <div
            style={{
              width: frameWidth * zoom,
              height: frameHeight * zoom,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: frameWidth,
                height: frameHeight,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'relative',
              }}
            >
              <iframe
                key={previewKey}
                src={previewSrc}
                title="Vista previa"
                width={frameWidth}
                height={frameHeight}
                scrolling="no"
                className="pointer-events-none block border-0"
              />

              <div className="absolute inset-0" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                {blocks.map((block) => {
                  const g = geometryOf(block);
                  if (g.hidden) return null;
                  // Los bloques anclados al viewport no viven en el flujo del
                  // lienzo: se marcan pero no se pueden arrastrar aquí.
                  const pinned = Boolean(g.fixed);
                  return (
                    <div
                      key={block.id}
                      className="editor-block"
                      data-selected={selectedId === block.id}
                      style={{
                        left: g.x * unit,
                        top: g.y * unit,
                        width: g.w * unit,
                        height: g.h * unit,
                        cursor: pinned ? 'not-allowed' : 'move',
                        opacity: pinned ? 0.6 : 1,
                      }}
                      onPointerDown={(e) => (pinned ? setSelectedId(block.id) : onPointerDown(e, block, 'move'))}
                    >
                      {selectedId === block.id ? (
                        <>
                          <span className="editor-block__label">
                            {block.name || block.kind}
                            {pinned ? ' · fijo' : ''}
                          </span>
                          {!pinned ? (
                            <span
                              className="editor-handle"
                              onPointerDown={(e) => onPointerDown(e, block, 'resize')}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
          Arrastra para mover, la esquina para redimensionar y las flechas para ajustar al píxel
          (Mayús = 10). Los cambios de posición se guardan con el botón; el resto, desde el panel
          lateral.
        </p>

        {/* Lista de capas: en el lienzo hay bloques que quedan tapados por
            otros (rectángulos invisibles, imágenes superpuestas) y desde aquí
            se pueden seleccionar igualmente. */}
        <details className="admin-card mt-3">
          <summary className="cursor-pointer font-semibold">Capas ({blocks.length})</summary>
          <ul className="mt-2 flex flex-col gap-0.5">
            {[...blocks]
              .sort((a, b) => b.z - a.z)
              .map((block) => {
                const g = geometryOf(block);
                return (
                  <li key={block.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(block.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] ${
                        selectedId === block.id
                          ? 'bg-[var(--admin-accent)] text-white'
                          : 'hover:bg-[var(--admin-surface)]'
                      }`}
                    >
                      <span className="w-14 shrink-0 opacity-70">{block.kind}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {block.name || describe(block)}
                      </span>
                      <span className="shrink-0 opacity-60">z{block.z}</span>
                      {g.hidden ? <span className="shrink-0 opacity-60">oculto</span> : null}
                      {g.fixed ? <span className="shrink-0 opacity-60">fijo</span> : null}
                    </button>
                  </li>
                );
              })}
          </ul>
        </details>
      </div>

      {/* Inspector */}
      <div className="w-full shrink-0 xl:w-[360px]">
        <BlockInspector
          key={selected?.id ?? 'none'}
          block={selected}
          viewport={viewport}
          assets={assets}
          pages={pages}
          textStyles={textStyles}
          page={page}
          onSaved={refreshPreview}
          onDelete={() =>
            selected &&
            startTransition(async () => {
              const result = await deleteBlock(selected.id);
              setMessage(result.ok ? 'Bloque eliminado' : result.error);
              if (result.ok) window.location.reload();
            })
          }
          onDuplicate={() =>
            selected &&
            startTransition(async () => {
              const result = await duplicateBlock(selected.id);
              setMessage(result.ok ? 'Bloque duplicado' : result.error);
              if (result.ok) window.location.reload();
            })
          }
          onPageSaved={(next) =>
            startTransition(async () => {
              const result = await updatePage({ ...page, ...next });
              setMessage(result.ok ? 'Página guardada' : result.error);
              if (result.ok) refreshPreview();
            })
          }
        />
      </div>
    </div>
  );
}
