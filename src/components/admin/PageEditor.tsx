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

  useEffect(() => setBlocks(initialBlocks), [initialBlocks]);

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

  const patchGeometry = useCallback(
    (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => {
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
      setDirty((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    },
    [viewport, syncPreview],
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
      const snap = (n: number) => Math.round(n / step) * step;

      if (drag.mode === 'move') {
        patchRef.current(drag.id, {
          x: snap(drag.origin.x + dx),
          y: snap(drag.origin.y + dy),
        });
      } else {
        patchRef.current(drag.id, {
          w: snap(drag.origin.w + dx),
          h: snap(drag.origin.h + dy),
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
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
    const g = geometryOf(block);
    dragRef.current = {
      id: block.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: g.x, y: g.y, w: g.w, h: g.h },
    };
  };

  // Arrow keys for pixel-level nudging without a mouse.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }
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
                    if (result.ok) router.refresh();
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

              <div className="absolute inset-0">
                {blocks.map((block) => {
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
          assets={assets}
          pages={pages}
          textStyles={textStyles}
          page={page}
          onSaved={() => setPreviewKey((k) => k + 1)}
          onDelete={() =>
            selected &&
            startTransition(async () => {
              const result = await deleteBlock(selected.id);
              setMessage(result.ok ? 'Block deleted' : result.error);
              if (result.ok) {
                setSelectedId(null);
                router.refresh();
              }
            })
          }
          onDuplicate={() =>
            selected &&
            startTransition(async () => {
              const result = await duplicateBlock(selected.id);
              setMessage(result.ok ? 'Block duplicated' : result.error);
              if (result.ok) router.refresh();
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
