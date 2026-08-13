'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { updateBlock } from '@/lib/actions/content';
import type { EditorPage } from './PageEditor';
import type {
  Paragraph,
  ShapeContent,
  ImageContent,
} from '@/lib/content-types';

export interface EditorBlock {
  id: string;
  kind: string;
  name: string | null;
  z: number;
  opacity: number;
  dX: number | null;
  dY: number | null;
  dW: number | null;
  dH: number | null;
  dRotation: number;
  dHidden: boolean;
  dFixed: string | null;
  mX: number | null;
  mY: number | null;
  mW: number | null;
  mH: number | null;
  mRotation: number;
  mHidden: boolean;
  mFixed: string | null;
  text: unknown;
  image: unknown;
  shape: unknown;
  assetId: string | null;
  linkUrl: string | null;
  linkPageId: string | null;
  linkTarget: string;
}

export interface EditorAsset {
  id: string;
  url: string;
  filename: string;
  isSvg: boolean;
  width: number | null;
  height: number | null;
}

function Fold({
  title,
  children,
  open,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="admin-fold border-t border-(--rule-strong) py-3"
      open={open}
    >
      <summary className="admin-eyebrow">{title}</summary>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="admin-label">{label}</span>
      {children}
    </label>
  );
}

export function BlockInspector({
  block,
  viewport,
  container,
  assets,
  pages,
  textStyles,
  page,
  onSaved,
  onDelete,
  onDuplicate,
  onPageSaved,
  onPreview,
}: {
  block: EditorBlock | null;
  viewport: 'desktop' | 'mobile';
  container: { width: number; gutter: number };
  assets: EditorAsset[];
  pages: { id: string; title: string; slug: string }[];
  textStyles: { key: string; label: string }[];
  page: EditorPage;
  onSaved: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPageSaved: (next: Partial<EditorPage>) => void;
  onPreview: (block: EditorBlock, assetUrl: string | null) => void;
}) {
  return (
    <div className="flex flex-col">
      <PageSettings page={page} onSave={onPageSaved} />
      {block ? (
        <BlockForm
          block={block}
          viewport={viewport}
          container={container}
          assets={assets}
          pages={pages}
          textStyles={textStyles}
          onSaved={onSaved}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onPreview={onPreview}
        />
      ) : (
        <p className="admin-muted border-t border-(--rule-strong) py-4 text-[13px]">
          Select a block on the canvas to edit its content.
        </p>
      )}
    </div>
  );
}

