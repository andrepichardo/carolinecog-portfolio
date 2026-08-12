'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/actions/content';

/** Convierte un nombre en una dirección web usable. */
function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewProject({ templates }: { templates: { id: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : toSlug(name);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createProject({
        name: name.trim(),
        slug: effectiveSlug,
        templatePageId: templateId || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Se abre directamente el lienzo del proyecto nuevo: es lo siguiente
      // que hay que hacer siempre.
      router.push(`/admin/pages/${result.pageId}`);
    });
  };

  if (!open) {
    return (
      <button type="button" className="admin-btn admin-btn--primary" onClick={() => setOpen(true)}>
        + New project
      </button>
    );
  }

  return (
    <div className="w-full border-t border-(--rule-strong) pt-5">
      <h2 className="admin-eyebrow mb-4">New project</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="admin-label">Name</span>
          <input
            className="admin-field"
            value={name}
            autoFocus
            placeholder="Nuvola"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Web address</span>
          <input
            className="admin-field"
            value={effectiveSlug}
            placeholder="nuvola"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(toSlug(e.target.value));
            }}
          />
          <span className="admin-muted mt-1 block text-[11px]">
            The page will live at /{effectiveSlug || '…'}
          </span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="admin-label">Start from</span>
        <select
          className="admin-field"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              A copy of “{t.title}”
            </option>
          ))}
          <option value="">An empty canvas</option>
        </select>
        <span className="admin-muted mt-1 block text-[11px]">
          Copying an existing project keeps its layout, typography and spec table — you just swap
          the words and images. An empty canvas starts with nothing at all.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-4 text-[13px] text-(--danger)">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending || !name.trim() || !effectiveSlug}
          onClick={submit}
        >
          {pending ? 'Creating…' : 'Create project'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </button>
      </div>

      <p className="admin-muted mt-3 text-[12px]">
        It is created as a draft, so nothing appears on the site until you tick Published in the
        editor.
      </p>
    </div>
  );
}
