'use client';

import { useState, useTransition } from 'react';
import { saveNavItems } from '@/lib/actions/content';

interface NavRow {
  id?: string;
  label: string;
  pageId: string | null;
  url: string | null;
}

export function NavigationEditor({
  items: initial,
  pages,
}: {
  items: NavRow[];
  pages: { id: string; title: string; slug: string }[];
}) {
  const [items, setItems] = useState<NavRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const patch = (index: number, next: Partial<NavRow>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...next } : item)));
    setMessage(null);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setMessage(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--admin-muted)]">
        Este listado alimenta los enlaces del menú. El aspecto (tipografía, posición del panel) se
        edita como cualquier otro bloque, desde la página correspondiente.
      </p>

      {items.map((item, index) => (
        <div key={index} className="admin-card grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="admin-label">Texto</span>
            <input
              className="admin-field"
              value={item.label}
              onChange={(e) => patch(index, { label: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="admin-label">Destino</span>
            <select
              className="admin-field"
              value={item.pageId ?? ''}
              onChange={(e) => patch(index, { pageId: e.target.value || null, url: null })}
            >
              <option value="">— URL externa —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (/{p.slug})
                </option>
              ))}
            </select>
            {!item.pageId ? (
              <input
                className="admin-field mt-2"
                placeholder="https://…"
                value={item.url ?? ''}
                onChange={(e) => patch(index, { url: e.target.value || null })}
              />
            ) : null}
          </label>
          <div className="flex items-end gap-1">
            <button type="button" className="admin-btn" onClick={() => move(index, -1)} aria-label="Subir">
              ↑
            </button>
            <button type="button" className="admin-btn" onClick={() => move(index, 1)} aria-label="Bajar">
              ↓
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              Quitar
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="admin-btn"
          onClick={() => setItems([...items, { label: 'nuevo', pageId: null, url: '' }])}
        >
          + Añadir entrada
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveNavItems(items);
              setMessage(result.ok ? 'Menú guardado' : result.error);
            })
          }
        >
          {pending ? 'Guardando…' : 'Guardar menú'}
        </button>
        {message ? <span className="text-[13px] text-[var(--admin-muted)]">{message}</span> : null}
      </div>
    </div>
  );
}
