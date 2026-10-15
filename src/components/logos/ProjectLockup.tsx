import { useId, useRef, type CSSProperties } from 'react';
import './logos.css';
import { LOGO_META } from './ProjectLogo';
import { LOCKUPS } from './wordmarks';
import { useLogoPlay } from './useLogoPlay';

type Props = {
  slug: string;
  /** Rendered height in px, the width follows the brand's own proportions. */
  height?: number;
  className?: string;
  /** Ink for mark and wordmark, e.g. BRAND[slug].ink on a brand tile. Defaults to currentColor. */
  color?: string;
};

/** A project's full lockup, its real mark plus its real wordmark. Same motion
    contract as ProjectLogo, the wordmark breathes a little with the mark. */
export function ProjectLockup({ slug, height = 28, className, color }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const meta = LOGO_META[slug];
  const lk = LOCKUPS[slug];
  const uid = 'pk' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useLogoPlay(ref, meta ? meta.duration : 0);
  if (!meta || !lk) return null;
  const { Mark, name } = meta;
  const [, , vw, vh] = lk.vb.split(/\s+/).map(Number);
  const inked = !!color && color !== 'currentColor';
  const style = {
    '--plogo-size': `${height}px`,
    inlineSize: `${Math.round(((height * vw) / vh) * 10) / 10}px`,
    ...(inked ? { color } : null),
  } as CSSProperties;
  const wordStyle = { '--pl-dx': `${lk.dx}px` } as CSSProperties;
  return (
    <span
      ref={ref}
      className={`plogo plock lg-${slug}${inked ? ' plogo--ink' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={name}
      style={style}
    >
      <svg viewBox={lk.vb} aria-hidden="true" focusable="false">
        <Mark uid={uid} box={lk.mark} />
        <g className="pl-word" style={wordStyle}>
          <path d={lk.word} transform={lk.wordTransform} fillRule={lk.rule} />
        </g>
      </svg>
    </span>
  );
}
