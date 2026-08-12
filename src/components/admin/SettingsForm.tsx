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
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="admin-eyebrow border-t border-(--rule-strong) pt-2 pb-5">
          Identity
        </h2>
        <div className="flex flex-col gap-5">
          <label className="block">
            <span className="admin-label">Site title</span>
            <input
              className="admin-field"
              value={form.siteTitle}
              onChange={(e) => set('siteTitle', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="admin-label">Description (search and social)</span>
            <textarea
              className="admin-field"
              rows={3}
              value={form.metaDescription}
              onChange={(e) => set('metaDescription', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="admin-label">Background colour</span>
            <input
              className="admin-field"
              value={form.backgroundColor}
              onChange={(e) => set('backgroundColor', e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-5">
            <label className="block">
              <span className="admin-label">Favicon</span>
              <select
                className="admin-field"
                value={form.faviconId ?? ''}
                onChange={(e) => set('faviconId', e.target.value || null)}
              >
                <option value="">— default —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.filename}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="admin-label">Social share image</span>
              <select
                className="admin-field"
                value={form.ogImageId ?? ''}
                onChange={(e) => set('ogImageId', e.target.value || null)}
              >
                <option value="">— none —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.filename}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section>
        <h2 className="admin-eyebrow border-t border-(--rule-strong) pt-2 pb-5">
          Contact
        </h2>
        <div className="flex flex-col gap-5">
          <label className="block">
            <span className="admin-label">Email</span>
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
          <p className="admin-muted text-[12px]">
            These are the site&rsquo;s reference values. The links shown on the
            contact page are edited in their own text block.
          </p>
        </div>
      </section>

      <section>
        <h2 className="admin-eyebrow border-t border-(--rule-strong) pt-2 pb-5">
          Original typefaces
        </h2>
        <p className="admin-muted mb-5 max-w-prose">
          The portfolio uses four families. DM Sans is the original and is
          served free from Google Fonts. The other three — Aktiv Grotesk, Benton
          Modern Display Condensed and All Round Gothic — are commercial and
          currently use free stand-ins. With a Creative Cloud subscription you
          can make a web project at fonts.adobe.com and paste its ID here to get
          the originals back.
        </p>
        <label className="block">
          <span className="admin-label">Adobe Fonts kit ID</span>
          <input
            className="admin-field"
            placeholder="e.g. abc1def"
            value={form.adobeFontsKit ?? ''}
            onChange={(e) => set('adobeFontsKit', e.target.value || null)}
          />
        </label>
        <p className="admin-muted mt-3 text-[12px]">
          Saving it here keeps a note of it. To take effect it also has to go
          into the <code>NEXT_PUBLIC_ADOBE_FONTS_KIT</code> environment variable
          on Vercel, followed by a redeploy — the fonts load before the app
          starts.
        </p>
      </section>

      <div className="flex items-center gap-4 border-t border-(--rule-strong) pt-5">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateSettings(form);
              setMessage(result.ok ? 'Settings saved' : result.error);
            })
          }
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {message ? <span className="admin-eyebrow">{message}</span> : null}
      </div>
    </div>
  );
}
