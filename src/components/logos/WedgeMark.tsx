// Generated from the brand's own artwork. Source: Work/Wedge/brand/mark/wedge-mark-black.svg (the 2026-08-23 hexagon, same geometry as wedgestudio.dev/favicon.svg)
// Motion lives in logos.css, scoped by the wrapper class. Do not hand-edit path data.
import { markSvg, type MarkProps } from './types';

const HEX = 'M12 1.8 21.2 6.9v10.2L12 22.2 2.8 17.1V6.9zM12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z';
// Four layers, cut at the hexagon's own vertex rows (6.9, 17.1) and its middle.
// Each clip overlaps its neighbour by 0.15 so no seam shows at rest.
const BANDS: Array<[number, number]> = [
  [0, 7.05],
  [6.75, 12.15],
  [11.85, 17.25],
  [16.95, 24],
];

export function WedgeMark({ uid, box }: MarkProps) {
  return (
    <svg {...markSvg('0 0 24 24', '2.8 1.8 18.4 20.4', box)}>
      <defs>
        {BANDS.map(([y0, y1], i) => (
          <clipPath id={`${uid}w${i}`} key={i}>
            <rect x="-2" y={y0} width="28" height={y1 - y0} />
          </clipPath>
        ))}
      </defs>
      {BANDS.map((_, i) => (
        <g className={`w-l w-l${i + 1}`} key={i}>
          <path clipPath={`url(#${uid}w${i})`} fillRule="evenodd" d={HEX} />
        </g>
      ))}
    </svg>
  );
}
