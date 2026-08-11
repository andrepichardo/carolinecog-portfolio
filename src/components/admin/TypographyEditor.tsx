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

const TOKENS = [
  { value: 'SANS', label: 'DM Sans (original)' },
  { value: 'GROTESK', label: 'Inter (sustituye a Aktiv Grotesk)' },
  { value: 'DISPLAY', label: 'Instrument Serif (sustituye a Benton Modern)' },
  { value: 'ROUND', label: 'Poppins (sustituye a All Round Gothic)' },
];

const FONT_VAR: Record<string, string> = {
  SANS: 'var(--font-sans)',
  GROTESK: 'var(--font-grotesk)',
  DISPLAY: 'var(--font-display)',
  ROUND: 'var(--font-round)',
};

export function TypographyEditor({ styles }: { styles: Style[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--admin-muted)]">
        Los tamaños están en unidades de diseño (1024 de ancho en escritorio), no en píxeles: el
        sitio los escala solo según la pantalla.
      </p>
      {styles.map((style) => (
        <StyleRow key={style.id} style={style} />
      ))}
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
    <details className="admin-card">
      <summary className="flex cursor-pointer items-center gap-3">
        <span className="font-medium">{form.label}</span>
        <span
          className="ml-auto truncate text-[var(--admin-muted)]"
          style={{
            fontFamily: FONT_VAR[form.fontToken],
            fontWeight: form.fontWeight,
            fontSize: Math.min(form.fontSize, 22),
            letterSpacing: `${form.letterSpacing / 20}em`,
            textTransform: form.textTransform as never,
            color: form.color,
          }}
        >
          Aa Bb Cc
        </span>
      </summary>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 block sm:col-span-3">
          <span className="admin-label">Nombre</span>
          <input
            className="admin-field"
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
          />
        </label>

        <label className="col-span-2 block sm:col-span-3">
          <span className="admin-label">Familia</span>
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
            <span className="admin-label">Tamaño óptico</span>
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
          <span className="admin-label">Grosor</span>
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
          <span className="admin-label">Cuerpo</span>
          <input
            className="admin-field"
            type="number"
            value={form.fontSize}
            onChange={(e) => set('fontSize', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="admin-label">Interlineado</span>
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
          <span className="admin-label">Caja</span>
          <select
            className="admin-field"
            value={form.textTransform}
            onChange={(e) => set('textTransform', e.target.value)}
          >
            <option value="none">Normal</option>
            <option value="uppercase">MAYÚSCULAS</option>
            <option value="lowercase">minúsculas</option>
            <option value="capitalize">Capitalizada</option>
          </select>
        </label>
        <label className="block">
          <span className="admin-label">Alineación</span>
          <select
            className="admin-field"
            value={form.textAlign}
            onChange={(e) => set('textAlign', e.target.value)}
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
            <option value="justify">Justificado</option>
          </select>
        </label>
        <label className="block">
          <span className="admin-label">Color</span>
          <input
            className="admin-field"
            value={form.color}
            onChange={(e) => set('color', e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
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
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {saved ? <span className="text-[13px] text-[var(--admin-muted)]">Guardado</span> : null}
      </div>
    </details>
  );
}
