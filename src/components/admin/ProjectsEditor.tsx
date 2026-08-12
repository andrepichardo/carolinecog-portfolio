'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProject, updateProject } from '@/lib/actions/content';

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
  published: boolean;
}

export function ProjectsEditor({
  projects,
  pages,
}: {
  projects: ProjectRow[];
  pages: { id: string; title: string }[];
}) {
  if (!projects.length) {
    return <p className="admin-muted">No projects yet.</p>;
  }

  return (
    <div className="border-t border-(--rule-strong)">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} pages={pages} />
      ))}
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
  const router = useRouter();
  const [form, setForm] = useState(project);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    const ok = window.confirm(
      `Delete “${project.name}” and its page?

` +
        'This removes the page and everything on it. It cannot be undone.'
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  const set = <K extends keyof ProjectRow>(key: K, value: ProjectRow[K]) => {
    setForm({ ...form, [key]: value });
    setSaved(false);
  };

  return (
    <details className="admin-fold border-b border-(--rule) py-4">
      <summary>
        <span className="admin-display text-[22px]">{form.name}</span>
        <span className="admin-muted text-[12px]">/{project.pageSlug}</span>
        {!project.published ? <span className="admin-eyebrow">Draft</span> : null}
        <Link
          href={`/admin/pages/${project.pageId}`}
          className="admin-link ml-auto text-[12px]"
          onClick={(e) => e.stopPropagation()}
        >
          Edit canvas
        </Link>
      </summary>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="col-span-2 block">
          <span className="admin-label">Name</span>
          <input
            className="admin-field"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Client</span>
          <input
            className="admin-field"
            value={form.client ?? ''}
            onChange={(e) => set('client', e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Year</span>
          <input
            className="admin-field"
            value={form.year ?? ''}
            onChange={(e) => set('year', e.target.value || null)}
          />
        </label>
        <label className="col-span-2 block">
          <span className="admin-label">Supervision</span>
          <input
            className="admin-field"
            value={form.supervision ?? ''}
            onChange={(e) => set('supervision', e.target.value || null)}
          />
        </label>
        <label className="col-span-2 block">
          <span className="admin-label">Summary (for SEO and listings)</span>
          <textarea
            className="admin-field"
            rows={2}
            value={form.summary ?? ''}
            onChange={(e) => set('summary', e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Order</span>
          <input
            className="admin-field"
            type="number"
            value={form.order}
            onChange={(e) => set('order', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Next project</span>
          <select
            className="admin-field"
            value={form.nextPageId ?? ''}
            onChange={(e) => set('nextPageId', e.target.value || null)}
          >
            <option value="">— none —</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-check col-span-2">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set('featured', e.target.checked)}
          />
          <span>Featured on the home page</span>
        </label>
      </div>

      <div className="mt-5 flex items-center gap-4">
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
          {pending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span className="admin-eyebrow">Saved</span> : null}
        <button
          type="button"
          className="admin-btn admin-btn--danger ml-auto"
          disabled={pending}
          onClick={remove}
        >
          Delete project
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-(--danger)">
          {error}
        </p>
      ) : null}
    </details>
  );
}
