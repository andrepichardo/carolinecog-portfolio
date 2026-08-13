'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  createBlock,
  deleteBlock,
  duplicateBlock,
  updateBlockGeometry,
  updatePage,
} from '@/lib/actions/content';
import {
  BlockInspector,
  type EditorAsset,
  type EditorBlock,
} from './BlockInspector';
import { applyBlockToPreview } from './live-preview';

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

/** Width the preview iframe is rendered at, per viewport. */
const FRAME_WIDTH: Record<Viewport, number> = { desktop: 1024, mobile: 390 };
/** Design units the canvas is laid out in, per viewport. */
const DESIGN_WIDTH: Record<Viewport, number> = { desktop: 1024, mobile: 320 };

/**
 * The portfolio's container, in design units. Mirrors globals.css.
 * `chrome` is the strip the wordmark and the menu button occupy — anything
 * placed inside it will end up behind them.
 */
const CONTAINER: Record<Viewport, { gutter: number; chrome: number }> = {
  desktop: { gutter: 48, chrome: 72 },
  mobile: { gutter: 20, chrome: 50 },
};

/** How close, in design units, a dragged edge has to be for it to snap. */
const SNAP = 6;

/** Readable label for a block that has no name of its own. */
function describe(block: EditorBlock): string {
  if (block.kind === 'TEXT') {
    const paragraphs = (
      block.text as { paragraphs?: { text: string }[] } | null
    )?.paragraphs;
    const first = paragraphs?.find((p) => p.text.trim())?.text.trim();
    if (first) return first.length > 40 ? `${first.slice(0, 40)}…` : first;
    return 'Empty text';
  }
  if (block.kind === 'IMAGE') return 'Image';
  const shape = block.shape as { kind?: string } | null;
  return shape?.kind === 'LINE' ? 'Line' : 'Shape';
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
  const router = useRouter();
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [previewKey, setPreviewKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);


  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setStageWidth(entry.contentRect.width),
    );
    observer.observe(el);
    setStageWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const frameWidth = FRAME_WIDTH[viewport];
  const designWidth = DESIGN_WIDTH[viewport];
  const designHeight =
    viewport === 'desktop' ? page.heightDesktop : page.heightMobile;
  /** Preview pixels per design unit — the same thing `--u` does on the site. */
  const unit = frameWidth / designWidth;
  const frameHeight = Math.round(designHeight * unit);
  const zoom = stageWidth > 0 ? Math.min(1, stageWidth / frameWidth) : 1;

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const box = CONTAINER[viewport];
  /** Vertical lines worth snapping to: margins and the centre of the column. */
  const guides = useMemo(
    () => [box.gutter, designWidth / 2, designWidth - box.gutter],
    [box.gutter, designWidth]
  );

  const guidesRef = useRef(guides);
  guidesRef.current = guides;

  /** Horizontal lines: the bottom of the header strip. */
  const hGuides = useMemo(() => [box.chrome], [box.chrome]);
  const hGuidesRef = useRef(hGuides);
  hGuidesRef.current = hGuides;

  // Guías que el bloque está tocando ahora mismo, para resaltarlas. Se compara
  // antes de asignar: si no, cada fotograma del arrastre crearía un objeto
  // nuevo y volvería a pintar el editor entero sin que nada hubiera cambiado.
  const [activeGuides, setActiveGuides] = useState<{ x: number[]; y: number[] }>({
    x: [],
    y: [],
  });
  const setGuidesIfChanged = useCallback((x: number[], y: number[]) => {
    setActiveGuides((prev) =>
      prev.x.length === x.length &&
      prev.y.length === y.length &&
      prev.x.every((n, i) => n === x[i]) &&
      prev.y.every((n, i) => n === y[i])
        ? prev
        : { x, y }
    );
  }, []);
  const setGuidesRef = useRef(setGuidesIfChanged);
  setGuidesRef.current = setGuidesIfChanged;

  const geometryOf = useCallback(
    (block: EditorBlock) =>
      viewport === 'desktop'
        ? {
            x: block.dX ?? 0,
            y: block.dY ?? 0,
            w: block.dW ?? 0,
            h: block.dH ?? 0,
            hidden: block.dHidden,
            fixed: block.dFixed,
          }
        : {
            x: block.mX ?? block.dX ?? 0,
            y: block.mY ?? block.dY ?? 0,
            w: block.mW ?? block.dW ?? 0,
            h: block.mH ?? block.dH ?? 0,
            hidden: block.mHidden,
            fixed: block.mFixed,
          },
    [viewport],
  );

  /**
   * Push geometry into the preview.
   *
   * The preview is the real site in a same-origin iframe, and every block there
   * reads its position from CSS custom properties. Writing those properties
   * directly moves the actual text or image while dragging — without this, only
   * the selection outline would move and the page would look frozen until save.
   */
  const syncPreview = useCallback((changed: EditorBlock[]) => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    for (const block of changed) {
      const el = doc.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(block.id)}"]`,
      );
      if (!el) continue;
      el.style.setProperty('--dx', String(block.dX ?? 0));
      el.style.setProperty('--dy', String(block.dY ?? 0));
      el.style.setProperty('--dw', String(block.dW ?? 0));
      el.style.setProperty('--dh', String(block.dH ?? 0));
      el.style.setProperty('--mx', String(block.mX ?? block.dX ?? 0));
      el.style.setProperty('--my', String(block.mY ?? block.dY ?? 0));
      el.style.setProperty('--mw', String(block.mW ?? block.dW ?? 0));
      el.style.setProperty('--mh', String(block.mH ?? block.dH ?? 0));
    }
  }, []);

  /**
   * Refleja en la vista previa lo que hay en el inspector, sin guardarlo.
   *
   * También se anota el bloque en `live` para que el marco de selección y el
   * panel de capas sigan al contenido: si solo se moviera lo de dentro del
   * iframe, el marco se quedaría atrás y volvería el problema que ya tuvimos
   * al arrastrar. No se marca como sucio —el inspector tiene su propio Save— ni
   * se toca `blocks`, porque entonces el panel creería que no queda nada por
   * guardar.
   */
  const [live, setLive] = useState<Record<string, EditorBlock>>({});
  const previewInspector = useCallback(
    (block: EditorBlock, assetUrl: string | null) => {
      const doc = frameRef.current?.contentDocument;
      if (doc) applyBlockToPreview(doc, block, assetUrl);
      setLive((prev) => ({ ...prev, [block.id]: block }));
    },
    [],
  );

  /**
   * Take a block out of the preview straight away.
   *
   * Deleting happens on the server, and the iframe has no way of hearing about
   * it: it keeps showing the element until something reloads it. Reloading for
   * a deletion would blank and repaint the whole page, so the node is dropped
   * by hand instead and the reload is left to the refresh that follows.
   */
  const removeFromPreview = useCallback((id: string) => {
    frameRef.current?.contentDocument
      ?.querySelector(`[data-id="${CSS.escape(id)}"]`)
      ?.remove();
  }, []);

  // Unsaved moves would be lost when the iframe reloads, so they are re-applied.
  const onFrameLoad = useCallback(() => {
    syncPreview(blocks.filter((b) => dirty.has(b.id)));
  }, [blocks, dirty, syncPreview]);

  // Mirror of `blocks` that is updated synchronously.
  //
  // React runs the updater passed to a setter during render, not at call time,
  // so reading the merged block out of `setBlocks(prev => …)` gives nothing on
  // the frames that get batched — which left the preview one small step behind
  // and made dragging look broken. Keeping a ref lets each drag frame build on
  // the previous one and push it straight into the preview.
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // --- undo history ---------------------------------------------------------
  //
  // Snapshots are cheap: every update replaces the array and the dirty set
  // instead of mutating them, so keeping a reference is keeping a full copy.
  //
  // What counts as one step is the interesting part. A drag fires dozens of
  // updates and a held arrow key fires one every few milliseconds; recording
  // each of them would make undo useless. So a snapshot is taken when an
  // interaction *starts* and skipped while it continues — a drag is one step,
  // and consecutive tweaks to the same block within a short pause are folded
  // into that same step.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  type Snapshot = { blocks: EditorBlock[]; dirty: Set<string> };
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [history, setHistory] = useState({ past: 0, future: 0 });
  const syncHistoryCount = () =>
    setHistory({ past: pastRef.current.length, future: futureRef.current.length });

  const pushHistory = useCallback(() => {
    pastRef.current.push({ blocks: blocksRef.current, dirty: dirtyRef.current });
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    syncHistoryCount();
  }, []);

  // A fresh list from the server replaces everything, so the history it was
  // built on no longer describes anything that exists.
  useEffect(() => {
    setBlocks(initialBlocks);
    blocksRef.current = initialBlocks;
    setLive({});
    pastRef.current = [];
    futureRef.current = [];
    setHistory({ past: 0, future: 0 });
  }, [initialBlocks]);

  // Marks the last block touched and when, to tell a continuing gesture from a
  // new one.
  const lastTouchRef = useRef<{ id: string; at: number } | null>(null);
  const COALESCE_MS = 600;

  const patchGeometry = useCallback(
    (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => {
      const now = Date.now();
      const last = lastTouchRef.current;
      const continuing =
        // mid-drag: the snapshot was already taken in `startDrag`
        dragRef.current?.id === id ||
        (last?.id === id && now - last.at < COALESCE_MS);
      lastTouchRef.current = { id, at: now };
      if (!continuing) pushHistory();

      const round = (n: number) => Math.round(n * 100) / 100;
      const current = blocksRef.current;
      const index = current.findIndex((b) => b.id === id);
      if (index < 0) return;

      const b = current[index];
      const merged: EditorBlock =
        viewport === 'desktop'
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

      const next = [...current];
      next[index] = merged;
      blocksRef.current = next;

      syncPreview([merged]);
      setBlocks(next);
      setDirty((prev) => {
        if (prev.has(id)) return prev;
        const merged = new Set(prev).add(id);
        dirtyRef.current = merged;
        return merged;
      });
    },
    [viewport, syncPreview, pushHistory],
  );

  // --- dragging and resizing -----------------------------------------------
  //
  // The listeners live on `window` rather than on the block itself. The block
  // is a React element that re-renders and physically moves on every frame of
  // the drag, and handlers bound to it lose events as soon as it slides out
  // from under the cursor — the outline would follow while the content lagged
  // behind. Listening globally for the duration of the gesture avoids that
  // entirely, and works the same for a mouse, a trackpad or a pen.
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Kept in refs so the global listeners always read current values without
  // needing to be re-bound whenever the zoom or viewport changes.
  const scaleRef = useRef(1);
  scaleRef.current = zoom * unit;
  const patchRef = useRef(patchGeometry);
  patchRef.current = patchGeometry;

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      // Screen pixels back to design units: undo the editor zoom and the
      // viewport's own scale.
      const scale = scaleRef.current || 1;
      const dx = (event.clientX - drag.startX) / scale;
      const dy = (event.clientY - drag.startY) / scale;
      const step = event.shiftKey ? 10 : 1;
      const round = (n: number) => Math.round(n / step) * step;

      /**
       * Pull an edge onto the nearest guide.
       *
       * Every edge of the block is offered to every guide and the closest pair
       * within `SNAP` wins, so a block can be caught by its left edge, its
       * centre or its right edge — whichever the hand is nearest. Returns how
       * far the block has to move, plus the guides that caught it so they can
       * light up.
       *
       * Holding Alt suspends it: sometimes a block genuinely belongs a few
       * units off the margin and there has to be a way to put it there.
       */
      const magnet = (start: number, size: number, lines: number[]) => {
        if (event.altKey) return { shift: 0, hit: [] as number[] };
        let best: { shift: number; line: number } | null = null;
        for (const edge of [start, start + size / 2, start + size]) {
          for (const line of lines) {
            const delta = line - edge;
            if (Math.abs(delta) > SNAP) continue;
            if (!best || Math.abs(delta) < Math.abs(best.shift)) {
              best = { shift: delta, line };
            }
          }
        }
        return best ? { shift: best.shift, hit: [best.line] } : { shift: 0, hit: [] };
      };

      if (drag.mode === 'move') {
        const x = round(drag.origin.x + dx);
        const y = round(drag.origin.y + dy);
        const mx = magnet(x, drag.origin.w, guidesRef.current);
        const my = magnet(y, drag.origin.h, hGuidesRef.current);
        setGuidesRef.current(mx.hit, my.hit);
        patchRef.current(drag.id, { x: x + mx.shift, y: y + my.shift });
      } else {
        // Al redimensionar solo se mueve la esquina inferior derecha, así que
        // solo ese borde busca guía.
        const w = round(drag.origin.w + dx);
        const h = round(drag.origin.h + dy);
        const mw = magnet(drag.origin.x + w, 0, guidesRef.current);
        setGuidesRef.current(mw.hit, []);
        patchRef.current(drag.id, { w: w + mw.shift, h });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setGuidesRef.current([], []);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const startDrag = (
    event: React.PointerEvent,
    block: EditorBlock,
    mode: 'move' | 'resize',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(block.id);
    // Taken before the first movement so undo returns the block to where the
    // gesture began, not to where it was one frame ago.
    pushHistory();
    lastTouchRef.current = { id: block.id, at: Date.now() };
    const g = geometryOf(block);
    dragRef.current = {
      id: block.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: g.x, y: g.y, w: g.w, h: g.h },
    };
  };

  /**
   * Moves one step through the history.
   *
   * The whole block list is pushed to the preview rather than just what
   * changed: after an undo the iframe still carries the CSS variables written
   * during the move, and the only way to be sure none survives is to rewrite
   * them all.
   */
  const travel = useCallback(
    (direction: 'undo' | 'redo') => {
      const from = direction === 'undo' ? pastRef.current : futureRef.current;
      const to = direction === 'undo' ? futureRef.current : pastRef.current;
      const entry = from.pop();
      if (!entry) return;

      to.push({ blocks: blocksRef.current, dirty: dirtyRef.current });
      blocksRef.current = entry.blocks;
      dirtyRef.current = entry.dirty;
      setBlocks(entry.blocks);
      setDirty(entry.dirty);
      syncPreview(entry.blocks);
      // A restored state must not be folded into the step that follows it.
      lastTouchRef.current = null;
      syncHistoryCount();
      setMessage(direction === 'undo' ? 'Undone' : 'Redone');
    },
    [syncPreview],
  );

  // Arrow keys for pixel-level nudging without a mouse, and undo/redo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        travel(event.shiftKey ? 'redo' : 'undo');
        return;
      }
      // Windows keyboards also send Ctrl+Y for redo.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        travel('redo');
        return;
      }

      if (!selectedId) return;
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
  }, [selectedId, blocks, geometryOf, patchGeometry, travel]);

  // --- saving ---------------------------------------------------------------
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
        setMessage('Layout saved');
        setPreviewKey((k) => k + 1);
      } else {
        setMessage(result.error);
      }
    });
  };

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const previewSrc = useMemo(
    () => `${page.slug === '' ? '/' : `/${page.slug}`}?editor=${previewKey}`,
    [page.slug, previewKey],
  );

  const orderedLayers = useMemo(
    () => [...blocks].sort((a, b) => b.z - a.z),
    [blocks],
  );

  return (
    <div className="flex flex-col gap-8 xl:flex-row xl:gap-10">
      <div className="min-w-0 flex-1">
        <div className="editor-toolbar">
          <div className="editor-toggle">
            {(['desktop', 'mobile'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                aria-pressed={viewport === v}
              >
                {v === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>

          <span className="admin-eyebrow">
            {designWidth} × {designHeight} · {Math.round(zoom * 100)}%
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {(['TEXT', 'IMAGE', 'SHAPE'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await createBlock(page.id, kind);
                    setMessage(result.ok ? 'Block added' : result.error);
                    if (result.ok) {
                      setPreviewKey((k) => k + 1);
                      router.refresh();
                    }
                  })
                }
              >
                +{' '}
                {kind === 'TEXT'
                  ? 'Text'
                  : kind === 'IMAGE'
                    ? 'Image'
                    : 'Shape'}
              </button>
            ))}
            <button
              type="button"
              className="admin-btn"
              onClick={() => travel('undo')}
              disabled={history.past === 0}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => travel('redo')}
              disabled={history.future === 0}
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={saveGeometry}
              disabled={pending || dirty.size === 0}
            >
              {dirty.size ? `Save layout (${dirty.size})` : 'Layout saved'}
            </button>
          </div>
        </div>

        {message ? (
          <p className="admin-eyebrow mt-3" role="status">
            {message}
          </p>
        ) : null}

        <div ref={stageRef} className="editor-frame mt-4 overflow-auto p-3">
          <div
            style={{
              width: frameWidth * zoom,
              height: frameHeight * zoom,
              position: 'relative',
              // El lienzo móvil mide 390 y el escenario es mucho más ancho, así
              // que sin esto queda pegado a la izquierda con un vacío enorme al
              // lado. En escritorio no cambia nada: ahí el zoom lo hace ocupar
              // todo el ancho disponible.
              marginInline: 'auto',
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
                ref={frameRef}
                src={previewSrc}
                title="Page preview"
                width={frameWidth}
                height={frameHeight}
                scrolling="no"
                onLoad={onFrameLoad}
                className="pointer-events-none block border-0"
              />

              <div className="editor-guides">
                <div
                  className="editor-chrome-zone"
                  style={{ height: box.chrome * unit }}
                  title="Header strip — the wordmark and menu button sit here"
                />
                {[0, box.gutter, designWidth / 2, designWidth - box.gutter, designWidth].map(
                  (x, i) => (
                    <div
                      key={x}
                      className={`editor-guide${
                        i === 0 || i === 4 ? ' editor-guide--edge' : ''
                      }${i === 2 ? ' editor-guide--center' : ''}${
                        activeGuides.x.includes(x) ? ' editor-guide--live' : ''
                      }`}
                      style={{ left: x * unit }}
                    />
                  )
                )}
                {hGuides.map((y) => (
                  <div
                    key={`h${y}`}
                    className={`editor-guide editor-guide--h${
                      activeGuides.y.includes(y) ? ' editor-guide--live' : ''
                    }`}
                    style={{ top: y * unit }}
                  />
                ))}
              </div>

              <div className="absolute inset-0">
                {blocks.map((base) => {
                  const block = live[base.id] ?? base;
                  const g = geometryOf(block);
                  if (g.hidden) return null;
                  // Viewport-pinned blocks (the wordmark, the menu button) sit
                  // outside the canvas flow, so they are shown for selection
                  // but not dragged from here.
                  const pinned = Boolean(g.fixed);
                  return (
                    <div
                      key={block.id}
                      className="editor-block"
                      data-id={block.id}
                      data-selected={selectedId === block.id}
                      data-pinned={pinned || undefined}
                      // El diseño lleva algunas imágenes hasta el borde del
                      // lienzo a propósito, así que solo se avisa de lo que se
                      // sale de él, no de lo que rebasa el margen.
                      data-outside={
                        !pinned && (g.x < -1 || g.x + g.w > designWidth + 1) ? 'true' : undefined
                      }
                      style={{
                        left: g.x * unit,
                        top: g.y * unit,
                        width: g.w * unit,
                        height: g.h * unit,
                      }}
                      onPointerDown={(e) =>
                        pinned
                          ? setSelectedId(block.id)
                          : startDrag(e, block, 'move')
                      }
                    >
                      {selectedId === block.id ? (
                        <>
                          <span className="editor-block__label">
                            {block.name || describe(block)}
                            {pinned ? ' · pinned' : ''}
                          </span>
                          {!pinned ? (
                            <span
                              className="editor-handle"
                              onPointerDown={(e) =>
                                startDrag(e, block, 'resize')
                              }
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

        <p className="admin-muted mt-3 text-[12px]">
          Drag to move, the corner to resize, arrow keys to nudge (Shift = 10
          units). Position changes are applied to the preview straight away and
          stored when you save the layout.
        </p>

        <details className="admin-fold mt-6 border-t border-(--rule-strong) pt-3">
          <summary className="admin-eyebrow">Layers ({blocks.length})</summary>
          <ul className="mt-3 flex flex-col">
            {orderedLayers.map((block) => {
              const g = geometryOf(block);
              return (
                <li key={block.id}>
                  <button
                    type="button"
                    className="layer-row"
                    aria-current={selectedId === block.id}
                    onClick={() => setSelectedId(block.id)}
                  >
                    <span className="w-12 shrink-0 text-[10px] tracking-[0.08em] uppercase opacity-60">
                      {block.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {block.name || describe(block)}
                    </span>
                    <span className="shrink-0 text-[11px] opacity-60">
                      z{block.z}
                    </span>
                    {g.hidden ? (
                      <span className="shrink-0 text-[11px] opacity-60">
                        hidden
                      </span>
                    ) : null}
                    {g.fixed ? (
                      <span className="shrink-0 text-[11px] opacity-60">
                        pinned
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      </div>

      <div className="w-full shrink-0 xl:w-85">
        <BlockInspector
          key={selected?.id ?? 'none'}
          block={selected}
          viewport={viewport}
          container={{ width: designWidth, gutter: box.gutter }}
          assets={assets}
          pages={pages}
          textStyles={textStyles}
          page={page}
          onPreview={previewInspector}
          onSaved={() => {
            setLive({});
            setPreviewKey((k) => k + 1);
          }}
          onDelete={() =>
            selected &&
            startTransition(async () => {
              const id = selected.id;
              const result = await deleteBlock(id);
              setMessage(result.ok ? 'Block deleted' : result.error);
              if (!result.ok) return;

              removeFromPreview(id);
              const next = blocksRef.current.filter((b) => b.id !== id);
              blocksRef.current = next;
              setBlocks(next);
              setSelectedId(null);
              setDirty((prev) => {
                if (!prev.has(id)) return prev;
                const merged = new Set(prev);
                merged.delete(id);
                dirtyRef.current = merged;
                return merged;
              });
              // El bloque se borra también de la historia en lugar de vaciarla:
              // deshacer no puede resucitarlo, pero sí debe seguir sirviendo
              // para los movimientos anteriores.
              const strip = (s: Snapshot): Snapshot => ({
                blocks: s.blocks.filter((b) => b.id !== id),
                dirty: new Set([...s.dirty].filter((d) => d !== id)),
              });
              pastRef.current = pastRef.current.map(strip);
              futureRef.current = futureRef.current.map(strip);
              router.refresh();
            })
          }
          onDuplicate={() =>
            selected &&
            startTransition(async () => {
              const result = await duplicateBlock(selected.id);
              setMessage(result.ok ? 'Block duplicated' : result.error);
              // Un bloque nuevo no existe en el iframe, y a diferencia del
              // borrado no se puede fabricar a mano: hay que recargarlo.
              if (result.ok) {
                setPreviewKey((k) => k + 1);
                router.refresh();
              }
            })
          }
          onPageSaved={(next) =>
            startTransition(async () => {
              const result = await updatePage({ ...page, ...next });
              setMessage(result.ok ? 'Page saved' : result.error);
              if (result.ok) setPreviewKey((k) => k + 1);
            })
          }
        />
      </div>
    </div>
  );
}
