import { useId, useRef, type CSSProperties, type ComponentType } from 'react';
import './logos.css';
import type { MarkProps } from './types';
import { useLogoPlay } from './useLogoPlay';
import { VeckaMark } from './VeckaMark';
import { WedgeMark } from './WedgeMark';
import { SightpaneMark } from './SightpaneMark';
import { ReveMark } from './ReveMark';
import { ShoSoftMark } from './ShoSoftMark';
import { HandoffMark } from './HandoffMark';
import { DigitalEnterpriseMark } from './DigitalEnterpriseMark';
import { HyreMark } from './HyreMark';
import { SwireMark } from './SwireMark';
import { DocMark } from './DocMark';

export type LogoMeta = {
  name: string;
  Mark: ComponentType<MarkProps>;
  /** Length of the one-shot hover motion in ms, matches logos.css. */
  duration: number;
};

export const LOGO_META: Record<string, LogoMeta> = {
  shosoft: { name: 'ShoSoft', Mark: ShoSoftMark, duration: 620 },
  wedge: { name: 'Wedge Studio', Mark: WedgeMark, duration: 560 },
  sightpane: { name: 'Sightpane', Mark: SightpaneMark, duration: 560 },
  reve: { name: 'Reve', Mark: ReveMark, duration: 560 },
  vecka: { name: 'Vecka', Mark: VeckaMark, duration: 580 },
  handoff: { name: 'Handoff', Mark: HandoffMark, duration: 580 },
  'digital-enterprise': { name: 'Digital Enterprise', Mark: DigitalEnterpriseMark, duration: 580 },
  hyre: { name: 'HYRE', Mark: HyreMark, duration: 580 },
  swire: { name: 'Swire', Mark: SwireMark, duration: 620 },
  cv: { name: 'Resume', Mark: DocMark, duration: 0 },
};

type Props = {
  slug: string;
  size?: number;
  className?: string;
  /** Ink for the mark, e.g. BRAND[slug].ink on a brand tile. Defaults to currentColor. */
  color?: string;
};

/** A project's real mark, static at rest, one short motion on hover, focus or tap. */
export function ProjectLogo({ slug, size = 36, className, color }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const meta = LOGO_META[slug];
  const uid = 'pl' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useLogoPlay(ref, meta ? meta.duration : 0);
  if (!meta) return null;
  const { Mark, name } = meta;
  const inked = !!color && color !== 'currentColor';
  const style = { '--plogo-size': `${size}px`, ...(inked ? { color } : null) } as CSSProperties;
  return (
    <span
      ref={ref}
      className={`plogo lg-${slug}${inked ? ' plogo--ink' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`${name} logo`}
      style={style}
    >
      <Mark uid={uid} size={size} />
    </span>
  );
}
