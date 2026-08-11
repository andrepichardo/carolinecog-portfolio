import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await auth();
  const { next, error } = await searchParams;
  if (session?.user) redirect(next && next.startsWith('/admin') ? next : '/admin');

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Caroline Contreras</h1>
        <p className="mb-7 text-[var(--admin-muted)]">Panel de contenido</p>
        <LoginForm next={next} initialError={error} />
      </div>
    </main>
  );
}
