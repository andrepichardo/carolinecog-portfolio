import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';
import { ProjectsEditor } from '@/components/admin/ProjectsEditor';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  await requireUser();

  const [projects, pages] = await Promise.all([
    prisma.project.findMany({
      orderBy: { order: 'asc' },
      include: { page: { select: { title: true, slug: true, id: true } } },
    }),
    prisma.page.findMany({
      where: { kind: 'PROJECT' },
      orderBy: { order: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <AdminShell
      title="Proyectos"
      description="Ficha técnica y orden. El contenido visual se edita en cada página."
    >
      <ProjectsEditor
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client,
          year: p.year,
          supervision: p.supervision,
          summary: p.summary,
          order: p.order,
          featured: p.featured,
          nextPageId: p.nextPageId,
          pageTitle: p.page.title,
          pageSlug: p.page.slug,
          pageId: p.page.id,
        }))}
        pages={pages}
      />
    </AdminShell>
  );
}
