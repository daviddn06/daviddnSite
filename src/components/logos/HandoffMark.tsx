// Generated from the brand's own artwork. Source: handofflease.com/assets/favicon.svg (Projects/Handoff/code/handoff-app/marketing/assets/favicon.svg), the H drawn as filled rects of the same geometry
// Motion lives in logos.css, scoped by the wrapper class. Do not hand-edit path data.
import { markSvg, type MarkProps } from './types';

export function HandoffMark({ uid, box }: MarkProps) {
  return (
    <svg {...markSvg('6 6 52 52', '14 11 36 42', box)}>
      <defs>
        <clipPath id={`${uid}gap`}>
          <rect x="21.9" y="0" width="20.2" height="64" />
        </clipPath>
      </defs>
      <rect className="h-l" x="14" y="11" width="8" height="42" />
      <rect className="h-r" x="42" y="11" width="8" height="42" />
      <g clipPath={`url(#${uid}gap)`}>
        <rect className="h-bar" x="21.9" y="28" width="20.2" height="8" />
      </g>
    </svg>
  );
}
