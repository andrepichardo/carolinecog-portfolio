'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
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
          throw new Error(data.error ?? `Error al subir ${file.name}`);
        }
      }
      setMessage('Subida completada');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al subir');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
          {uploading ? 'Subiendo…' : 'Subir imágenes'}
        </button>
        <span className="text-[12px] text-[var(--admin-muted)]">
          PNG, JPG, WebP, AVIF, GIF o SVG · máx. 25 MB
        </span>
      </div>

      {message ? (
        <p className="mb-4 rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-[13px]">{message}</p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {assets.map((asset) => (
          <li key={asset.id} className="admin-card flex flex-col gap-2 p-2">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--admin-surface)]">
              {asset.isSvg ? (
                <span className="flex h-full items-center justify-center text-[12px] text-[var(--admin-muted)]">
                  SVG
                </span>
              ) : (
                <Image
                  src={asset.url}
                  alt={asset.alt ?? ''}
                  fill
                  sizes="200px"
                  className="object-contain"
                  unoptimized
                />
              )}
            </div>

            <p className="truncate text-[12px]" title={asset.filename}>
              {asset.filename}
            </p>
            <p className="text-[11px] text-[var(--admin-muted)]">
              {asset.width ? `${asset.width}×${asset.height}` : '—'} {formatBytes(asset.bytes)}
              {asset.uses ? ` · en uso (${asset.uses})` : ' · sin usar'}
            </p>
            {asset.isExternal ? (
              <p className="text-[11px] text-[var(--admin-muted)]">
                Aún alojada en el CDN original
              </p>
            ) : null}

            <input
              className="admin-field text-[12px]"
              placeholder="Texto alternativo"
              defaultValue={asset.alt ?? ''}
              onBlur={(e) =>
                startTransition(async () => {
                  await updateAssetAlt(asset.id, e.target.value);
                })
              }
            />

            <button
              type="button"
              className="admin-btn admin-btn--danger text-[12px]"
              disabled={pending || asset.uses > 0}
              title={asset.uses > 0 ? 'Está en uso: cámbiala en los bloques antes de borrarla' : undefined}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAsset(asset.id);
                  if (!result.ok) setMessage(result.error);
                  else router.refresh();
                })
              }
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
