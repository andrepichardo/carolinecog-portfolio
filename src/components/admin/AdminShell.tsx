import Link from 'next/link';
import { signOutAction } from '@/lib/actions/auth';
import { AdminNav } from './AdminNav';

export function AdminShell({
  children,
  title,
  description,
  actions,
  wide,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:block">
        <Link href="/admin" className="mb-6 block font-semibold tracking-tight">
          Caroline Contreras
        </Link>
        <AdminNav />
        <form action={signOutAction} className="mt-8">
          <button type="submit" className="admin-btn w-full">
            Cerrar sesión
          </button>
        </form>
        <Link
          href="/"
          target="_blank"
          className="mt-3 block text-center text-[12px] text-[var(--admin-muted)] underline underline-offset-2"
        >
          Ver el sitio
        </Link>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-3 border-b border-[var(--admin-border)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-[13px] text-[var(--admin-muted)]">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
        <main className={wide ? 'p-4' : 'mx-auto max-w-3xl p-6'}>{children}</main>
      </div>
    </div>
  );
}
