/* The screen. The field is drawn as the picture on a CRT: a calm sweep
   of colour that drifts and rolls through its palette, traced line by
   line by an electron beam, glowing through the glass.

   How it is drawn, in four WebGL 2 passes each frame.
   1. Signal. The picture as the tube receives it, one texel row per
      scanline and one texel per CSS pixel along it: the drifting field,
      the open project's logo, the pointer's magnet, the power on. It is
      written over the last frame's phosphor with `max`, which then fades
      a little each frame (red and green a touch slower than blue), so
      anything that moves leaves a short afterglow.
   2 and 3. Halation. The phosphor, its bright parts weighted up, shrunk
      and blurred, for the soft light that spreads inside the glass.
   4. The tube. Each pixel finds its spot on a gently curved raster,
      lays down the scanlines as beams whose width swells with
      brightness, splits the guns a hair apart toward the edges, passes
      through a fine aperture grille, and adds halation, a faint
      reflection on the glass, a slow refresh band, grain and the
      slightest flicker. The corners are rounded and fall off like a
      real tube, and outside the raster is dark glass. The HTML on the
      screen (guide, chat, article) bends with the same curve (warp.ts).

   Behaviour is the field's, kept as it was. On load the tube powers on:
   a dot, a line, the picture opening out vertically overbright, then a
   short degauss wobble as it settles. Hovering or opening a project
   blends the whole picture into that brand's colours over 500ms, on
   from wherever it is. The pointer acts like a weak magnet near the
   glass, bending the raster a little and tinting it. The article lies
   under the screen: opening it, the picture's edge sweeps across (WIPE)
   as a bright line of phosphor, filling the span it crosses each frame
   so its afterglow trails over the article as one soft smear. Closing
   sweeps it back; a new goal mid sweep carries on from where the edge
   is. Text on the glass asks for calm (`data-calm`): the picture dims
   and flattens behind it in a wide soft oval. The screen is sized to its box and
   the picture is anchored right, so opening never moves it. With a
   project open the strip that remains shows its logo as white phosphor
   (in both themes), glowing, scanlined, lit from its centre; switching
   projects blends one outline into the next as distance fields.

   In a light room (light colour scheme) a CRT's black is lit grey glass,
   so the gaps between scanlines are filled in, contrast is lower, the
   glow is small and the reflection a little stronger.

   Hidden tabs and a screen scrolled out of view stop drawing. With
   reduced motion the screen holds still, draws only when something
   changes, and every change is instant. Returns null when WebGL 2 is
   missing, and the site falls back to a 2D canvas picture (screen2d.ts). */
import type { RefObject } from 'react';
import { blender } from './palette';
import { markSdf, type Sdf } from './marks';
import { CURVE } from './warp';

export type Wants = {
  palette: RefObject<string[]>;
  mark: RefObject<string | null>;
  cut: RefObject<number>;
};

/* How long the picture's edge takes to sweep across to reveal the article
   (or back over it). App's wipe between two articles takes as long. */
export const WIPE = 320;
/* how fast the field drifts and rolls through its colours, against the
   pace it had at first (calmed to barely noticeable) */
const FIELD_PACE = 0.3;
/* how long one logo takes to flow into the next */
const MORPH = 320;
/* the power on, after which the edge animates normally */
const LOAD = 1600;
/* Anything on the glass can ask the picture to calm down behind it: give
   the element a `data-calm` of 0 to 1 and the field dims and flattens
   behind its box, with a soft edge. The guide and the chat do. Up to
   CALMS at once. */
