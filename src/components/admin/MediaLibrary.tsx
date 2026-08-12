'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteAsset, updateAssetAlt } from '@/lib/actions/content';

interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  alt: string | null;
  isSvg: boolean;
  width: number | null;
  height: number | null;
  bytes: number | null;
  uses: number;
  usedOn: { id: string; title: string }[];
  isExternal: boolean;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary({ assets }: { assets: MediaAsset[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/upload', { method: 'POST', body });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? `Could not upload ${file.name}`);
        }
      }
      setMessage('Upload complete');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (asset: MediaAsset) => {
    if (asset.uses > 0) {
      const where = asset.usedOn.map((p) => p.title).join(', ');
      const ok = window.confirm(
        `“${asset.filename}” is used by ${asset.uses} block(s) on: ${where}.\n\n` +
          'Deleting it leaves those blocks without an image — the pages keep working, ' +
          'and you can pick another image for them in the editor.\n\nDelete anyway?'
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await deleteAsset(asset.id, asset.uses > 0);
      if (!result.ok) setMessage(result.error);
      else {
        setMessage('Image deleted');
        router.refresh();
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 border-b border-(--rule-strong) pb-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload images'}
        </button>
        <span className="admin-muted text-[12px]">
          PNG, JPG, WebP, AVIF, GIF or SVG · 25 MB max
        </span>
        {message ? (
          <span className="admin-eyebrow ml-auto" role="status">
            {message}
          </span>
        ) : null}
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {assets.map((asset) => (
          <li key={asset.id} className="flex flex-col gap-2">
            <div className="flex aspect-square items-center justify-center overflow-hidden border border-(--rule) bg-(--paper-raised) p-2">
              {/* Plain <img> on purpose: next/image does not optimise SVG, and
                  loading an SVG this way keeps any script inside it inert. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.alt ?? ''}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <p className="truncate text-[12px]" title={asset.filename}>
              {asset.filename}
            </p>
            <p className="admin-muted text-[11px]">
              {asset.width ? `${asset.width}×${asset.height}` : '—'} {formatBytes(asset.bytes)}
              {asset.isSvg ? ' · SVG' : ''}
            </p>

            {asset.uses > 0 ? (
              <p className="admin-muted text-[11px]">
                Used {asset.uses}× on{' '}
                {asset.usedOn.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 ? ', ' : ''}
                    <Link href={`/admin/pages/${p.id}`} className="admin-link">
                      {p.title}
                    </Link>
                  </span>
                ))}
              </p>
            ) : (
              <p className="admin-muted text-[11px]">Not used</p>
            )}

            {asset.isExternal ? (
              <p className="admin-muted text-[11px]">Still on the original CDN</p>
            ) : null}

            <label className="block">
              <span className="sr-only">Alt text for {asset.filename}</span>
              <input
                className="admin-field text-[12px]"
                placeholder="Alt text"
                // Sin esto el navegador rellena solo el campo (no tiene
                // etiqueta visible ni nombre) y el guardado al perder el foco
                // acaba escribiendo una URL como texto alternativo.
                name={`alt-${asset.id}`}
                autoComplete="off"
                defaultValue={asset.alt ?? ''}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  // Solo se escribe si de verdad cambió: así un foco accidental
                  // no genera una escritura silenciosa.
                  if (next === (asset.alt ?? '')) return;
                  startTransition(async () => {
                    await updateAssetAlt(asset.id, next);
                    router.refresh();
                  });
                }}
              />
            </label>

            <button
              type="button"
              className="admin-btn admin-btn--ghost self-start text-(--danger)"
              disabled={pending}
              onClick={() => remove(asset)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
