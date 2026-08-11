'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { updateBlock } from '@/lib/actions/content';
import type { EditorPage } from './PageEditor';
import type { Paragraph, ShapeContent, ImageContent } from '@/lib/content-types';

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="admin-card" open>
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
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
  assets,
  pages,
  textStyles,
  page,
  onSaved,
  onDelete,
  onDuplicate,
  onPageSaved,
}: {
  block: EditorBlock | null;
  viewport: 'desktop' | 'mobile';
  assets: EditorAsset[];
  pages: { id: string; title: string; slug: string }[];
  textStyles: { key: string; label: string }[];
  page: EditorPage;
  onSaved: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPageSaved: (next: Partial<EditorPage>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageSettings page={page} onSave={onPageSaved} />
      {block ? (
        <BlockForm
          block={block}
          viewport={viewport}
          assets={assets}
          pages={pages}
          textStyles={textStyles}
          onSaved={onSaved}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ) : (
        <p className="admin-card text-[13px] text-[var(--admin-muted)]">
          Selecciona un bloque en el lienzo para editar su contenido.
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
    <Section title="Página">
      <Field label="Título">
        <input
          className="admin-field"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label="Slug (vacío = página de inicio)">
        <input
          className="admin-field"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alto escritorio">
          <input
            className="admin-field"
            type="number"
            value={form.heightDesktop}
            onChange={(e) => setForm({ ...form, heightDesktop: Number(e.target.value) })}
          />
        </Field>
        <Field label="Alto móvil">
          <input
            className="admin-field"
            type="number"
            value={form.heightMobile}
            onChange={(e) => setForm({ ...form, heightMobile: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Color de fondo">
        <input
          className="admin-field"
          value={form.backgroundColor ?? ''}
          placeholder="#efefef"
          onChange={(e) => setForm({ ...form, backgroundColor: e.target.value || null })}
        />
      </Field>
      <Field label="Título SEO">
        <input
          className="admin-field"
          value={form.seoTitle ?? ''}
          onChange={(e) => setForm({ ...form, seoTitle: e.target.value || null })}
        />
      </Field>
      <Field label="Descripción SEO">
        <textarea
          className="admin-field"
          rows={2}
          value={form.seoDescription ?? ''}
          onChange={(e) => setForm({ ...form, seoDescription: e.target.value || null })}
        />
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
        />
        <span>Publicada</span>
      </label>
      <button type="button" className="admin-btn admin-btn--primary" onClick={() => onSave(form)}>
        Guardar página
      </button>
    </Section>
  );
}

function BlockForm({
  block,
  viewport,
  assets,
  pages,
  textStyles,
  onSaved,
  onDelete,
  onDuplicate,
}: {
  block: EditorBlock;
  viewport: 'desktop' | 'mobile';
  assets: EditorAsset[];
  pages: { id: string; title: string; slug: string }[];
  textStyles: { key: string; label: string }[];
  onSaved: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [form, setForm] = useState(block);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const paragraphs = ((form.text as { paragraphs?: Paragraph[] } | null)?.paragraphs ??
    []) as Paragraph[];
  const shape = (form.shape ?? {}) as ShapeContent;
  const image = (form.image ?? {}) as ImageContent;

  const setParagraph = (index: number, patch: Partial<Paragraph>) => {
    const next = paragraphs.map((p, i) => (i === index ? { ...p, ...patch } : p));
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

  return (
    <>
      <Section title={`Bloque · ${block.kind}`}>
        <Field label="Nombre">
          <input
            className="admin-field"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value || null })}
          />
        </Field>

        <div className="grid grid-cols-4 gap-2">
          {(['X', 'Y', 'Ancho', 'Alto'] as const).map((label, i) => {
            const keys = isDesktop
              ? (['dX', 'dY', 'dW', 'dH'] as const)
              : (['mX', 'mY', 'mW', 'mH'] as const);
            const key = keys[i];
            return (
              <Field key={label} label={label}>
                <input
                  className="admin-field"
                  type="number"
                  step="0.5"
                  value={num(form[key])}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </Field>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Rotación">
            <input
              className="admin-field"
              type="number"
              value={isDesktop ? form.dRotation : form.mRotation}
              onChange={(e) =>
                setForm({
                  ...form,
                  [isDesktop ? 'dRotation' : 'mRotation']: Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Capa (z)">
            <input
              className="admin-field"
              type="number"
              value={form.z}
              onChange={(e) => setForm({ ...form, z: Number(e.target.value) })}
            />
          </Field>
          <Field label="Opacidad">
            <input
              className="admin-field"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={form.opacity}
              onChange={(e) => setForm({ ...form, opacity: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.dHidden}
              onChange={(e) => setForm({ ...form, dHidden: e.target.checked })}
            />
            <span>Oculto en escritorio</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.mHidden}
              onChange={(e) => setForm({ ...form, mHidden: e.target.checked })}
            />
            <span>Oculto en móvil</span>
          </label>
        </div>
      </Section>

      {block.kind === 'TEXT' ? (
        <Section title="Texto">
          {paragraphs.map((paragraph, index) => (
            <div key={index} className="rounded-lg border border-[var(--admin-border)] p-3">
              <Field label={`Párrafo ${index + 1}`}>
                <textarea
                  className="admin-field"
                  rows={3}
                  value={paragraph.text}
                  onChange={(e) => setParagraph(index, { text: e.target.value })}
                />
              </Field>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Estilo">
                  <select
                    className="admin-field"
                    value={paragraph.styleKey ?? ''}
                    onChange={(e) => setParagraph(index, { styleKey: e.target.value || null })}
                  >
                    <option value="">— sin estilo —</option>
                    {textStyles.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Alineación">
                  <select
                    className="admin-field"
                    value={paragraph.align ?? 'left'}
                    onChange={(e) => setParagraph(index, { align: e.target.value })}
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                    <option value="justify">Justificado</option>
                  </select>
                </Field>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <Field label="Cuerpo">
                  <input
                    className="admin-field"
                    type="number"
                    value={paragraph.fontSize ?? ''}
                    onChange={(e) =>
                      setParagraph(index, {
                        fontSize: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Interlín.">
                  <input
                    className="admin-field"
                    type="number"
                    value={paragraph.lineHeight ?? ''}
                    onChange={(e) =>
                      setParagraph(index, {
                        lineHeight: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Tracking">
                  <input
                    className="admin-field"
                    type="number"
                    step="0.1"
                    value={paragraph.letterSpacing ?? ''}
                    onChange={(e) =>
                      setParagraph(index, {
                        letterSpacing: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Aire sup.">
                  <input
                    className="admin-field"
                    type="number"
                    value={paragraph.paddingTop ?? ''}
                    onChange={(e) =>
                      setParagraph(index, {
                        paddingTop: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--danger mt-2"
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
                Quitar párrafo
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              setForm({
                ...form,
                text: {
                  ...(form.text as object),
                  paragraphs: [...paragraphs, { text: 'Nuevo párrafo' }],
                },
              })
            }
          >
            + Añadir párrafo
          </button>
        </Section>
      ) : null}

      {block.kind === 'IMAGE' ? (
        <Section title="Imagen">
          <Field label="Archivo">
            <select
              className="admin-field"
              value={form.assetId ?? ''}
              onChange={(e) => setForm({ ...form, assetId: e.target.value || null })}
            >
              <option value="">— sin imagen —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename}
                </option>
              ))}
            </select>
          </Field>

          {form.assetId ? (
            <AssetPreview asset={assets.find((a) => a.id === form.assetId)} />
          ) : null}

          <Field label="Texto alternativo">
            <input
              className="admin-field"
              value={image.alt ?? ''}
              onChange={(e) => setForm({ ...form, image: { ...image, alt: e.target.value } })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Ajuste">
              <select
                className="admin-field"
                value={image.objectFit ?? 'cover'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    image: { ...image, objectFit: e.target.value as 'cover' | 'contain' },
                  })
                }
              >
                <option value="cover">Rellenar</option>
                <option value="contain">Contener</option>
              </select>
            </Field>
            <Field label="Radio">
              <input
                className="admin-field"
                type="number"
                value={image.radius ?? 0}
                onChange={(e) =>
                  setForm({ ...form, image: { ...image, radius: Number(e.target.value) } })
                }
              />
            </Field>
          </div>
          <p className="text-[12px] text-[var(--admin-muted)]">
            El recorte se conserva del diseño original. Al cambiar de imagen se reutiliza ese mismo
            encuadre; si no encaja, pon el ajuste en «Rellenar».
          </p>
        </Section>
      ) : null}

      {block.kind === 'SHAPE' ? (
        <Section title="Forma">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <select
                className="admin-field"
                value={shape.kind ?? 'RECTANGLE'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shape: { ...shape, kind: e.target.value as ShapeContent['kind'] },
                  })
                }
              >
                <option value="RECTANGLE">Rectángulo</option>
                <option value="LINE">Línea</option>
                <option value="ELLIPSE">Elipse</option>
              </select>
            </Field>
            <Field label="Color">
              <input
                className="admin-field"
                value={shape.fill ?? '#000000'}
                onChange={(e) => setForm({ ...form, shape: { ...shape, fill: e.target.value } })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Opacidad">
              <input
                className="admin-field"
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={shape.opacity ?? 1}
                onChange={(e) =>
                  setForm({ ...form, shape: { ...shape, opacity: Number(e.target.value) } })
                }
              />
            </Field>
            <Field label="Radio">
              <input
                className="admin-field"
                type="number"
                value={shape.radius ?? 0}
                onChange={(e) =>
                  setForm({ ...form, shape: { ...shape, radius: Number(e.target.value) } })
                }
              />
            </Field>
            <Field label="Grosor">
              <input
                className="admin-field"
                type="number"
                step="0.5"
                value={shape.borderWidth ?? 1}
                onChange={(e) =>
                  setForm({ ...form, shape: { ...shape, borderWidth: Number(e.target.value) } })
                }
              />
            </Field>
          </div>
        </Section>
      ) : null}

      <Section title="Enlace">
        <Field label="A una página">
          <select
            className="admin-field"
            value={form.linkPageId ?? ''}
            onChange={(e) =>
              setForm({ ...form, linkPageId: e.target.value || null, linkUrl: null })
            }
          >
            <option value="">— ninguna —</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} (/{p.slug})
              </option>
            ))}
          </select>
        </Field>
        <Field label="O a una URL externa">
          <input
            className="admin-field"
            placeholder="https://…"
            value={form.linkUrl ?? ''}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value || null, linkPageId: null })}
          />
        </Field>
        <Field label="Abrir en">
          <select
            className="admin-field"
            value={form.linkTarget}
            onChange={(e) => setForm({ ...form, linkTarget: e.target.value })}
          >
            <option value="_self">La misma pestaña</option>
            <option value="_blank">Una pestaña nueva</option>
          </select>
        </Field>
      </Section>

      {error ? (
        <p role="alert" className="text-[13px] text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="admin-btn admin-btn--primary" onClick={save} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar bloque'}
        </button>
        <button type="button" className="admin-btn" onClick={onDuplicate} disabled={pending}>
          Duplicar
        </button>
        <button type="button" className="admin-btn admin-btn--danger" onClick={onDelete} disabled={pending}>
          Eliminar
        </button>
      </div>
    </>
  );
}

function AssetPreview({ asset }: { asset: EditorAsset | undefined }) {
  if (!asset) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] p-2">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-[var(--admin-surface)]">
        {asset.isSvg ? (
          <span className="flex h-full items-center justify-center text-[11px]">SVG</span>
        ) : (
          <Image src={asset.url} alt="" fill sizes="56px" className="object-contain" unoptimized />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--admin-muted)]">
        {asset.filename}
        {asset.width ? ` · ${asset.width}×${asset.height}` : ''}
      </p>
    </div>
  );
}
