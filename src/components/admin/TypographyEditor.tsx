'use client';

import { useState, useTransition } from 'react';
import { updateTextStyle } from '@/lib/actions/content';

type FontToken = 'SANS' | 'GROTESK' | 'DISPLAY' | 'ROUND';

interface Style {
  id: string;
  key: string;
  label: string;
  fontToken: FontToken;
  fontOpticalSize: number | null;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform: string;
  textAlign: string;
  color: string;
}

const TOKENS: { value: FontToken; label: string }[] = [
  { value: 'SANS', label: 'DM Sans — the original' },
  { value: 'GROTESK', label: 'Inter — stands in for Aktiv Grotesk' },
  { value: 'DISPLAY', label: 'Instrument Serif — stands in for Benton Modern' },
  { value: 'ROUND', label: 'Poppins — stands in for All Round Gothic' },
];

const FONT_VAR: Record<FontToken, string> = {
  SANS: 'var(--font-sans)',
  GROTESK: 'var(--font-grotesk)',
  DISPLAY: 'var(--font-display)',
  ROUND: 'var(--font-round)',
};

export function TypographyEditor({ styles }: { styles: Style[] }) {
  return (
    <div>
      <p className="admin-muted mb-6 max-w-prose">
        Sizes are in design units — 1024 across on desktop — not pixels. The
        site scales them to each screen on its own.
      </p>
      <div className="border-t border-(--rule-strong)">
        {styles.map((style) => (
          <StyleRow key={style.id} style={style} />
        ))}
      </div>
    </div>
  );
}

function StyleRow({ style }: { style: Style }) {
  const [form, setForm] = useState(style);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Style>(key: K, value: Style[K]) => {
    setForm({ ...form, [key]: value });
    setSaved(false);
  };

  return (
    <details className="admin-fold border-b border-(--rule) py-3">
      <summary>
        <span className="min-w-0 flex-1 truncate">{form.label}</span>
        <span
          className="ml-auto truncate"
          style={{
            fontFamily: FONT_VAR[form.fontToken],
            fontWeight: form.fontWeight,
            fontSize: Math.min(form.fontSize, 24),
            letterSpacing: `${form.letterSpacing / 20}em`,
            textTransform: form.textTransform as never,
            color: form.color,
          }}
        >
          Aa Bb Cc
        </span>
      </summary>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="col-span-2 block sm:col-span-3">
          <span className="admin-label">Name</span>
          <input
            className="admin-field"
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
          />
        </label>

        <label className="col-span-2 block sm:col-span-3">
          <span className="admin-label">Typeface</span>
          <select
            className="admin-field"
            value={form.fontToken}
            onChange={(e) => set('fontToken', e.target.value as FontToken)}
          >
            {TOKENS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {form.fontToken === 'SANS' ? (
          <label className="block">
            <span className="admin-label">Optical size</span>
            <select
              className="admin-field"
              value={form.fontOpticalSize ?? 14}
              onChange={(e) => set('fontOpticalSize', Number(e.target.value))}
            >
              <option value={9}>9 pt</option>
              <option value={14}>14 pt</option>
              <option value={18}>18 pt</option>
              <option value={36}>36 pt</option>
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="admin-label">Weight</span>
          <input
            className="admin-field"
            type="number"
            step={100}
            min={100}
            max={900}
            value={form.fontWeight}
            onChange={(e) => set('fontWeight', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Size</span>
          <input
            className="admin-field"
            type="number"
            value={form.fontSize}
            onChange={(e) => set('fontSize', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Leading</span>
          <input
            className="admin-field"
            type="number"
            value={form.lineHeight}
            onChange={(e) => set('lineHeight', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Tracking</span>
          <input
            className="admin-field"
            type="number"
            step={0.1}
            value={form.letterSpacing}
            onChange={(e) => set('letterSpacing', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Case</span>
          <select
            className="admin-field"
            value={form.textTransform}
            onChange={(e) => set('textTransform', e.target.value)}
          >
            <option value="none">Normal</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
            <option value="capitalize">Capitalised</option>
          </select>
        </label>
        <label className="block">
          <span className="admin-label">Align</span>
          <select
            className="admin-field"
            value={form.textAlign}
            onChange={(e) => set('textAlign', e.target.value)}
          >
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </label>
        <label className="block">
          <span className="admin-label">Colour</span>
          <input
            className="admin-field"
            value={form.color}
            onChange={(e) => set('color', e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateTextStyle(form);
              setSaved(result.ok);
            })
          }
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span className="admin-eyebrow">Saved</span> : null}
      </div>
    </details>
  );
}
