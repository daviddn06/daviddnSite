// Generated from the brand's own artwork. Source: measured from Archive/Sep2023 Downloads/avabold.png (1080px), straight-edged letters
// Motion lives in logos.css, scoped by the wrapper class. Do not hand-edit path data.
import { markSvg, type MarkProps } from './types';

const A = 'M95.2 0h62.6l95 265.5h-56.2l-18.1-50.7H74.2L56 265.5H0zM126.4 62l37.9 110.2H88.5z';

export function AvaMark({ box }: MarkProps) {
  return (
    <svg {...markSvg('-28.1 -217.25 700 700', '0 0 643.8 265.5', box)}>
      <path className="a-1" fillRule="evenodd" d={A} />
      <path className="a-v" d="M192.1 0h56.7l72.7 210 73-210h56.4l-97.4 265.5H289z" />
      <g className="a-2">
        <path fillRule="evenodd" transform="translate(391 0)" d={A} />
      </g>
    </svg>
  );
}
