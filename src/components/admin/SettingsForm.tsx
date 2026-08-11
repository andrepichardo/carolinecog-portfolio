'use client';

import { useState, useTransition } from 'react';
import { updateSettings } from '@/lib/actions/content';

interface Settings {
  siteTitle: string;
  metaDescription: string;
  backgroundColor: string;
  email: string;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  adobeFontsKit: string | null;
  faviconId: string | null;
  ogImageId: string | null;
}

export function SettingsForm({
  settings,
  assets,
}: {
  settings: Settings;
  assets: { id: string; filename: string }[];
}) {
  const [form, setForm] = useState(settings);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm({ ...form, [key]: value });
    setMessage(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card flex flex-col gap-3">
        <h2 className="font-semibold">Identidad</h2>
        <label className="block">
          <span className="admin-label">Título del sitio</span>
          <input
            className="admin-field"
            value={form.siteTitle}
            onChange={(e) => set('siteTitle', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Descripción (SEO y redes)</span>
          <textarea
            className="admin-field"
            rows={3}
            value={form.metaDescription}
            onChange={(e) => set('metaDescription', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Color de fondo</span>
          <input
            className="admin-field"
            value={form.backgroundColor}
            onChange={(e) => set('backgroundColor', e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="admin-label">Favicon</span>
            <select
              className="admin-field"
              value={form.faviconId ?? ''}
              onChange={(e) => set('faviconId', e.target.value || null)}
            >
              <option value="">— por defecto —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="admin-label">Imagen para redes</span>
            <select
              className="admin-field"
              value={form.ogImageId ?? ''}
              onChange={(e) => set('ogImageId', e.target.value || null)}
            >
              <option value="">— ninguna —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="admin-card flex flex-col gap-3">
        <h2 className="font-semibold">Contacto</h2>
        <label className="block">
          <span className="admin-label">Correo</span>
          <input
            className="admin-field"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="admin-label">Instagram</span>
          <input
            className="admin-field"
            value={form.instagramUrl ?? ''}
            onChange={(e) => set('instagramUrl', e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="admin-label">LinkedIn</span>
          <input
            className="admin-field"
            value={form.linkedinUrl ?? ''}
            onChange={(e) => set('linkedinUrl', e.target.value || null)}
          />
        </label>
        <p className="text-[12px] text-[var(--admin-muted)]">
          Estos valores son la referencia del sitio. Los enlaces que ya aparecen en la página de
          contacto se editan en su bloque de texto.
        </p>
      </div>

      <div className="admin-card flex flex-col gap-3">
        <h2 className="font-semibold">Tipografía original</h2>
        <p className="text-[13px] text-[var(--admin-muted)]">
          El portafolio usa cuatro familias. DM Sans es la original y se sirve gratis desde Google
          Fonts. Las otras tres (Aktiv Grotesk, Benton Modern Display Condensed y All Round Gothic)
          son de pago y ahora mismo usan sustitutos libres. Con una suscripción a Creative Cloud se
          puede crear un proyecto web en fonts.adobe.com y pegar aquí su ID para recuperar las
          originales.
        </p>
        <label className="block">
          <span className="admin-label">ID del kit de Adobe Fonts</span>
          <input
            className="admin-field"
            placeholder="p. ej. abc1def"
            value={form.adobeFontsKit ?? ''}
            onChange={(e) => set('adobeFontsKit', e.target.value || null)}
          />
        </label>
        <p className="text-[12px] text-[var(--admin-muted)]">
          Guardarlo aquí lo deja anotado. Para que surta efecto hay que copiarlo también en la
          variable de entorno <code>NEXT_PUBLIC_ADOBE_FONTS_KIT</code> en Vercel y volver a
          desplegar (las fuentes se cargan antes de que arranque la aplicación).
        </p>
      </div>

      {message ? (
        <p className="rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-[13px]">{message}</p>
      ) : null}

      <div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateSettings(form);
              setMessage(result.ok ? 'Ajustes guardados' : result.error);
            })
          }
        >
          {pending ? 'Guardando…' : 'Guardar ajustes'}
        </button>
      </div>
    </div>
  );
}
