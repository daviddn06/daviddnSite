/* The field, as a CRT screen. A calm sweep of colour that drifts and
   rolls through its palette, drawn as the picture on a tube (crt.ts):
   scanlines, phosphor glow and afterglow, curved glass. Hovering or
   opening a project blends it into that project's colours; the article
   lies under it and is revealed by it; the open project's logo glows in
   the strip that remains. Browsers without WebGL 2 get the older cell
   field, drawn soft under scanlines (cells.ts).

   This component only holds the latest wishes (palette, open project,
   how much of the left side to clear for the article) where the
   renderer can read them every frame. */
import { useEffect, useRef } from 'react';
import { startCrt, REVEAL } from './crt';
import { startCells } from './cells';

export { REVEAL };
export { DEFAULT_PALETTE, DEFAULT_PALETTE_LIGHT, brandPalette, brandAccent } from './palette';

type Props = {
  palette: string[];
  /* the open project, whose logo the screen holds */
  mark: string | null;
  /* how much of the screen's left side to clear for the article, in px */
  cut: number;
};

export function Field({ palette, mark, cut }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const want = useRef(palette);
  want.current = palette;
  const wantMark = useRef(mark);
  wantMark.current = mark;
  const wantCut = useRef(cut);
  wantCut.current = cut;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const wants = { palette: want, mark: wantMark, cut: wantCut };
    return startCrt(canvas, wants) ?? startCells(canvas, wants);
  }, []);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
