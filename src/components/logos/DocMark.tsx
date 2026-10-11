// The resume's mark, a page with a folded corner and three lines of text,
// drawn for the site (no brand of its own). Solid, so the screen can draw
// it as phosphor like the project logos.
import { markSvg, type MarkProps } from './types';

const PAGE = 'M6 2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'
  + 'M14 3.6V8h4.4z'
  + 'M7.5 11h9v1.6h-9zM7.5 14.2h9v1.6h-9zM7.5 17.4h6v1.6h-6z';

export function DocMark(_: MarkProps) {
  return (
    <svg {...markSvg('0 0 24 24', '4 2 16 20', _.box)}>
      <path fillRule="evenodd" d={PAGE} />
    </svg>
  );
}
