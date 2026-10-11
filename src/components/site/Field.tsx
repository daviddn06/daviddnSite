/* The field, as a CRT screen. A calm sweep of colour that drifts and
   rolls through its palette, drawn as the picture on a tube (crt.ts):
   scanlines, phosphor glow and afterglow, curved glass. Hovering a
   project blends it into that project's colours; opening one changes
   the channel, and the article shows where the picture gives way to it,
   the open project's logo glowing in the strip that remains. Browsers
   without WebGL 2 get a plain canvas picture (cells.ts).

   This component only holds the latest wishes (palette, open project,
   how much of the left side to clear for the article, channel changes)
   where the renderer can read them every frame. */
import { useEffect, useRef } from 'react';
import { startCrt, SWAP } from './crt';
import { startCells } from './cells';

export { SWAP };
export { DEFAULT_PALETTE, DEFAULT_PALETTE_LIGHT, brandPalette, brandAccent } from './palette';

type Props = {
  palette: string[];
  /* the open project, whose logo the screen holds */
  mark: string | null;
  /* how much of the screen's left side to clear for the article, in px */
  cut: number;
  /* counts channel changes: each one rolls the picture */
  tune: number;
};

export function Field({ palette, mark, cut, tune }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const want = useRef(palette);
  want.current = palette;
  const wantMark = useRef(mark);
  wantMark.current = mark;
  const wantCut = useRef(cut);
  wantCut.current = cut;
  const wantTune = useRef(tune);
  wantTune.current = tune;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const wants = { palette: want, mark: wantMark, cut: wantCut, tune: wantTune };
    return startCrt(canvas, wants) ?? startCells(canvas, wants);
  }, []);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
