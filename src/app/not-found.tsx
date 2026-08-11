import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <p
        className="text-[clamp(3rem,12vw,7rem)] leading-none"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        404
      </p>
      <p className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>
        This page doesn&rsquo;t exist.
      </p>
      <Link
        href="/"
        className="text-lg underline underline-offset-4"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        Back to work
      </Link>
    </main>
  );
}
