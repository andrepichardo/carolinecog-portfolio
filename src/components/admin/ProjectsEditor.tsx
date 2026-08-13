'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProject, reorderProjects, updateProject } from '@/lib/actions/content';

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
    <div>
      <OrderList projects={projects} />
      <div className="border-t border-(--rule-strong)">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} pages={pages} />
        ))}
      </div>
    </div>
  );
}

/**
 * Orden de los proyectos, arrastrando.
 *
 * Sustituye al campo numérico que había en cada ficha: para mover un proyecto
 * un puesto había que abrir dos fichas, calcular los números y guardarlas por
 * separado, y nada impedía dejar dos con el mismo. Aquí el orden se ve entero
 * de un vistazo y es el que se guarda.
 *
 * Se arrastra con la API nativa de HTML —basta para una lista corta y sale
 * gratis en accesibilidad— y además hay flechas, que es lo único que funciona
 * con teclado y en pantallas táctiles.
 */
function OrderList({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Si el servidor devuelve otra lista (se creó o borró un proyecto), manda esa.
  useEffect(() => setItems(projects), [projects]);

  const dirty = items.some((item, i) => item.id !== projects[i]?.id);

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = items.findIndex((p) => p.id === fromId);
    const to = items.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
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
    <section className="mb-10">
      <p className="admin-label">Order</p>
      <p className="admin-muted mt-1 mb-4 max-w-prose text-[13px]">
        The order projects appear in listings. Drag a row, or use the arrows.
      </p>

      <ol className="border-t border-(--rule-strong)">
        {items.map((project, index) => (
          <li
            key={project.id}
            draggable
            onDragStart={(e) => {
              setDragging(project.id);
              e.dataTransfer.effectAllowed = 'move';
              // Firefox no inicia el arrastre sin datos en el portapapeles.
              e.dataTransfer.setData('text/plain', project.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (over !== project.id) setOver(project.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragging ?? e.dataTransfer.getData('text/plain');
              if (from) reorder(from, project.id);
              setDragging(null);
              setOver(null);
            }}
            className={`admin-reorder-row${dragging === project.id ? ' is-dragging' : ''}${
              over === project.id && dragging && dragging !== project.id ? ' is-over' : ''
            }`}
          >
            <span className="admin-reorder-grip" aria-hidden="true">
              ⠿
            </span>
            <span className="admin-muted w-6 text-[12px] tabular-nums">{index + 1}</span>
            <span className="admin-display text-[18px]">{project.name}</span>
            <span className="admin-muted text-[12px]">/{project.pageSlug}</span>
            {!project.published ? <span className="admin-eyebrow">Draft</span> : null}
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${project.name} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move ${project.name} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              const result = await reorderProjects(items.map((p) => p.id));
              setMessage(result.ok ? 'Order saved' : result.error);
              if (result.ok) router.refresh();
            })
          }
        >
          {pending ? 'Saving…' : dirty ? 'Save order' : 'Order saved'}
        </button>
        {dirty ? (
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => {
              setItems(projects);
              setMessage(null);
            }}
          >
            Reset
          </button>
        ) : null}
        {message ? <span className="admin-eyebrow">{message}</span> : null}
      </div>
    </section>
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
        <label className="col-span-2 block">
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
