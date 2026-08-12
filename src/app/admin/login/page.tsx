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
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-[320px]">
        <h1 className="admin-display text-[44px]">
          Caroline
          <br />
          Contreras
        </h1>
        <p className="admin-eyebrow mt-3 mb-12">Content</p>
        <LoginForm next={next} initialError={error} />
      </div>
    </main>
  );
}
