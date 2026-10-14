/** Where a lockup places a mark: a rectangle in the lockup's own units, and
    optionally the part of the mark's coordinate space that fills it (defaults
    to the mark's artwork bounds). */
export type MarkBox = { x: number; y: number; w: number; h: number; vb?: string };

/** Every mark gets a per-instance id prefix for its clipPaths and gradients.
    `box` is set when the mark is nested inside a lockup, `size` when it
    stands alone, so a brand with size masters can pick the right drawing. */
export type MarkProps = { uid: string; box?: MarkBox; /** rendered size in px, for marks with size masters */ size?: number };

/** Props for a mark's <svg>, standalone (padded viewBox) or nested in a lockup. */
export function markSvg(viewBox: string, art: string, box?: MarkBox) {
  if (!box) return { viewBox, 'aria-hidden': true as const, focusable: 'false' as const };
  return {
    viewBox: box.vb ?? art,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    overflow: 'visible',
  };
}
