import { requireUser } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/admin/AdminShell';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireUser();

  const [settings, assets] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, filename: true },
    }),
  ]);

  return (
    <AdminShell title="Settings" description="Site identity, contact details and global typography.">
      <SettingsForm
        settings={{
          siteTitle: settings?.siteTitle ?? 'Caroline Contreras',
          metaDescription: settings?.metaDescription ?? '',
          backgroundColor: settings?.backgroundColor ?? '#efefef',
          email: settings?.email ?? '',
          instagramUrl: settings?.instagramUrl ?? null,
          linkedinUrl: settings?.linkedinUrl ?? null,
          adobeFontsKit: settings?.adobeFontsKit ?? null,
          faviconId: settings?.faviconId ?? null,
          ogImageId: settings?.ogImageId ?? null,
        }}
        assets={assets}
      />
    </AdminShell>
  );
}
