import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import type { BlockData, TextStyleData } from '@/lib/content';
import type { Paragraph, TextRun } from '@/lib/content-types';
import { paragraphVars, resolveParagraph, runVars } from '@/lib/style-utils';

interface TextViewProps {
  block: BlockData;
  textStyles: Map<string, TextStyleData>;
}

interface Segment {
  text: string;
  run?: TextRun;
}

/**
 * Parte el texto de un párrafo en tramos según sus `runs`.
 *
 * Los runs vienen como (inicio, longitud) sobre el texto plano. Se recorren en
 * orden y se rellenan los huecos, de modo que la concatenación de los tramos
 * reproduce el texto original aunque los runs no lo cubran entero.
 */
function segmentize(text: string, runs: TextRun[] | undefined): Segment[] {
  if (!runs?.length) return [{ text }];

  const ordered = [...runs]
    .filter((r) => r.length > 0 && r.start >= 0 && r.start < text.length)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const run of ordered) {
    if (run.start < cursor) continue; //  se ignoran solapes
    if (run.start > cursor) segments.push({ text: text.slice(cursor, run.start) });
    const end = Math.min(run.start + run.length, text.length);
    segments.push({ text: text.slice(run.start, end), run });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return segments.filter((s) => s.text.length > 0);
}

function renderRun(segment: Segment, key: number): ReactNode {
  const { text, run } = segment;
  if (!run) return text;

  const style = runVars(run);
  const inner = <span style={style}>{text}</span>;

  if (!run.link) return <span key={key}>{inner}</span>;

  const { link } = run;
  const href =
    link.kind === 'EMAIL'
      ? `mailto:${link.url ?? ''}`
      : link.kind === 'PAGE'
        ? `/${(link.pageSlug ?? '').replace(/^\/+/, '')}`
        : (link.url ?? '#');

  const isExternal = /^(https?:|mailto:|tel:)/.test(href);

  return isExternal ? (
    <a
      key={key}
      href={href}
      className="rm-link"
      target={link.target === '_blank' ? '_blank' : undefined}
      rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
    >
      {inner}
    </a>
  ) : (
    <Link key={key} href={href} className="rm-link">
      {inner}
    </Link>
  );
}

function ParagraphView({
  paragraph,
  textStyles,
  index,
}: {
  paragraph: Paragraph;
  textStyles: Map<string, TextStyleData>;
  index: number;
}) {
  const named = paragraph.styleKey ? textStyles.get(paragraph.styleKey) : undefined;
  const resolved = resolveParagraph(paragraph, named);
  const segments = segmentize(paragraph.text, paragraph.runs);

  const style = { ...paragraphVars(resolved) };
  // El espaciado entre párrafos también va en unidades de diseño para que
  // escale con el lienzo.
  if (paragraph.paddingTop) {
    style.paddingTop = `calc(${paragraph.paddingTop} * var(--u))`;
  }
  if (paragraph.paddingBottom) {
    style.paddingBottom = `calc(${paragraph.paddingBottom} * var(--u))`;
  }

  return (
    <p className="rm-p" style={style} data-p={index}>
      {segments.map(renderRun)}
    </p>
  );
}

export function TextView({ block, textStyles }: TextViewProps) {
  const desktop = block.text?.paragraphs ?? [];
  const mobile = block.mobileText?.paragraphs;

  // La mayoría de bloques comparten el texto entre viewports y solo cambian los
  // tamaños; cuando el móvil trae contenido propio se rendericen ambos y el
  // breakpoint oculta el que no toca.
  if (mobile && mobile.length) {
    return (
      <>
        <div className="rm-text rm-only-desktop" style={verticalAlign(block)}>
          {desktop.map((p, i) => (
            <ParagraphView key={i} paragraph={p} textStyles={textStyles} index={i} />
          ))}
        </div>
        <div className="rm-text rm-only-mobile" style={verticalAlign(block)}>
          {mobile.map((p, i) => (
            <ParagraphView key={i} paragraph={p} textStyles={textStyles} index={i} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="rm-text" style={verticalAlign(block)}>
      {desktop.map((p, i) => (
        <ParagraphView key={i} paragraph={p} textStyles={textStyles} index={i} />
      ))}
    </div>
  );
}

function verticalAlign(block: BlockData): CSSProperties {
  const align = (block.text as { verticalAlign?: string } | null)?.verticalAlign;
  if (align === 'middle') return { display: 'flex', flexDirection: 'column', justifyContent: 'center' };
  if (align === 'bottom') return { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' };
  return {};
}
