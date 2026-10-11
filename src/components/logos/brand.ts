/* Each project's signature color, taken from the brand's own files, and the
   ink its logo reads in on that color. Use as a tile behind ProjectLogo:
   <div style={{ background: BRAND[s].color }}><ProjectLogo slug={s} color={BRAND[s].ink} /></div> */

export type Brand = {
  name: string;
  color: string;
  ink: string;
  /** True when ProjectLockup draws the brand's real wordmark (its own lettering or typeface). */
  wordmark: boolean;
};

export const BRAND: Record<string, Brand> = {
  // The logo disc's plum, sampled from shosoft.ai's favicon (rgb 50 1 46).
  // The Clay marketing site's --plum is #300020, the app's --brand-venue #59359A.
  shosoft: { name: 'ShoSoft', color: '#32012E', ink: '#FFFFFF', wordmark: true },
  // wedgestudio.dev/favicon.svg, tile #050505 with the mark in #F4F4F6 (v17 site --bg is #000).
  wedge: { name: 'Wedge Studio', color: '#050505', ink: '#F4F4F6', wordmark: true },
  // Reve's mark is black (brand/logo/reve_logo_black_alpha.svg), reve.com theme-color #000000 on dark.
  reve: { name: 'Reve', color: '#000000', ink: '#FFFFFF', wordmark: true },
  // Vecka's product blue, assets/brand/vecka-exploration-v2/01-gather/icon-blue.svg and the vecka.ai favicon.
  vecka: { name: 'Vecka', color: '#2563EB', ink: '#FFFFFF', wordmark: true },
  // Handoff app token --blue in code/handoff-app/src/styles/base.css (the favicon strokes #3b78d7).
  handoff: { name: 'Handoff', color: '#2F68C4', ink: '#FFFFFF', wordmark: true },
  // Mean of the monogram's purple gradient, Archive/Sep2023 Downloads/delogogcolor.png.
  'digital-enterprise': { name: 'Digital Enterprise', color: '#B54EF1', ink: '#FFFFFF', wordmark: true },
  // Mean of the H mark's blue to violet gradient, Archive/Sep2023 Downloads/hyretrans.png.
  hyre: { name: 'HYRE', color: '#5944E9', ink: '#FFFFFF', wordmark: true },
  // The chevron's lower, deeper blue, Archive/Sep2023 Downloads/swirelogo1.png (upper half #94B9DB).
  swire: { name: 'Swire', color: '#769EC4', ink: '#FFFFFF', wordmark: true },
  // White letters on black, Archive/Sep2023 Downloads/avabold.png.
  'ava-media': { name: 'AVA Media', color: '#000000', ink: '#FFFFFF', wordmark: true },
  // The resume has no brand: a calm neutral slate.
  cv: { name: 'Resume', color: '#5B6472', ink: '#FFFFFF', wordmark: false },
};
