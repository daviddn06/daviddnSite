// Generated from the brand's own artwork. Source: traced from Archive/Sep2023 Downloads/hyretrans.png (the H mark, March 2023, 1418px), mean edge error 0.19px
// Motion lives in logos.css, scoped by the wrapper class. Do not hand-edit path data.
import { markSvg, type MarkProps } from './types';

const H = 'M128.3 0.6 204 0.1 209 2.4 212.4 7.6 212.8 308.6 212.8 318.6 214 319.8 421 319.6 421.3 217.6 422.5 212.6 617 17.5 622 14.4 626 14.2 631 16.5 633.5 19.6 634.6 23.6 634.7 38.6 634.3 723.6 631.4 742.6 626.5 759.6 617.5 779.6 609.4 792.6 598.2 806.6 588 816.9 571 830.1 557 838.2 544 844.1 532 848.1 520 851 504 853.1 430 853.3 425 851 421.7 846.6 421 534.6 420 533.6 412 533.5 213.8 533.6 213 534.6 212.8 544.6 212.7 635.6 211.6 640.6 17 836 12 839 8 839.1 3 836.9 0.4 833.6 -0.6 830.6 -0.7 824.6 -0.7 146.6 0.5 122.6 5.6 99.6 11.6 83.6 15.6 75.6 28.5 55.6 44 38.4 63 23.4 85 11.4 106 4.3Z';
// Split on the H's centre of symmetry, clips overlap 1.5 units so no seam shows at rest.
export function HyreMark({ uid, box }: MarkProps) {
  return (
    <svg {...markSvg('-182.7 -73.35 1000 1000', '0 0 634.6 853.3', box)}>
      <defs>
        <clipPath id={`${uid}l`}>
          <rect x="-200" y="-200" width="518.8" height="1300" />
        </clipPath>
        <clipPath id={`${uid}r`}>
          <rect x="315.8" y="-200" width="600" height="1300" />
        </clipPath>
      </defs>
      <g className="y-l">
        <path clipPath={`url(#${uid}l)`} d={H} />
      </g>
      <g className="y-r">
        <path clipPath={`url(#${uid}r)`} d={H} />
      </g>
    </svg>
  );
}
