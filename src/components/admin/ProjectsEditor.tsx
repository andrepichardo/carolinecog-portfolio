'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { updateProject } from '@/lib/actions/content';

interface ProjectRow {
  id: string;
  name: string;
  client: string | null;
  year: string | null;
  supervision: string | null;
  summary: string | null;
  order: number;
  featured: boolean;
  nextPageId: string | null;
  pageTitle: string;
  pageSlug: string;
  pageId: string;
}

export function ProjectsEditor({
  projects,
  pages,
}: {
  projects: ProjectRow[];
  pages: { id: string; title: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} pages={pages} />
      ))}
      {!projects.length ? (
        <p className="admin-card text-[13px] text-[var(--admin-muted)]">
          Todavía no hay proyectos.
        </p>
      ) : null}
    </div>
  );
}

function ProjectCard({
  project,
  pages,
}: {
  project: ProjectRow;
  pages: { id: string; title: string }[];
}) {
  const [form, setForm] = useState(project);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof ProjectRow>(key: K, value: ProjectRow[K]) => {
    setForm({ ...form, [key]: value });
    setSaved(false);
  };

  return (
    <details className="admin-card">
      <summary className="flex cursor-pointer items-center gap-3">
        <span className="font-medium">{form.name}</span>
        <span className="text-[13px] text-[var(--admin-muted)]">/{project.pageSlug}</span>
        <Link
          href={`/admin/pages/${project.pageId}`}
          className="ml-auto text-[13px] underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Editar lienzo
        </Link>
      </summary>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="admin-label">Nombre</span>
          <input className="admin-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="block">
          <span className="admin-label">Cliente</span>
          <input
            className="admin-field"
            value={form.client ?? ''}
            onChange={(e) => set('client', e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Año</span>
          <input
            className="admin-field"
            value={form.year ?? ''}
            onChange={(e) => set('year', e.target.value || null)}
          />
        </label>
        <label className="col-span-2 block">
          <span className="admin-label">Supervisión</span>
          <input
            className="admin-field"
            value={form.supervision ?? ''}
            onChange={(e) => set('supervision', e.target.value || null)}
          />
        </label>
        <label className="col-span-2 block">
          <span className="admin-label">Resumen (para SEO y listados)</span>
          <textarea
            className="admin-field"
            rows={2}
            value={form.summary ?? ''}
            onChange={(e) => set('summary', e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Orden</span>
          <input
            className="admin-field"
            type="number"
            value={form.order}
            onChange={(e) => set('order', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Siguiente proyecto</span>
          <select
            className="admin-field"
            value={form.nextPageId ?? ''}
            onChange={(e) => set('nextPageId', e.target.value || null)}
          >
            <option value="">— ninguno —</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set('featured', e.target.checked)}
          />
          <span>Destacado en la portada</span>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateProject(form);
              setSaved(result.ok);
            })
          }
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {saved ? <span className="text-[13px] text-[var(--admin-muted)]">Guardado</span> : null}
      </div>
    </details>
  );
}
