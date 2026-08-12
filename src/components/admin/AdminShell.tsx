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
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-(--rule) px-6 py-6 lg:w-60 lg:border-r lg:border-b-0 lg:px-7">
        <Link href="/admin" className="admin-display block text-[26px]">
          Caroline
          <br />
          Contreras
        </Link>
        <p className="admin-eyebrow mt-2">Content</p>

        <div className="mt-7">
          <AdminNav />
        </div>

        <div className="mt-9 flex items-center gap-4">
          <form action={signOutAction}>
            <button type="submit" className="admin-btn admin-btn--ghost">
              Sign out
            </button>
          </form>
          <Link href="/" target="_blank" className="admin-link text-[12px]">
            View site
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-end gap-4 border-b border-(--rule-strong) px-6 py-7 lg:px-10">
          <div className="min-w-0 flex-1">
            <h1 className="admin-display text-[34px]">{title}</h1>
            {description ? (
              <p className="admin-muted mt-1.5 max-w-prose">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
        <main
          className={
            wide ? 'px-6 py-7 lg:px-10' : 'max-w-3xl px-6 py-7 lg:px-10'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
