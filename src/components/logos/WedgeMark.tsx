// Generated from the brand's own artwork. Source: Work/Wedge/brand/logo-2026-10/final-opening/ (Opening, geometry B,
// approved 2026-10-13), the master path and the 16, 20, 24 and 32 px size masters from svg/mark/size-masters.
// Motion lives in logos.css, scoped by the wrapper class. Do not hand-edit path data.
import { markSvg, type MarkProps } from './types';
import { OpeningMark } from './opening';

/** the master, viewBox 0 0 100 100 */
const MASTER = 'M12.000 0.000 L76.590 0.000 A3.000 3.000 0 0 1 78.922 4.888 L17.185 81.127 A1.200 1.200 0 0 0 18.873 82.815 L95.112 21.078 A3.000 3.000 0 0 1 100.000 23.410 L100.000 88.000 A12.000 12.000 0 0 1 88.000 100.000 L12.000 100.000 A12.000 12.000 0 0 1 0.000 88.000 L0.000 12.000 A12.000 12.000 0 0 1 12.000 0.000 Z';

/** size masters, each in a viewBox of its own size */
const MASTERS: Record<number, string> = {
  16: 'M2.680 1.000 L9.649 1.000 A0.700 0.700 0 0 1 10.222 2.102 L3.159 12.188 A0.420 0.420 0 0 0 3.206 12.726 L3.274 12.794 A0.420 0.420 0 0 0 3.812 12.841 L13.898 5.778 A0.700 0.700 0 0 1 15.000 6.351 L15.000 13.320 A1.680 1.680 0 0 1 13.320 15.000 L2.680 15.000 A1.680 1.680 0 0 1 1.000 13.320 L1.000 2.680 A1.680 1.680 0 0 1 2.680 1.000 Z',
  20: 'M3.920 2.000 L12.660 2.000 A0.640 0.640 0 0 1 13.174 3.021 L4.121 15.256 A0.320 0.320 0 0 0 4.152 15.672 L4.328 15.848 A0.320 0.320 0 0 0 4.744 15.879 L16.979 6.826 A0.640 0.640 0 0 1 18.000 7.340 L18.000 16.080 A1.920 1.920 0 0 1 16.080 18.000 L3.920 18.000 A1.920 1.920 0 0 1 2.000 16.080 L2.000 3.920 A1.920 1.920 0 0 1 3.920 2.000 Z',
  24: 'M4.400 2.000 L16.251 2.000 A0.600 0.600 0 0 1 16.727 2.965 L4.281 19.186 A0.240 0.240 0 0 0 4.301 19.501 L4.499 19.699 A0.240 0.240 0 0 0 4.814 19.719 L21.035 7.273 A0.600 0.600 0 0 1 22.000 7.749 L22.000 19.600 A2.400 2.400 0 0 1 19.600 22.000 L4.400 22.000 A2.400 2.400 0 0 1 2.000 19.600 L2.000 4.400 A2.400 2.400 0 0 1 4.400 2.000 Z',
  32: 'M6.120 3.000 L22.279 3.000 A0.780 0.780 0 0 1 22.889 4.266 L5.563 26.047 A0.252 0.252 0 0 0 5.582 26.382 L5.618 26.418 A0.252 0.252 0 0 0 5.953 26.437 L27.734 9.111 A0.780 0.780 0 0 1 29.000 9.721 L29.000 25.880 A3.120 3.120 0 0 1 25.880 29.000 L6.120 29.000 A3.120 3.120 0 0 1 3.000 25.880 L3.000 6.120 A3.120 3.120 0 0 1 6.120 3.000 Z',
};

/* While it moves, two half planes turn about the hinge (10, 90) inside a clip of the r 12 block. */
const CLIP = <rect width="100" height="100" rx="12" />;
const PLANES = (
  <>
    <rect className="o-u" x="-200" y="-310" width="400" height="400" />
    <rect className="o-l" x="-200" y="90" width="400" height="400" />
  </>
);

export function WedgeMark({ uid, box, size }: MarkProps) {
  return (
    <svg {...markSvg('-10 -10 120 120', '0 0 100 100', box)}>
      <OpeningMark uid={uid} size={size} master={MASTER} masters={MASTERS} clip={CLIP} planes={PLANES} />
    </svg>
  );
}
