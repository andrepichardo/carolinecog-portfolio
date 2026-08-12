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
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...next } : item)),
    );
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
    <div>
      <p className="admin-muted mb-6 max-w-prose">
        These are the links inside the hamburger menu. How it looks — typeface,
        where the panel sits — is edited like any other block, from its page.
      </p>

      <div className="border-t border-(--rule-strong)">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-4 border-b border-(--rule) py-4 sm:grid-cols-[1fr_1fr_auto]"
          >
            <label className="block">
              <span className="admin-label">Label</span>
              <input
                className="admin-field"
                value={item.label}
                onChange={(e) => patch(index, { label: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="admin-label">Destination</span>
              <select
                className="admin-field"
                value={item.pageId ?? ''}
                onChange={(e) =>
                  patch(index, { pageId: e.target.value || null, url: null })
                }
              >
                <option value="">— external URL —</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (/{p.slug})
                  </option>
                ))}
              </select>
              {!item.pageId ? (
                <input
                  className="admin-field mt-3"
                  placeholder="https://…"
                  value={item.url ?? ''}
                  onChange={(e) =>
                    patch(index, { url: e.target.value || null })
                  }
                />
              ) : null}
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => move(index, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => move(index, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost text-(--danger)"
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="admin-btn"
          onClick={() =>
            setItems([...items, { label: 'new', pageId: null, url: '' }])
          }
        >
          + Add item
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveNavItems(items);
              setMessage(result.ok ? 'Menu saved' : result.error);
            })
          }
        >
          {pending ? 'Saving…' : 'Save menu'}
        </button>
        {message ? <span className="admin-eyebrow">{message}</span> : null}
      </div>
    </div>
  );
}
