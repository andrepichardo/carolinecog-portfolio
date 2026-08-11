'use client';

import { useState, useTransition } from 'react';
import { signInAction } from '@/lib/actions/auth';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [error, setError] = useState<string | null>(
    initialError ? 'No se pudo iniciar sesión. Revisa el correo y la contraseña.' : null
  );
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="admin-card flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signInAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="next" value={next ?? '/admin'} />

      <div>
        <label className="admin-label" htmlFor="email">
          Correo
        </label>
        <input
          className="admin-field"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="admin-label" htmlFor="password">
          Contraseña
        </label>
        <input
          className="admin-field"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <button className="admin-btn admin-btn--primary" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
