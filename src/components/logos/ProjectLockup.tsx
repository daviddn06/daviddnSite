import { useId, useRef, type CSSProperties } from 'react';
import './logos.css';
import { LOGO_META } from './ProjectLogo';
import { AvaMark } from './AvaMark';
import { LOCKUPS, type Lockup } from './wordmarks';
import { useLogoPlay } from './useLogoPlay';

type Props = {
  slug: string;
  /** Rendered height in px, the width follows the brand's own proportions. */
  height?: number;
  className?: string;
  /** Ink for mark and wordmark, e.g. BRAND[slug].ink on a brand tile. Defaults to currentColor. */
  color?: string;
};

/* AVA's lockup sets its letters knocked out of a rounded box. The letters
   live in a mask so they can still hop. */
function AvaBox({ uid, lk }: { uid: string; lk: Lockup }) {
  const b = lk.box!;
  return (
    <>
      <defs>
        <mask id={`${uid}m`} maskUnits="userSpaceOnUse" x={b.x - 20} y={b.y - 40} width={b.w + 40} height={b.h + 80}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#fff" />
          <g fill="#000">
            <AvaMark uid={uid} box={lk.mark} />
          </g>
        </mask>
      </defs>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} mask={`url(#${uid}m)`} />
    </>
  );
}

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
        {lk.box ? <AvaBox uid={uid} lk={lk} /> : <Mark uid={uid} box={lk.mark} />}
        <g className="pl-word" style={wordStyle}>
          <path d={lk.word} transform={lk.wordTransform} fillRule={lk.rule} />
        </g>
      </svg>
    </span>
  );
}
