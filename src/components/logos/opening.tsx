/* The shared build of Wedge's Opening and Sightpane's Through marks.
   At rest the exact mark (.o-s): the master, or below 40 px the size master
   drawn for that size, fitted to the same 0 to 100 box. While the mark
   moves, two half planes (.o-u, .o-l) turn about the hinge inside a clip of
   the block (.o-g), and the rest path takes over once they stop. The moving
   group is hidden by attribute, so the copy the screen rasterises
   (marks.ts) only ever sees the rest path. */
import type { ReactNode } from 'react';

/* where each size master's art sits inside its own viewBox */
const INSET: Record<number, [number, number]> = { 16: [1, 14], 20: [2, 16], 24: [2, 20], 32: [3, 26] };

const pick = (size?: number) => (!size ? 0 : size <= 18 ? 16 : size <= 22 ? 20 : size <= 28 ? 24 : size <= 36 ? 32 : 0);

type Props = {
  uid: string;
  size?: number;
  master: string;
  masters: Record<number, string>;
  /** the clip shape, in master units */
  clip: ReactNode;
  /** the moving planes, in master units */
  planes: ReactNode;
};

export function OpeningMark({ uid, size, master, masters, clip, planes }: Props) {
  const n = pick(size);
  const [a, s] = INSET[n] ?? [0, 100];
  return (
    <>
      <defs>
        <clipPath id={`${uid}o`}>{clip}</clipPath>
      </defs>
      {n ? (
        <path className="o-s" transform={`scale(${100 / s}) translate(${-a} ${-a})`} d={masters[n]} />
      ) : (
        <path className="o-s" d={master} />
      )}
      <g className="o-g" clipPath={`url(#${uid}o)`} opacity="0">
        {planes}
      </g>
    </>
  );
}