const CALMS = 4;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;
out vec4 o;
float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
/* rotate a colour's hue around the grey axis */
vec3 hue(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
/* signed distance to a rounded box given as x, y, w, h */
float box(vec2 p, vec4 r, float rad) {
  vec2 h = r.zw * 0.5;
  vec2 q = abs(p - r.xy - h) - h + rad;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
/* how much the picture calms down here, for text on the glass */
uniform vec4 uCalm[${CALMS}];
uniform float uCalmAmt[${CALMS}];
/* an oval around each box with a very wide, soft falloff, so it never
   reads as a shape: the picture just grows quieter where text is */
float calmAt(vec2 p) {
  float c = 0.0;
  for (int i = 0; i < ${CALMS}; i++) {
    if (uCalmAmt[i] <= 0.0) continue;
    vec4 r = uCalm[i];
    vec2 d = (p - r.xy - r.zw * 0.5) / (r.zw * 0.5 + 160.0);
    c = max(c, uCalmAmt[i] * (1.0 - smoothstep(0.35, 1.0, length(d))));
  }
  return c;
}
`;

/* 1. The signal, with phosphor persistence. One texel per CSS pixel
   across, one row per scanline down. */
const SIGNAL = COMMON + `
uniform sampler2D uPrev, uRamp, uSdfA, uSdfB;
uniform vec2 uSize;
uniform float uPitch, uColW, uShift, uT, uStore, uLight, uWeight;
uniform float uFlare;   // the sweeping edge's line of light, while it moves
uniform float uEdge;    // where the screen gives way to the article
uniform float uPrevEdge; // where the edge was last frame
uniform vec3 uDecay, uHot, uInk;
uniform vec3 uPtr;      // x, y, how near (0 to 1)
uniform vec4 uLogo;     // centre x, y, lit, morph
uniform vec4 uLogoBox;  // field size w, h, half the fitted size w, h
uniform float uLogoS;   // the logo's scale on screen (the chat can shrink it)
uniform vec4 uPower;    // centre x, y, half width, half height lit so far
uniform vec4 uPower2;   // squeeze x, y, white, brightness
uniform vec2 uDegauss;  // amount, seconds

/* a smooth, slowly changing value in 0..1 from a few folded waves */
float wave(vec2 p, float t) {
  float a = sin(p.x * 0.9 + t * 0.31 + sin(p.y * 0.7 - t * 0.23) * 1.3);
  float b = sin(p.y * 0.8 - t * 0.27 + sin(p.x * 0.6 + t * 0.19) * 1.4);
  float c = sin((p.x + p.y) * 0.45 + t * 0.15);
  return (a + b + c * 0.6) / 5.2 + 0.5;
}

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  float y = (float(ip.y) + 0.5) * uPitch;
  float x = gl_FragCoord.x * uColW;
  float E = uEdge;
  vec3 col = vec3(0.0);
  vec2 rel = vec2(x, y) - uPower.xy;
  /* the sweeping edge lights the whole span it crossed this frame, and a
     little beyond, so its afterglow trails as one smooth smear */
  float lo = min(E, uPrevEdge), hi = max(E, uPrevEdge);
  float sweep = uFlare * (x < lo - 1.0 ? 0.0 : x <= hi ? 0.55 : 0.55 * exp(-(x - hi) / 9.0) + exp(-(x - E) / 3.0) * step(E, x));
  if (x < E) col = vec3(0.82, 0.9, 1.0) * sweep * 0.45;
  if (x >= E && abs(rel.x) <= uPower.z && abs(rel.y) <= uPower.w + 0.5 * uPitch) {
    /* where on the picture this beam lands: squeezed while powering on,
       wobbling while degaussing */
    vec2 p = uPower.xy + rel * uPower2.xy;
    /* (each effect below is skipped where it would add exactly nothing) */
    if (uDegauss.x != 0.0) p.x += uDegauss.x * 5.0 * sin(y * 0.05 + uDegauss.y * 40.0);
    /* the pointer, a weak magnet: bends the raster toward it */
    vec2 dp = p - uPtr.xy;
    float fall = exp(-dot(dp, dp) / 9800.0) * uPtr.z;
    p -= dp * 0.1 * fall;
    float calm = calmAt(vec2(x, y));

    /* the field drifts slowly sideways and rolls through the palette
       over about a minute; positions are in 12px units, which sets the
       size of its blobs */
    vec2 c = vec2(p.x + uShift, p.y) / 12.0;
    float v = 0.5 + (wave(vec2(c.x * 0.12 + uT * 0.18, c.y * 0.12 - uT * 0.07), uT) - 0.5) * 1.5 + 0.14 * sin(uT * 0.11);
    float shade = 0.8 + 0.22 * wave(vec2(c.y * 0.084 + 40.0, c.x * 0.084 - 20.0), uT * 0.7);
    vec2 dc = dp / 12.0;
    if (uPtr.z != 0.0) v += 0.16 * uPtr.z * exp(-dot(dc, dc) / 111.0);

    /* the logo, from two distance fields blended while morphing */
    float L = 0.0;
    if (uLogo.z > 0.0) {
      vec2 lp = (p - uLogo.xy) / uLogoS;
      vec2 luv = (lp + uLogoBox.xy * 0.5) / uLogoBox.xy;
      float d = (mix(texture(uSdfA, luv).r, texture(uSdfB, luv).r, uLogo.w) + uWeight) * uLogoS;
      float cov = clamp(d / 1.25 + 0.5, 0.0, 1.0);
      /* light bleeds into the field around it (deepens it on paper) */
      float g = d > 0.0 ? 1.0 : exp(d / 14.0) * (1.0 - smoothstep(24.0, 38.0, -d));
      v += (uLight > 0.5 ? -0.5 : 0.22) * uLogo.z * g;
      /* lit from its centre outward */
      float dn = length(lp / uLogoBox.zw) / 1.42;
      L = cov * clamp(uLogo.z * 1.7 - dn * 0.7, 0.0, 1.0);
    }
    /* behind text the picture flattens toward its middle tone, so its
       brightest highlights never sit under a line of text */
    v = mix(v, 0.38, calm * 0.75);
    shade = mix(shade, 0.86, calm * 0.8);
    col = texture(uRamp, vec2((clamp(v, 0.0, 1.0) * 255.0 + 0.5) / 256.0, 0.5)).rgb * shade;
    if (L > 0.0) {
      /* on dark the edges warm through the palette's bright tone before
         white; on paper they go straight to white */
      col = mix(col, uHot, uLight > 0.5 ? 0.0 : smoothstep(0.0, 0.55, L));
      float white = uLight > 0.5 ? smoothstep(0.0, 1.0, L) : smoothstep(0.45, 1.0, L) * 0.92;
      col = mix(col, uInk, white);
      /* phosphor driven a little past white, so it blooms */
      col *= 1.0 + 0.35 * white * (1.0 - uLight);
    }
    /* colour purity: the magnet and the degauss tint the picture */
    if (fall != 0.0) col = hue(col, fall * 0.6 * (dp.x - 0.6 * dp.y) / (abs(dp.x - 0.6 * dp.y) + 50.0));
    if (uDegauss.x != 0.0) col = hue(col, uDegauss.x * 0.4 * sin(x * 0.012 + y * 0.009 + uDegauss.y * 9.0));
    col = mix(col, vec3(0.92, 0.96, 1.0), uPower2.z) * uPower2.w;
    /* a sweeping edge is a line of phosphor; the afterglow trails it */
    col += vec3(0.82, 0.9, 1.0) * sweep;
    col = max(col, 0.0);
  }
  vec3 prev = texelFetch(uPrev, ip, 0).rgb / uStore;
  o = vec4(max(col, prev * uDecay - 0.006) * uStore, 1.0);
}`;

/* 2. Halation, first step: the phosphor shrunk, bright parts weighted up */
const BRIGHT = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uDst, uSrcTexel;
uniform float uStore;
void main() {
  vec2 uv = gl_FragCoord.xy / uDst;
  vec2 h = uSrcTexel * vec2(1.5, 0.5);
  vec3 c = (texture(uSrc, uv + h * vec2(-1, -1)).rgb + texture(uSrc, uv + h * vec2(1, -1)).rgb
          + texture(uSrc, uv + h * vec2(-1, 1)).rgb + texture(uSrc, uv + h * vec2(1, 1)).rgb) * 0.25 / uStore;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  o = vec4(c * (0.3 + 0.7 * smoothstep(0.25, 1.1, l)) * uStore, 1.0);
}`;

/* 3. Halation, a gaussian blur, once across and once down */
const BLUR = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uDst, uDir;
void main() {
  vec2 uv = gl_FragCoord.xy / uDst;
  vec2 d = uDir / uDst;
  vec3 c = texture(uSrc, uv).rgb * 0.2270;
  c += (texture(uSrc, uv + d * 1.385).rgb + texture(uSrc, uv - d * 1.385).rgb) * 0.3162;
  c += (texture(uSrc, uv + d * 3.231).rgb + texture(uSrc, uv - d * 3.231).rgb) * 0.0703;
  o = vec4(c, 1.0);
}`;

/* 4. The tube */
const TUBE = COMMON + `
uniform sampler2D uSig, uBloom;
uniform vec2 uSize, uRes;
uniform float uEdge, uDpr, uPitch, uLines, uStore, uK, uRadius, uLight, uT, uFrame, uFlick, uNoise, uInset;
uniform float uScan, uGrille, uWire, uBloomAmt, uRoll, uAfter;
uniform vec3 uGlass, uPanel;

/* gentle barrel: the middle of each side stays put, the corners pull in */
vec2 warp(vec2 p) {
  vec2 C = uSize * 0.5, d = p - C;
  float R2 = dot(C, C);
  return C + d * (1.0 + uK * dot(d, d) / R2) / (1.0 + uK * C * C / R2);
}
/* one scanline's colour at x, each gun a little apart; never read from
   the blank side of the edge, so the edge stays clean */
float lo;
vec3 row(float l, float x, float cv) {
  float v = (clamp(l, 0.0, uLines - 1.0) + 0.5) / uLines;
  x = max(x, lo + cv + 0.75);
  return vec3(
    texture(uSig, vec2((x + cv) / uSize.x, v)).r,
    texture(uSig, vec2(x / uSize.x, v)).g,
    texture(uSig, vec2((x - cv) / uSize.x, v)).b) / uStore;
}
/* one beam's light at dy lines from its centre; brighter beams are wider */
vec3 beam(vec3 c, float dy) {
  vec3 s = mix(vec3(0.27), vec3(0.4), clamp(c, 0.0, 1.0));
  return c * sqrt(0.34 / s) * exp(-0.5 * dy * dy / (s * s));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 q = warp(p);
  vec2 n = (p - uSize * 0.5) / (uSize * 0.5);
  float r2 = dot(n, n) * 0.5;

  float lq = q.y / uPitch;
  float l0 = floor(lq), f = lq - l0 - 0.5;
  float edge = uEdge;
  /* the guns drift apart toward the sides, by about a pixel */
  float cv = 0.25 + 1.1 * n.x * n.x;
  lo = edge > 0.5 && q.x >= edge ? edge : -1e4;
  vec3 c0 = row(l0, q.x, cv);
  vec3 lit = beam(c0, f) + beam(row(l0 - 1.0, q.x, cv), f + 1.0) + beam(row(l0 + 1.0, q.x, cv), f - 1.0);
  lit /= 0.34 * 2.5066;
  /* in a lit room the gaps between lines are filled in by the glass */
  vec3 scr = mix(c0, lit, uScan);

  /* the aperture grille, one triad every three device pixels, and its
     two thin damper wires a third of the way from the top and bottom */
  int k = int(mod(gl_FragCoord.x, 3.0));
  vec3 g = vec3(k == 0, k == 1, k == 2);
  scr *= mix(vec3(1.0), g * 2.2 + 0.27, uGrille);
  float wy = min(abs(q.y - uSize.y / 3.0), abs(q.y - uSize.y * 2.0 / 3.0)) * uDpr;
  scr *= 1.0 - uWire * exp(-wy * wy * 1.5);

  /* the slow refresh band, the faintest flicker, analog grain */
  float band = q.y / uSize.y - (fract(uT * 0.045) * 1.6 - 0.3);
  scr *= uFlick * (1.0 + uRoll * exp(-band * band * 90.0));
  float grain = hash(vec3(l0, floor(q.x), uFrame)) - 0.5;
  scr += grain * uNoise * (0.35 + dot(scr, vec3(0.33)));
  /* light falls off toward the corners */
  scr *= 1.0 - 0.2 * pow(r2, 1.5);

  vec3 bloom = texture(uBloom, q / uSize).rgb / uStore * uBloomAmt;
  /* (the soft reflection high on the left is the glass overlay's, in CSS) */

  /* calm behind text on the glass: dimmer, flatter, quieter */
  float calm = calmAt(p);
  scr = mix(scr, uLight > 0.5 ? mix(scr, uPanel, 0.62) : scr * 0.44, calm * 0.88);
  bloom *= 1.0 - calm * 0.6;

  /* where the raster is: the tube's rounded rectangle, starting at the
     edge where the screen gives way to the article */
  float aa = 0.8 / uDpr;
  /* beside an article the picture is a strip, held off the tube's edge
     all round so its curved top and bottom never run into the glass's
     edge (the middle of each side would otherwise sit flush, and the
     strip's top left corner looked cut off) */
  float m = uInset;
  float inside = 1.0 - smoothstep(-aa, aa, box(q, vec4(max(edge, 0.0), m, uSize.x - max(edge, 0.0) - m, uSize.y - 2.0 * m), uRadius));
  float cleared = edge > 0.5 ? 1.0 - smoothstep(edge - aa, edge + aa, q.x) : 0.0;

  vec3 raster = uLight > 0.5 ? scr + bloom : uGlass + scr + bloom;
  vec3 glass = uGlass + bloom * 0.6 * (1.0 - smoothstep(0.0, 24.0, length(max(abs(q - uSize * 0.5) - uSize * 0.5, 0.0))));
  vec3 solid = mix(glass, raster, inside);
  /* over the article the screen is gone; only the fading phosphor and
     a little halation remain, added as light */
  vec3 after = (lit * 0.9 + bloom * 0.25) * uAfter;
  float a = 1.0 - cleared;
  o = vec4(solid * a + after * cleared, a);
}`;

type Tex = { t: WebGLTexture; w: number; h: number };
type Target = Tex & { fb: WebGLFramebuffer };

/* The quality governor. It watches the display's real frames (the gaps
   between animation frames) on the visitor's machine. When more than 5%
   of frames in a 2 s window miss the refresh, it steps down one level,
   at most once every 3 s; after 10 s of clean frames with nothing moving
   it steps back up, and if a level it came back to fails again it stays
   below it for the visit. The level is kept for the visit
   (sessionStorage). Levels add up:
     1  halation is worked out every other frame
     2  the picture is drawn at 3/4 of its resolution (scanlines keep
        their size, a little softer)
     3  the glass is asked to go light (`data-lite` on the tube and a
        `crt-quality` event), for the curve over the HTML
   `?fps=1` shows a small readout: frames a second, the 95th percentile
   frame time, frames dropped, the level, and the picture's own rate. */
const QKEY = 'crt-quality';
export const QMAX = 3;
type Gov = { level: number; tick: (ms: number, moving: boolean) => void; drew: () => void; stop: () => void };
function governor(apply: (level: number) => void): Gov {
  let level = 0;
  try { level = Math.min(QMAX, Math.max(0, parseInt(sessionStorage.getItem(QKEY) || '0', 10) || 0)); } catch {}
  const ring = new Float32Array(240);
  let n = 0, head = 0, prev = -1, born = -1, winAt = -1, frames = 0, missed = 0, dropped = 0, quiet = true;
  let base = 1000 / 60, changedAt = -1e9, upAt = -1e9, clean = 0, floor = 0, draws = 0, drawsAt = 0, rate = 0;
  const set = (to: number, ms: number) => {
    /* back down soon after stepping up: that level does not hold here */
    if (to > level) { if (ms - upAt < 10000) floor = to; } else upAt = ms;
    level = to;
    changedAt = ms;
    clean = 0;
    try { sessionStorage.setItem(QKEY, String(level)); } catch {}
    apply(level);
  };
  const pct = (q: number) => {
    const xs = Array.from(ring.subarray(0, n)).sort((a, b) => a - b);
    return xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * q))] : 0;
  };
  /* the readout, only with ?fps=1 */
  let hud: HTMLElement | null = null, hudAt = 0;
  if (/[?&]fps=1(&|$)/.test(location.search)) {
    hud = document.createElement('div');
    hud.setAttribute('aria-hidden', 'true');
    hud.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,monospace;color:#d8f0ff;background:rgba(0,0,0,.72);padding:6px 8px;border-radius:4px;white-space:pre';
    document.body.appendChild(hud);
  }
  return {
    get level() { return level; },
    drew: () => { draws++; },
    stop: () => { hud?.remove(); },
    tick: (ms, moving) => {
      const gap = ms - prev;
      prev = ms;
      if (born < 0) born = ms;
      /* a long gap is a pause (hidden, scrolled away), not a slow frame */
      if (gap <= 0 || gap > 250) { winAt = ms; frames = missed = 0; return; }
      ring[head] = gap; head = (head + 1) % ring.length; n = Math.min(n + 1, ring.length);
      frames++;
      if (gap > base * 1.5) { missed++; dropped += Math.max(1, Math.round(gap / base) - 1); }
      if (moving) quiet = false;
      if (ms - winAt >= 2000) {
        /* the refresh interval: most frames make it, so a low percentile */
        base = Math.min(34, Math.max(4, pct(0.25)));
        rate = frames ? missed / frames : 0;
        if (ms - born > 3000 && ms - changedAt >= 3000) {
          if (rate > 0.05 && level < QMAX) set(level + 1, ms);
          else if (rate < 0.01 && quiet && !moving && level > floor) {
            if (++clean >= 5) set(level - 1, ms);
          } else clean = 0;
        }
        winAt = ms; frames = missed = 0; quiet = true;
      }
      if (hud && ms - hudAt > 250) {
        /* frames in the last second */
        let fps = 0;
        for (let i = 0, sum = 0; i < n && sum < 1000; i++) { sum += ring[(head - 1 - i + ring.length) % ring.length]; fps++; }
        const pic = (1000 * draws) / Math.max(1, ms - drawsAt);
        draws = 0; drawsAt = ms; hudAt = ms;
        hud.textContent = `fps ${fps}  p95 ${pct(0.95).toFixed(1)}ms\ndropped ${dropped}  miss ${(rate * 100).toFixed(1)}%\nlevel ${level}  picture ${pic.toFixed(0)}/s`;
      }
    },
  };
}

export function startCrt(canvas: HTMLCanvasElement, w: Wants): (() => void) | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const main = canvas.parentElement!.parentElement!;
  /* the tube: the box the screen and everything on its glass share */
  const glass = main.parentElement!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lightMq = matchMedia('(prefers-color-scheme: light)');

  /* Programs, each with its uniforms looked up by name. Where the GPU
     can compile in the background (KHR_parallel_shader_compile) the
     shaders are only started here and the page carries on; the first
     frame waits until they are ready instead of the main thread. */
  type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation>; sh: WebGLShader[] };
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const compile = (src: string): Prog => {
    const sh = (type: number, s: string) => {
      const o = gl.createShader(type)!;
      gl.shaderSource(o, s);
      gl.compileShader(o);
      return o;
    };
    const p = gl.createProgram()!;
    const shaders = [sh(gl.VERTEX_SHADER, VERT), sh(gl.FRAGMENT_SHADER, src)];
    for (const o of shaders) gl.attachShader(p, o);
    gl.linkProgram(p);
    return { p, u: {}, sh: shaders };
  };
  /* once linked: false if it failed, otherwise its uniforms looked up */
  const finish = (pr: Prog) => {
    if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) {
      for (const o of pr.sh) if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) console.warn('[crt]', gl.getShaderInfoLog(o));
      return false;
    }
    const n = gl.getProgramParameter(pr.p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(pr.p, i)!.name;
      pr.u[name] = gl.getUniformLocation(pr.p, name)!;
    }
    return true;
  };

  let signal: Prog, bright: Prog, blur: Prog, tube: Prog;
  let half = false, store = 1;
  let vao: WebGLVertexArrayObject;
  let ramp: Tex, sdfA: Tex, sdfB: Tex;
  let persist: Target[] = [], bloomA: Target, bloomB: Target;
  /* which logo fields are on the GPU, and at what size the targets were made */
  let uploaded: (Sdf | null)[] = [null, null];
  let sized = '', rampOn = false;

  const texture = (wd: number, ht: number, internal: number, format: number, type: number, filter: number, data: ArrayBufferView | null = null): Tex => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, wd, ht, 0, format, type, data);
    return { t, w: wd, h: ht };
  };
  const target = (wd: number, ht: number): Target => {
    const tx = half
      ? texture(wd, ht, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR)
      : texture(wd, ht, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx.t, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { ...tx, fb };
  };
  /* Uniforms are sent only when their value changes; most hold still
     from frame to frame. `set` remembers what each location last got. */
  const set = new Map<WebGLUniformLocation, Float64Array>();
  const same = (l: WebGLUniformLocation, a: number, b = 0, c = 0, d = 0) => {
    let v = set.get(l);
    if (!v) { v = new Float64Array(4).fill(NaN); set.set(l, v); }
    if (v[0] === a && v[1] === b && v[2] === c && v[3] === d) return true;
    v[0] = a; v[1] = b; v[2] = c; v[3] = d;
    return false;
  };
  const u1 = (l: WebGLUniformLocation, a: number) => { if (!same(l, a)) gl.uniform1f(l, a); };
  const u2 = (l: WebGLUniformLocation, a: number, b: number) => { if (!same(l, a, b)) gl.uniform2f(l, a, b); };
  const u3 = (l: WebGLUniformLocation, a: number, b: number, c: number) => { if (!same(l, a, b, c)) gl.uniform3f(l, a, b, c); };
  const u4 = (l: WebGLUniformLocation, a: number, b: number, c: number, d: number) => { if (!same(l, a, b, c, d)) gl.uniform4f(l, a, b, c, d); };
  /* the calm zones, shared by two programs, sent when they move */
  const calmSent = new Map<WebGLProgram, Float32Array>();
  const sendCalm = (pr: Prog) => {
    let v = calmSent.get(pr.p);
    if (!v) { v = new Float32Array(CALMS * 5).fill(NaN); calmSent.set(pr.p, v); }
    let diff = false;
    for (let i = 0; i < CALMS * 4; i++) if (v[i] !== calmBoxes[i]) { diff = true; break; }
    for (let i = 0; !diff && i < CALMS; i++) if (v[CALMS * 4 + i] !== calmAmts[i]) diff = true;
    if (!diff) return;
    v.set(calmBoxes); v.set(calmAmts, CALMS * 4);
    gl.uniform4fv(pr.u['uCalm[0]'], calmBoxes);
    gl.uniform1fv(pr.u['uCalmAmt[0]'], calmAmts);
  };
  const drop = (x: Tex | Target | undefined) => {
    if (!x) return;
    gl.deleteTexture(x.t);
    if ('fb' in x) gl.deleteFramebuffer(x.fb);
  };

  /* whether the programs are linked and set up (ready), or failed */
  let ready = false;
  const setUp = () => {
    if (![signal, bright, blur, tube].every(finish)) return false;
    /* each sampler reads a fixed texture unit, set once */
    const units = (pr: Prog, names: string[]) => {
      gl.useProgram(pr.p);
      names.forEach((n, i) => gl.uniform1i(pr.u[n], i));
    };
    units(signal, ['uPrev', 'uRamp', 'uSdfA', 'uSdfB']);
    units(bright, ['uSrc']);
    units(blur, ['uSrc']);
    units(tube, ['uSig', 'uBloom']);
    set.clear();
    calmSent.clear();
    ready = true;
    return true;
  };
  /* with background compiling: true once every program has finished */
  const compiled = () => !parallel || [signal, bright, blur, tube].every((pr) => gl.getProgramParameter(pr.p, parallel.COMPLETION_STATUS_KHR));
  const init = () => {
    ready = false;
    [signal, bright, blur, tube] = [compile(SIGNAL), compile(BRIGHT), compile(BLUR), compile(TUBE)];
    if (!parallel && !setUp()) return false;
    /* half float phosphor when the GPU can render to it, so it can run
       past white; otherwise bytes holding half the range */
    half = !!gl.getExtension('EXT_color_buffer_float');
    if (half) {
      const probe = target(4, 4);
      half = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      drop(probe);
    }
    store = half ? 1 : 0.5;
    rampOn = false;
    vao = gl.createVertexArray()!;
    ramp = texture(256, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    sdfA = texture(1, 1, gl.R16F, gl.RED, gl.FLOAT, gl.LINEAR, new Float32Array([-99]));
    sdfB = texture(1, 1, gl.R16F, gl.RED, gl.FLOAT, gl.LINEAR, new Float32Array([-99]));
    persist = [];
    sized = '';
    uploaded = [null, null];
    return true;
  };
  if (!init()) return null;
  /* the picture is drawn opaque wherever the article is not showing; the
     page uses this to stop bending what it fully covers (site.css) */
  glass.dataset.gl = '';

  /* quality, stepped down by the governor when frames drop (above) */
  let q = 0, transit = true, haloFresh = true;
  const lite = (l: number) => { if (l >= 3) glass.dataset.lite = ''; else delete glass.dataset.lite; };
  const gov = governor((l) => {
    q = l;
    lite(l);
    glass.dispatchEvent(new CustomEvent('crt-quality', { detail: l, bubbles: true }));
  });
  q = gov.level;
  lite(q);

  /* sizes: CSS px of the screen, device pixels per CSS px (capped so a
     big window stays cheap), the scanline pitch in whole device pixels */
  let W = 0, H = 0, dpr = 1, pitch = 3, lines = 0, cols = 0;
  const size = () => {
    W = Math.max(1, main.clientWidth);
    H = Math.max(1, main.clientHeight);
    /* past the budget, drop to a whole fraction of the device ratio so the
       browser scales the canvas up evenly and the scanlines stay clean */
    const d = Math.min(3, devicePixelRatio || 1), most = Math.sqrt(4.6e6 / (W * H));
    dpr = d <= most ? d : d / Math.ceil(d / most);
    const pd = Math.max(3, Math.round(3 * dpr));
    pitch = pd / dpr;
    /* under load, fewer pixels; the scanlines keep their size */
    if (q >= 2) dpr *= 0.75;
    const key = `${W}x${H}@${dpr}`;
    if (key === sized) return;
    sized = key;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    lines = Math.ceil(H / pitch) + 1;
    /* the glass's scanline overlay matches the picture's lines */
    glass.style.setProperty('--scan', `${pitch}px`);
    cols = Math.ceil(W);
    persist.forEach(drop);
    drop(bloomA); drop(bloomB);
    persist = [target(cols, lines), target(cols, lines)];
    const bw = Math.ceil(W / 6), bh = Math.ceil(H / 6);
    bloomA = target(bw, bh);
    bloomB = target(bw, bh);
    haloFresh = true;
  };

  const palette = blender(w.palette.current ?? []);

  /* the edge where the screen gives way to the article */
  let cutTarget: number | undefined = undefined;

  /* the sweep: where the edge set off from, where it is going, when */
  let edgeFrom = 0, edgeTo = 0, edgeAt = -1e9, edgeNow = 0, lastEdge = 0;
  size();
  cutTarget = w.cut.current ?? 0;

  /* the pointer, a weak magnet, easing in and out */
  let px = -1e4, py = -1e4, lift = 0, near = false;
  const onMove = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    px = e.clientX - b.left;
    py = e.clientY - b.top;
    near = px >= -40 && py >= -40 && px <= b.width + 40 && py <= b.height + 40;
  };
  const onLeave = () => { near = false; };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  /* The logo. `shape` is what shows when no morph runs. Switching
     projects never fades it: the new mark joins the old in the same
     frame and the two distance fields blend, so one outline flows into
     the next. It sits in the strip the open article leaves (`lastCut`)
     and stays there while the article is covered and revealed again. */
  let shownMark: string | null = null, M = '', shape: Sdf | null = null, lit = 0, loading = false;
  let morph: { a: Sdf; b: Sdf; since: number } | null = null;
  let lastCut = w.cut.current ?? 0;
  const upload = (slot: 0 | 1, s: Sdf) => {
    if (uploaded[slot] === s) return;
    uploaded[slot] = s;
    const t = slot ? sdfB : sdfA;
    gl.bindTexture(gl.TEXTURE_2D, t.t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, s.w, s.h, 0, gl.RED, gl.FLOAT, s.data);
    t.w = s.w; t.h = s.h;
  };
  /* the outline on screen mid morph, as a field of its own */
  const between = (m: NonNullable<typeof morph>, e: number): Sdf => {
    const data = new Float32Array(m.a.data.length);
    for (let i = 0; i < data.length; i++) data[i] = m.a.data[i] + (m.b.data[i] - m.a.data[i]) * e;
    return { w: m.a.w, h: m.a.h, data, weight: m.a.weight + (m.b.weight - m.a.weight) * e };
  };
  let morphE = 1, logoY = -1;

  /* the calm zones: every `data-calm` element on the glass, eased */
  const calmBoxes = new Float32Array(CALMS * 4), calmAmts = new Float32Array(CALMS);
  /* each zone's strength and box, eased so it never pops or jumps */
  const eased = new WeakMap<Element, { c: number; r: number[] }>();
  const readCalm = (dt: number) => {
    calmAmts.fill(0);
    const els = glass.querySelectorAll<HTMLElement>('[data-calm]');
    const b = canvas.getBoundingClientRect();
    let n = 0;
    for (const el of els) {
      if (n >= CALMS) break;
      const goal = parseFloat(el.dataset.calm || '0') || 0;
      const a = el.getBoundingClientRect();
      const box = [a.left - b.left, a.top - b.top, a.width, a.height];
      let z = eased.get(el);
      if (!z) { z = { c: 0, r: box }; eased.set(el, z); }
      /* the calm settles in fast, so a panel never shows the raw colour
         behind it as it fades in, and lets go slowly */
      const k = still ? 1 : 1 - Math.exp(-dt / (goal > z.c ? 70 : 190));
      z.c += (goal - z.c) * k;
      if (a.width && a.height) for (let i = 0; i < 4; i++) z.r[i] += (box[i] - z.r[i]) * k;
      if (z.c < 0.002 || !z.r[2] || !z.r[3]) continue;
      calmBoxes.set(z.r, n * 4);
      calmAmts[n++] = z.c;
    }
  };

  /* the page's --screen colour as linear 0..1 sRGB, read once per theme */
  let scKey = '', scVal = [0.04, 0.05, 0.075];
  const screenColour = (light: boolean) => {
    const key = light ? 'l' : 'd';
    if (key !== scKey) {
      scKey = key;
      const v = getComputedStyle(glass).getPropertyValue('--screen').trim();
      const m = v.match(/^#([0-9a-f]{6})$/i);
      if (m) { const n = parseInt(m[1], 16); scVal = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
    }
    return scVal;
  };

  const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const sm = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  /* a browser that has seen the site before (Base.astro marks the page
     `seen`) skips the power on: the tube is simply on */
  const seen = document.documentElement.classList.contains('seen');
  let raf = 0, last = performance.now(), t = Math.random() * 100, born = still ? -1e9 : -1, frameNo = 0, cur = 0;
  /* With a project open the side over the article is drawn black and
     clear once its afterglow has gone out. `glow` bounds how bright the
     phosphor there can still be (it fades no slower than red does, less
     a little each frame, with room for rounding); after two frames at
     zero both phosphor buffers hold black there, and both passes skip it.
     The canvas starts each frame clear, so the skipped part is exactly
     what the tube would have drawn. */
  let glow = 32, darkFor = 0;
  const rampBytes = new Uint8Array(1024);
  const bind = (unit: number, tex: Tex) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex.t);
  };

  const draw = (ms: number) => {
    const dt = Math.min(64, ms - last);
    last = ms;
    if (!still) t += dt * 0.001;
    frameNo++;
    size();
    const light = lightMq.matches;

    /* the palette */
    /* a new channel's colours are simply there; hovering blends */
    const rgb = palette(w.palette.current ?? [], ms, still);
    /* uploaded only when it changed, which at rest is never */
    let fresh = rampOn;
    for (let j = 0; j < 256; j++) {
      const o = j * 4, k = j * 3;
      if (rampBytes[o] !== rgb[k] || rampBytes[o + 1] !== rgb[k + 1] || rampBytes[o + 2] !== rgb[k + 2]) fresh = false;
      rampBytes[o] = rgb[k]; rampBytes[o + 1] = rgb[k + 1]; rampBytes[o + 2] = rgb[k + 2]; rampBytes[o + 3] = 255;
    }
    if (!fresh) {
      gl.bindTexture(gl.TEXTURE_2D, ramp.t);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, rampBytes);
      rampOn = true;
    }

    lift += ((near ? 1 : 0) - lift) * (still ? 0 : Math.min(1, dt / 260));

    /* the power on */
    if (born < 0) born = seen ? ms - LOAD - 1 : ms;
    const age = ms - born;
    const powering = age < LOAD;

    /* The edge where the screen gives way to the article sweeps to its
       new place: opening, it settles in (fast, then gently); closing, it
       eases out and back in. A new goal mid sweep carries on from where
       the edge is. While powering on it simply goes there. */
    const goal = w.cut.current ?? 0;
    if (goal !== cutTarget) {
      cutTarget = goal;
      edgeFrom = edgeNow;
      edgeTo = goal;
      edgeAt = still || powering ? -1e9 : ms;
    }
    const cu = Math.min(1, (ms - edgeAt) / WIPE);
    const opening = edgeTo > edgeFrom;
    const ce = opening ? 1 - Math.pow(1 - cu, 3) : ease(cu);
    const edge = edgeNow = edgeFrom + (edgeTo - edgeFrom) * ce;
    const flare = cu < 1 ? 0.32 * Math.pow(Math.sin(Math.PI * cu), 0.6) : 0;
    const prevEdge = lastEdge;
    lastEdge = edge;
    transit = powering || cu < 1 || !!morph || !fresh;
    const lively = flare > 0 || edge !== prevEdge || powering;
    const skip = edge > 0.5 && darkFor >= 2 && !lively;
    glow = lively ? 32 : glow * (still ? 0 : Math.exp(-dt / 75)) * 1.002 - 0.0015;
    darkFor = glow <= 0 ? darkFor + 1 : 0;

    /* the logo's room: the strip beside the open article */
    const target = w.mark.current;
    if (target && goal > 0) lastCut = goal;
    const vw = W - lastCut;
    /* the logo's room: with the chat panel below it, the zone above the
       panel (its top less a margin); otherwise the strip */
    const dock = glass.querySelector<HTMLElement>('.crt-slot[data-mode="dock"]');
    const canvasTop = canvas.getBoundingClientRect().top;
    const dockTop = dock ? dock.getBoundingClientRect().top - canvasTop : 0;
    /* the chat can name the logo's place and size itself: its
       `.crt-logo-spot` (chat/Live.tsx), centred in an empty panel and
       moved up by a transform once there is a conversation; the logo
       follows it frame by frame */
    const spotEl = dock?.querySelector<HTMLElement>('.crt-logo-spot');
    const spotBox = spotEl?.getBoundingClientRect();
    const spot = spotEl && spotBox && spotEl.offsetWidth > 0 && spotEl.offsetHeight > 0 ? spotBox : null;
    /* the spot's own size sets the logo's; a transform on it (shrinking
       it into the chat's header) scales the drawing, not the field */
    const spotS = spot ? Math.max(0.05, spot.width / spotEl!.offsetWidth) : 1;
    const roomH = spot ? spotEl!.offsetHeight : dockTop > 80 ? dockTop - 56 : H * 0.4;
    const fitW = Math.max(96, Math.min(spot ? Math.floor(spotEl!.offsetWidth / 8) * 8 : dockTop > 80 ? 200 : 288, Math.floor((vw * 0.8) / 8) * 8));
    const fitH = Math.max(96, Math.min(240, Math.floor(roomH / 8) * 8));
    const fit = `${fitW}x${fitH}`;
    if (!target) {
      /* closing: the logo fades out where it is */
      lit = still ? 0 : Math.max(0, lit - dt / 380);
      if (lit === 0) { shownMark = null; M = ''; shape = null; morph = null; }
    } else if ((target !== shownMark || fit !== M) && !loading) {
      loading = true;
      const slug = target, f = fit;
      markSdf(slug, fitW, fitH).then((got) => {
        loading = false;
        if (!got || w.mark.current !== slug) return;
        /* what is on screen right now, mid morph or not */
        const from = morph ? between(morph, morphE) : shape;
        /* one outline flows into the next, on the same short timeline as
           the article's crossfade and the colour blend */
        if (from && lit > 0 && !still && from.w === got.w && from.h === got.h && from !== got) {
          morph = { a: from, b: got, since: performance.now() };
        } else {
          morph = null;
        }
        shape = got;
        shownMark = slug; M = f;
        wake();
        /* the other marks at this size, worked out one at a time when the
           page is idle (after any switch has settled), so a later switch
           never waits on one */
        const rest = [...document.querySelectorAll<HTMLElement>('.marks [data-mark]')].map((n) => n.dataset.mark!).filter((o) => o !== slug);
        const idle: (fn: (d?: { timeRemaining(): number }) => void) => void =
          (window as any).requestIdleCallback?.bind(window) ?? ((fn) => setTimeout(fn, 300));
        const next = (d?: { timeRemaining(): number }) => {
          if (!rest.length) return;
          if (d && d.timeRemaining() < 12) { idle(next); return; }
          markSdf(rest.shift()!, fitW, fitH).then(() => setTimeout(() => idle(next), MORPH));
        };
        setTimeout(() => idle(next), MORPH + 200);
      });
    }
    if (target && shape && !morph && (lit > 0 || cu >= 1)) lit = still ? 1 : Math.min(1, lit + dt / 900);
    morphE = 1;
    if (morph) {
      const p = Math.min(1, (ms - morph.since) / MORPH);
      if (p >= 1) morph = null;
      else morphE = 1 - Math.pow(1 - p, 3);
    }
    if (morph) { upload(0, morph.a); upload(1, morph.b); }
    else if (shape) upload(1, shape);
    const weight = morph ? morph.a.weight + (morph.b.weight - morph.a.weight) * morphE : shape?.weight ?? 0;

    readCalm(dt);

    /* the logo sits in the zone above the chat panel when there is one,
       otherwise in the middle of the strip, easing between the two */
    /* (closing, it fades where it is rather than drifting while it goes) */
    const wantY = !target && logoY >= 0 ? logoY : spot ? spot.top + spot.height / 2 - canvasTop : dockTop > 80 ? dockTop / 2 + 4 : H / 2;
    logoY = logoY < 0 || still || (spot && target) ? wantY : logoY + (wantY - logoY) * Math.min(1, dt / 220);

    /* the power on: a dot, a line across, the picture opening out
       vertically overbright, then a short degauss wobble */
    const cx = (goal + W) / 2, cy = H / 2;
    const fullW = (W - goal) / 2 + 30, fullH = H / 2 + 30;
    const ex = still ? 1 : 1 - Math.pow(1 - sm(30, 300, age), 3);
    const ey = still ? 1 : ease(Math.min(1, Math.max(0, (age - 280) / 460)));
    const done = still || age > LOAD;
    const hw = done ? 1e5 : 1.5 + (fullW - 1.5) * ex, hh = done ? 1e5 : pitch * 0.25 + (fullH - pitch * 0.25) * ey;
    const white = still ? 0 : 0.85 * (1 - sm(120, 520, age));
    const over = still ? 1 : (1 + 0.55 * (1 - sm(300, 1200, age))) * (1 + 1.4 * Math.pow(1 - ey, 2)) * sm(0, 50, age);
    const dg = still || age < 620 ? 0 : Math.exp(-(age - 680) / 240) * sm(620, 720, age);

    /* 1. signal and phosphor */
    const prev = persist[cur], next = persist[1 - cur];
    cur = 1 - cur;
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    /* the signal is one texel per CSS px across; left of the edge it is black */
    if (skip) {
      const sx = Math.max(0, Math.floor(edge / (W / cols)) - 4);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(sx, 0, cols - sx, lines);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fb);
    gl.viewport(0, 0, cols, lines);
    gl.useProgram(signal.p);
    let u = signal.u;
    bind(0, prev); bind(1, ramp); bind(2, sdfA); bind(3, sdfB);
    u2(u.uSize, W, H);
    u1(u.uPitch, pitch);
    u1(u.uColW, W / cols);
    u1(u.uShift, innerWidth - W);
    /* the field drifts at a barely noticeable pace (David, 2026-10-11) */
    u1(u.uT, t * FIELD_PACE);
    u1(u.uStore, store);
    u1(u.uFlare, flare);
    u1(u.uEdge, edge);
    u1(u.uPrevEdge, prevEdge);
    u1(u.uLight, light ? 1 : 0);
    u1(u.uWeight, weight);
    u3(u.uDecay, still ? 0 : Math.exp(-dt / 75), still ? 0 : Math.exp(-dt / 62), still ? 0 : Math.exp(-dt / 48));
    const HOT = 230 * 3;
    u3(u.uHot, rgb[HOT] / 255, rgb[HOT + 1] / 255, rgb[HOT + 2] / 255);
    u3(u.uInk, light ? 1 : 252 / 255, light ? 1 : 246 / 255, light ? 1 : 238 / 255);
    u3(u.uPtr, px, py, lift);
    const showLogo = !!shape && lit > 0;
    u4(u.uLogo, spot ? spot.left + spot.width / 2 - canvas.getBoundingClientRect().left : (lastCut + W) / 2, logoY, showLogo ? lit : 0, morph ? morphE : 1);
    u1(u.uLogoS, spotS);
    u4(u.uLogoBox, sdfB.w, sdfB.h, fitW / 2, fitH / 2);
    u4(u.uPower, cx, cy, hw, hh);
    u4(u.uPower2, done ? 1 : Math.min(12, fullW / hw), done ? 1 : Math.min(12, fullH / hh), white, over);
    u2(u.uDegauss, dg, age / 1000);
    sendCalm(signal);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* 2 and 3. halation (under load, every other frame) */
    gl.disable(gl.SCISSOR_TEST);
    if (q < 1 || haloFresh || frameNo % 2 === 0) {
      haloFresh = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fb);
      gl.viewport(0, 0, bloomA.w, bloomA.h);
      gl.useProgram(bright.p);
      u = bright.u;
      bind(0, next);
      u2(u.uDst, bloomA.w, bloomA.h);
      u2(u.uSrcTexel, 1 / cols, 1 / lines);
      u1(u.uStore, store);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(blur.p);
      u = blur.u;
      u2(u.uDst, bloomA.w, bloomA.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fb);
      bind(0, bloomA);
      u2(u.uDir, 1, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fb);
      bind(0, bloomB);
      u2(u.uDir, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* 4. the tube */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (skip) {
      /* a pixel of the tube sees the signal and its halation no more
         than about 40px away, and the barrel moves it sideways by at
         most CURVE times half the width */
      const sx = Math.max(0, Math.floor((edge - 64 - CURVE * W / 2 - 2) * (canvas.width / W)));
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(sx, 0, canvas.width - sx, canvas.height);
    }
    gl.useProgram(tube.p);
    u = tube.u;
    bind(0, next); bind(1, bloomA);
    u1(u.uEdge, edge);
    u2(u.uSize, W, H);
    u2(u.uRes, canvas.width, canvas.height);
    u1(u.uDpr, canvas.width / W);
    u1(u.uPitch, pitch);
    u1(u.uLines, lines);
    u1(u.uStore, store);
    u1(u.uK, CURVE);
    u1(u.uRadius, 16);
    /* the strip's margin grows in with the sweep and lets go with it, so
       the picture never changes size in one frame at the start or end of
       an open or close */
    u1(u.uInset, 10 * Math.min(1, edgeNow / Math.max(1, edgeFrom, edgeTo)));
    u1(u.uLight, light ? 1 : 0);
    u1(u.uT, t);
    u1(u.uFrame, still ? 0 : frameNo % 997);
    u1(u.uFlick, still ? 1 : 1 + (Math.random() - 0.5) * 0.012);
    const power = still ? 1 : sm(300, 900, age);
    u1(u.uNoise, (light ? 0.02 : 0.035) * power);
    u1(u.uScan, light ? 0.45 : 1);
    u1(u.uGrille, (light ? 0.035 : 0.06) * Math.min(1, dpr / 2 + 0.25));
    u1(u.uWire, light ? 0.05 : 0.09);
    u1(u.uBloomAmt, light ? 0.1 : 0.26);
    u1(u.uRoll, still ? 0 : light ? 0.015 : 0.03);
    u1(u.uAfter, light ? 0 : 1);
    /* the glass is the page's screen colour, so the picture's margins
       and the blanked side meet without a seam */
    const sc = screenColour(light);
    u3(u.uGlass, sc[0], sc[1], sc[2]);
    u3(u.uPanel, sc[0], sc[1], sc[2]);
    sendCalm(tube);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
  };

  /* Runs while visible; reduced motion draws on demand only. On a fast
     display (120Hz and up) the picture is drawn about 60 times a second:
     a refresh is skipped when the display runs faster than 90Hz and the
     next one still lands within a 60th of a second of the last frame
     drawn, and never twice in a row, so it never drops below 60 on any
     display. Everything in it moves by time, so it looks the same, and
     the page's own HTML and scrolling keep the display's full rate. */
  let visible = !document.hidden, onScreen = true, drawnAt = -1e9, tickAt = -1e9, skipped = false;
  /* the display's frame interval: the median of the last 15 gaps */
  const gaps = new Float32Array(15).fill(16.7), sorted = new Float32Array(15);
  let gi = 0;
  const frame = (ms: number) => {
    raf = 0;
    if (gl.isContextLost()) return;
    if (!ready) {
      /* still compiling: look again next frame, without drawing */
      if (!compiled()) { raf = requestAnimationFrame(frame); last = ms; return; }
      if (!setUp()) { fallBack(); return; }
    }
    gov.tick(ms, transit);
    const gap = ms - tickAt;
    tickAt = ms;
    if (gap > 2 && gap < 50) { gaps[gi] = gap; gi = (gi + 1) % gaps.length; }
    sorted.set(gaps); sorted.sort();
    const tick = sorted[7];
    if (!still && !skipped && tick < 11 && ms - drawnAt + tick <= 1000 / 60 + 1) {
      skipped = true;
      if (visible && onScreen) raf = requestAnimationFrame(frame);
      return;
    }
    skipped = false;
    drawnAt = ms;
    draw(ms);
    gov.drew();
    if (!still && visible && onScreen) raf = requestAnimationFrame(frame);
  };
  let dead = false;
  const wake = () => {
    if (!dead && !raf && visible && onScreen && !gl.isContextLost()) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  wake();

  const onVis = () => { visible = !document.hidden; if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; } };
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) wake(); else { cancelAnimationFrame(raf); raf = 0; }
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => wake());
  ro.observe(main);
  const poll = still ? window.setInterval(() => {
    if (w.cut.current !== cutTarget || w.mark.current !== shownMark || !lit !== !w.mark.current) wake();
  }, 100) : 0;
  /* the palette and the calm zone also ask for a frame when they change */
  let lastKey = '';
  const pollPalette = still ? window.setInterval(() => {
    let k = (w.palette.current ?? []).join() + lightMq.matches;
    glass.querySelectorAll<HTMLElement>('[data-calm]').forEach((el) => { k += el.dataset.calm; });
    if (k !== lastKey) { lastKey = k; wake(); }
  }, 100) : 0;

  const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; delete glass.dataset.gl; };
  const onRestored = () => { if (init()) { glass.dataset.gl = ''; wake(); } };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const stop = () => {
    dead = true;
    cancelAnimationFrame(raf);
    raf = 0;
    clearInterval(poll);
    clearInterval(pollPalette);
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    delete glass.dataset.gl;
    delete glass.dataset.lite;
    gov.stop();
  };
  /* if the programs turn out not to link after all, the 2D screen takes
     over the same place */
  let stop2d: (() => void) | null = null, stopped = false;
  const fallBack = () => {
    stop();
    import('./screen2d').then((m) => { if (!stopped) stop2d = m.startScreen2d(canvas, w); });
  };
  return () => { stopped = true; stop(); stop2d?.(); };
}