function PageSettings({
  page,
  onSave,
}: {
  page: EditorPage;
  onSave: (next: Partial<EditorPage>) => void;
}) {
  const [form, setForm] = useState(page);

  return (
    <Fold title="Page">
      <Field label="Title">
        <input
          className="admin-field"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label="Slug (empty = home page)">
        <input
          className="admin-field"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Desktop height">
          <input
            className="admin-field"
            type="number"
            value={form.heightDesktop}
            onChange={(e) =>
              setForm({ ...form, heightDesktop: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Mobile height">
          <input
            className="admin-field"
            type="number"
            value={form.heightMobile}
            onChange={(e) =>
              setForm({ ...form, heightMobile: Number(e.target.value) })
            }
          />
        </Field>
      </div>
      <Field label="Background colour">
        <input
          className="admin-field"
          value={form.backgroundColor ?? ''}
          placeholder="#efefef"
          onChange={(e) =>
            setForm({ ...form, backgroundColor: e.target.value || null })
          }
        />
      </Field>
      <Field label="SEO title">
        <input
          className="admin-field"
          value={form.seoTitle ?? ''}
          onChange={(e) =>
            setForm({ ...form, seoTitle: e.target.value || null })
          }
        />
      </Field>
      <Field label="SEO description">
        <textarea
          className="admin-field"
          rows={2}
          value={form.seoDescription ?? ''}
          onChange={(e) =>
            setForm({ ...form, seoDescription: e.target.value || null })
          }
        />
      </Field>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
        />
        <span>Published</span>
      </label>
      <button
        type="button"
        className="admin-btn admin-btn--primary self-start"
        onClick={() => onSave(form)}
      >
        Save page
      </button>
    </Fold>
  );
}

function BlockForm({
  block,
  viewport,
  container,
  assets,
  pages,
  textStyles,
  onSaved,
  onDelete,
  onDuplicate,
  onPreview,
}: {
  block: EditorBlock;
  viewport: 'desktop' | 'mobile';
  container: { width: number; gutter: number };
  assets: EditorAsset[];
  pages: { id: string; title: string; slug: string }[];
  textStyles: { key: string; label: string }[];
  onSaved: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** Pinta el estado actual del formulario en la vista previa, sin guardarlo. */
  onPreview: (block: EditorBlock, assetUrl: string | null) => void;
}) {
  const [form, setForm] = useState(block);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // --- subir una imagen sin salir del panel ---------------------------------
  //
  // Lo recién subido no está en `assets`, que viene del servidor, y refrescar
  // para traerlo tiraría lo que hubiera sin guardar en este formulario. Así que
  // se queda aquí y se junta con la lista al vuelo; la biblioteca lo verá en su
  // próxima carga, porque el asset ya existe en la base.
  const [uploaded, setUploaded] = useState<EditorAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const allAssets = [...uploaded, ...assets];
  // Espejo para el efecto de vista previa, que no debe volver a dispararse solo
  // porque la lista de imágenes se reconstruya en cada render.
  const allAssetsRef = useRef(allAssets);
  allAssetsRef.current = allAssets;

  const uploadAsset = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Could not upload ${file.name}`);
      const asset = data.asset as EditorAsset;
      setUploaded((prev) => [asset, ...prev]);
      setForm((prev) => ({ ...prev, assetId: asset.id }));
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Cada cambio se refleja en la vista previa al instante. Se hace en un efecto
  // y no en cada `setForm` para que valga igual para los treinta y tantos
  // controles del panel sin repetir la llamada en cada uno.
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  useEffect(() => {
    // La url va aparte porque el iframe no conoce un archivo recién subido.
    const url = allAssetsRef.current.find((a) => a.id === form.assetId)?.url ?? null;
    onPreviewRef.current(form, url);
  }, [form]);

  const dirty = JSON.stringify(form) !== JSON.stringify(block);

  const paragraphs = ((form.text as { paragraphs?: Paragraph[] } | null)
    ?.paragraphs ?? []) as Paragraph[];
  const shape = (form.shape ?? {}) as ShapeContent;
  const image = (form.image ?? {}) as ImageContent;

  const setParagraph = (index: number, patch: Partial<Paragraph>) => {
    const next = paragraphs.map((p, i) =>
      i === index ? { ...p, ...patch } : p,
    );
    setForm({ ...form, text: { ...(form.text as object), paragraphs: next } });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateBlock({
        id: form.id,
        name: form.name,
        z: form.z,
        opacity: form.opacity,
        dX: form.dX,
        dY: form.dY,
        dW: form.dW,
        dH: form.dH,
        dRotation: form.dRotation,
        dHidden: form.dHidden,
        mX: form.mX,
        mY: form.mY,
        mW: form.mW,
        mH: form.mH,
        mRotation: form.mRotation,
        mHidden: form.mHidden,
        text: form.text,
        image: form.image,
        shape: form.shape,
        assetId: form.assetId,
        linkUrl: form.linkUrl,
        linkPageId: form.linkPageId,
        linkTarget: form.linkTarget,
      });
      if (result.ok) onSaved();
      else setError(result.error);
    });
  };

  const isDesktop = viewport === 'desktop';
  const num = (v: number | null) => (v === null ? '' : String(v));
  const round = (n: number) => Math.round(n * 100) / 100;

  // --- alineación dentro del container --------------------------------------
  //
  // Los tres botones de alineación solo mueven el bloque; el ancho completo es
  // un interruptor aparte. Antes iban juntos y el resultado despistaba: tras
  // poner un bloque a ancho completo, pulsar «Left» solo cambiaba la x y el
  // ancho seguía ocupándolo todo, así que parecía que el botón no hacía nada.
  const inner = container.width - container.gutter * 2;
  const width = (isDesktop ? form.dW : form.mW) ?? 0;
  const left = (isDesktop ? form.dX : form.mX) ?? 0;

  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const isFullWidth = near(left, container.gutter) && near(width, inner);

  /** Alineación actual, deducida de la posición. */
  const alignment: 'left' | 'center' | 'right' | 'free' = near(
    left,
    container.gutter,
  )
    ? 'left'
    : near(left, container.width - container.gutter - width)
      ? 'right'
      : near(left, (container.width - width) / 2)
        ? 'center'
        : 'free';

  /** Ancho previo al interruptor, para poder devolverlo al apagarlo. */
  const widthBeforeFull = useRef<number | null>(null);

  const placeAt = (mode: 'left' | 'center' | 'right', w: number) => ({
    w,
    x:
      mode === 'left'
        ? container.gutter
        : mode === 'right'
          ? container.width - container.gutter - w
          : (container.width - w) / 2,
  });

  const setGeometry = ({ x, w }: { x: number; w: number }) =>
    setForm({
      ...form,
      ...(isDesktop
        ? { dX: round(x), dW: round(w) }
        : { mX: round(x), mW: round(w) }),
    });
  const kindLabel =
    block.kind === 'TEXT' ? 'Text' : block.kind === 'IMAGE' ? 'Image' : 'Shape';

  return (
    <>
      <Fold title={`Block · ${kindLabel}`} open>
        <Field label="Name">
          <input
            className="admin-field"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value || null })}
          />
        </Field>

        <div>
          <p className="admin-label">
            Position &amp; size — {isDesktop ? 'desktop' : 'mobile'}
          </p>
          <div className="grid grid-cols-4 gap-3">
            {(['X', 'Y', 'W', 'H'] as const).map((label, i) => {
              const keys = isDesktop
                ? (['dX', 'dY', 'dW', 'dH'] as const)
                : (['mX', 'mY', 'mW', 'mH'] as const);
              const key = keys[i];
              return (
                <label key={label} className="block">
                  <span className="admin-muted mb-1 block text-[10px]">
                    {label}
                  </span>
                  <input
                    className="admin-field"
                    type="number"
                    step="0.5"
                    value={num(form[key])}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <p className="admin-label">Align within the container</p>
          <div className="editor-align">
            {(
              [
                ['Left', 'left'],
                ['Centre', 'center'],
                ['Right', 'right'],
              ] as const
            ).map(([label, mode]) => (
              <button
                key={mode}
                type="button"
                className={`admin-btn${alignment === mode ? ' is-active' : ''}`}
                aria-pressed={alignment === mode}
                onClick={() => setGeometry(placeAt(mode, width))}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`admin-btn mt-2 w-full${isFullWidth ? ' is-active' : ''}`}
            aria-pressed={isFullWidth}
            onClick={() => {
              if (isFullWidth) {
                // Al apagarlo se recupera el ancho que tenía antes. Si el
                // bloque ya llegó a ancho completo desde el servidor no hay
                // nada que recordar, así que se vuelve al valor guardado.
                const saved = (isDesktop ? block.dW : block.mW) ?? 0;
                const restored =
                  widthBeforeFull.current ??
                  (saved && saved !== inner ? saved : Math.round(inner / 2));
                setGeometry(placeAt(alignment === 'free' ? 'left' : alignment, restored));
                widthBeforeFull.current = null;
              } else {
                widthBeforeFull.current = width;
                setGeometry({ x: container.gutter, w: inner });
              }
            }}
          >
            {isFullWidth ? '✓ Full width' : 'Full width'}
          </button>

          <p className="admin-muted mt-2 text-[11px]">
            The container is {container.width} units wide with a {container.gutter}-unit margin.
            Left, centre and right move the block without resizing it; full width
            is a switch, and turning it off brings back the previous width.
            Dragging snaps to those edges and to the centre line — by the block&rsquo;s
            own left edge, centre or right edge, whichever is closest. Hold Alt to
            place a block freely without snapping.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Rotation">
            <input
              className="admin-field"
              type="number"
              value={isDesktop ? form.dRotation : form.mRotation}
              onChange={(e) =>
                setForm({
                  ...form,
                  [isDesktop ? 'dRotation' : 'mRotation']: Number(
                    e.target.value,
                  ),
                })
              }
            />
          </Field>
          <Field label="Layer">
            <input
              className="admin-field"
              type="number"
              value={form.z}
              onChange={(e) => setForm({ ...form, z: Number(e.target.value) })}
            />
          </Field>
          <Field label="Opacity">
            <input
              className="admin-field"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={form.opacity}
              onChange={(e) =>
                setForm({ ...form, opacity: Number(e.target.value) })
              }
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.dHidden}
              onChange={(e) => setForm({ ...form, dHidden: e.target.checked })}
            />
            <span>Hidden on desktop</span>
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.mHidden}
              onChange={(e) => setForm({ ...form, mHidden: e.target.checked })}
            />
            <span>Hidden on mobile</span>
          </label>
        </div>
      </Fold>

      {block.kind === 'TEXT' ? (
        <Fold title="Text" open>
          {paragraphs.map((paragraph, index) => (
            <div key={index} className="border-l border-(--rule) pl-3">
              <Field label={`Paragraph ${index + 1}`}>
                <textarea
                  className="admin-field"
                  rows={3}
                  value={paragraph.text}
                  onChange={(e) =>
                    setParagraph(index, { text: e.target.value })
                  }
                />
              </Field>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Style">
                  <select
                    className="admin-field"
                    value={paragraph.styleKey ?? ''}
                    onChange={(e) =>
                      setParagraph(index, { styleKey: e.target.value || null })
                    }
                  >
                    <option value="">— none —</option>
                    {textStyles.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Align">
                  <select
                    className="admin-field"
                    value={paragraph.align ?? 'left'}
                    onChange={(e) =>
                      setParagraph(index, { align: e.target.value })
                    }
                  >
                    <option value="left">Left</option>
                    <option value="center">Centre</option>
                    <option value="right">Right</option>
                    <option value="justify">Justify</option>
                  </select>
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3">
                {(
                  [
                    ['Size', 'fontSize'],
                    ['Leading', 'lineHeight'],
                    ['Tracking', 'letterSpacing'],
                    ['Space', 'paddingTop'],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="admin-muted mb-1 block text-[10px]">
                      {label}
                    </span>
                    <input
                      className="admin-field"
                      type="number"
                      step={key === 'letterSpacing' ? 0.1 : 1}
                      value={paragraph[key] ?? ''}
                      onChange={(e) =>
                        setParagraph(index, {
                          [key]:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--ghost mt-2 text-(--danger)"
                onClick={() =>
                  setForm({
                    ...form,
                    text: {
                      ...(form.text as object),
                      paragraphs: paragraphs.filter((_, i) => i !== index),
                    },
                  })
                }
              >
                Remove paragraph
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-btn self-start"
            onClick={() =>
              setForm({
                ...form,
                text: {
                  ...(form.text as object),
                  paragraphs: [...paragraphs, { text: 'New paragraph' }],
                },
              })
            }
          >
            + Add paragraph
          </button>
        </Fold>
      ) : null}

      {block.kind === 'IMAGE' ? (
        <Fold title="Image" open>
          <Field label="File">
            <select
              className="admin-field"
              value={form.assetId ?? ''}
              onChange={(e) =>
                setForm({ ...form, assetId: e.target.value || null })
              }
            >
              <option value="">— none —</option>
              {allAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                uploadAsset(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="admin-btn"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? 'Uploading…' : '+ Upload image'}
            </button>
            <span className="admin-muted text-[11px]">
              Goes straight into the library and is picked for this block.
            </span>
          </div>
          {uploadError ? (
            <p role="alert" className="text-[12px] text-(--danger)">
              {uploadError}
            </p>
          ) : null}

          {form.assetId ? (
            <AssetPreview asset={allAssets.find((a) => a.id === form.assetId)} />
          ) : null}

          <Field label="Alt text">
            <input
              className="admin-field"
              value={image.alt ?? ''}
              onChange={(e) =>
                setForm({ ...form, image: { ...image, alt: e.target.value } })
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fit">
              <select
                className="admin-field"
                value={image.objectFit ?? 'cover'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    image: {
                      ...image,
                      objectFit: e.target.value as 'cover' | 'contain',
                    },
                  })
                }
              >
                <option value="cover">Fill</option>
                <option value="contain">Contain</option>
              </select>
            </Field>
            <Field label="Corner radius">
              <input
                className="admin-field"
                type="number"
                value={image.radius ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    image: { ...image, radius: Number(e.target.value) },
                  })
                }
              />
            </Field>
          </div>
          <p className="admin-muted text-[12px]">
            The crop from the original design is kept. A new image reuses that
            same framing; if it does not suit, set the fit to Fill.
          </p>
        </Fold>
      ) : null}

      {block.kind === 'SHAPE' ? (
        <Fold title="Shape" open>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                className="admin-field"
                value={shape.kind ?? 'RECTANGLE'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shape: {
                      ...shape,
                      kind: e.target.value as ShapeContent['kind'],
                    },
                  })
                }
              >
                <option value="RECTANGLE">Rectangle</option>
                <option value="LINE">Line</option>
                <option value="ELLIPSE">Ellipse</option>
              </select>
            </Field>
            <Field label="Colour">
              <input
                className="admin-field"
                value={shape.fill ?? '#000000'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shape: { ...shape, fill: e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Opacity">
              <input
                className="admin-field"
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={shape.opacity ?? 1}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shape: { ...shape, opacity: Number(e.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Radius">
              <input
                className="admin-field"
                type="number"
                value={shape.radius ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shape: { ...shape, radius: Number(e.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Weight">
              <input
                className="admin-field"
                type="number"
                step="0.5"
                value={shape.borderWidth ?? 1}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shape: { ...shape, borderWidth: Number(e.target.value) },
                  })
                }
              />
            </Field>
          </div>
        </Fold>
      ) : null}

      <Fold title="Link">
        <Field label="To a page">
          <select
            className="admin-field"
            value={form.linkPageId ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                linkPageId: e.target.value || null,
                linkUrl: null,
              })
            }
          >
            <option value="">— none —</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} (/{p.slug})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Or an external URL">
          <input
            className="admin-field"
            placeholder="https://…"
            value={form.linkUrl ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                linkUrl: e.target.value || null,
                linkPageId: null,
              })
            }
          />
        </Field>
        <Field label="Open in">
          <select
            className="admin-field"
            value={form.linkTarget}
            onChange={(e) => setForm({ ...form, linkTarget: e.target.value })}
          >
            <option value="_self">Same tab</option>
            <option value="_blank">New tab</option>
          </select>
        </Field>
      </Fold>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-(--danger)">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-(--rule-strong) pt-4">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? 'Saving…' : dirty ? 'Save block' : 'Saved'}
        </button>
        {dirty ? (
          <button
            type="button"
            className="admin-btn"
            onClick={() => setForm(block)}
            disabled={pending}
          >
            Discard
          </button>
        ) : null}
        <button
          type="button"
          className="admin-btn"
          onClick={onDuplicate}
          disabled={pending}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          onClick={onDelete}
          disabled={pending}
        >
          Delete
        </button>
      </div>
    </>
  );
}

function AssetPreview({ asset }: { asset: EditorAsset | undefined }) {
  if (!asset) return null;
  return (
    <div className="flex items-center gap-3 border border-(--rule) p-2">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-(--paper)">
        {asset.isSvg ? (
          <span className="admin-eyebrow flex h-full items-center justify-center">
            SVG
          </span>
        ) : (
          <Image
            src={asset.url}
            alt=""
            fill
            sizes="48px"
            className="object-contain"
            unoptimized
          />
        )}
      </div>
      <p className="admin-muted min-w-0 flex-1 truncate text-[11px]">
        {asset.filename}
        {asset.width ? ` · ${asset.width}×${asset.height}` : ''}
      </p>
    </div>
  );
}
