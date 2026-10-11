/* daviddn.dev. The whole page is an old CRT. The screen shows a calm
   field of colour; David's name, a line about him and his work sit on
   the glass like a TV's on screen display, every project a channel
   marked by its own logo. A
   chat sits in the middle of the screen.

   Hovering a channel blends the field into that project's colours.
   Choosing one slides the article in: the picture's edge sweeps across
   as a bright line of phosphor with a short afterglow, the article
   easing in behind it, the project's logo glowing in the strip that
   remains. Closing (choosing it again, or Escape) slides it back out;
   switching crossfades the article in place while the picture retints
   and the logo morphs, all on one short timeline.
   Up and down step through the channels. The address follows
   (/projects/<slug>/), so Back, Forward, reload and shared links land on
   the same view. Under 1000px the guide fills the screen and an article
   slides up over it. */
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRAND } from '../logos/brand';
import { DEFAULT_PALETTE, DEFAULT_PALETTE_LIGHT, Field, WIPE, brandAccent, brandPalette } from './Field';
import { preload } from './Panel';

/* how long a switch between two projects takes, the article's crossfade
   (site.css --switch) */
const SWITCH = 320;
import { curve } from './warp';
import { Marks, Mini, type Project } from './Media';
import { Panel } from './Panel';
import { Chat } from './chat/Chat';
import { HistoryShell } from './chat/Corner';
import { resume as RESUME } from '../../data/resume.js';

type Props = { work: Project[]; projects: Project[]; earlier: Project[]; initial: string | null };

const LINKS = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/daviddn' },
  { label: 'GitHub', url: 'https://github.com/daviddn06' },
  { label: 'Email', url: 'mailto:daviddn@usc.edu' },
  { label: 'Privacy', url: '/privacy/' },
];

const slugOf = (path: string) => (/^\/cv\/?$/.test(path) ? 'cv' : path.match(/^\/projects\/([^/]+)\/?$/)?.[1] ?? null);
/* the resume opens beside the chat like a project, as 'cv' (data/resume.js) */
const urlOf = (s: string | null) => (!s ? '/' : s === 'cv' ? '/cv/' : `/projects/${s}/`);

/* the time in the guide's header strip, like a set's on screen clock;
   blank until the page runs so the server and the browser agree */
const Clock = memo(function Clock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    let fmt: Intl.DateTimeFormat | null = null;
    /* once a minute, as the minute turns, and again on coming back to the tab */
    let id = 0;
    const tick = () => {
      const d = new Date();
      fmt ??= new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      setNow(fmt.format(d));
      clearTimeout(id);
      id = window.setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    /* the first date format a page makes is slow (the browser loads its
       locale data), so it waits for its own moment, not the page's start */
    id = window.setTimeout(tick, 0);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <span className="osd-clock" aria-hidden="true">{now}</span>;
});

export default function App({ work, projects, earlier, initial }: Props) {
  const all = useMemo(() => [...work, ...projects, ...earlier], [work, projects, earlier]);
  const sections = useMemo(() => [
    { id: 'work', title: 'Work', items: work },
    { id: 'projects', title: 'Projects', items: projects },
    { id: 'earlier', title: 'Earlier', items: earlier },
  ], [work, projects, earlier]);
  const slugs = useMemo(() => [...all.map((p) => p.slug), 'cv'], [all]);
  const find = useCallback((s: string | null) => (s === 'cv' ? (RESUME as Project) : all.find((x) => x.slug === s)), [all]);

  /* `open` is the project on screen; `shown` is what the article holds
     (it keeps its project while the picture covers it again). Switching
     between projects crossfades in place: the article's content changes
     at once and eases in, while the ones it replaces (`outgoing`, a
     copy each, held at their scroll) fade out over it from wherever
     they were. Clicking on mid switch only adds to that list, so nothing
     restarts or replays. */
  const [open, setOpen] = useState<string | null>(initial);
  const [shown, setShown] = useState<string | null>(initial);
  const [outgoing, setOutgoing] = useState<{ slug: string; id: number; at: number; from: number }[]>([]);
  const swap = useRef(0);
  const outId = useRef(0);
  /* the article in front; a switch hands it to `outgoing` as it is and
     starts a new one */
  const [slot, setSlot] = useState(0);
  /* with a project open, the article for the project under the pointer,
     built ahead out of sight (its own key, so a click only brings it to
     the front: nothing to build or lay out in that moment) */
  const [pre, setPre] = useState<{ slug: string; key: number } | null>(null);
  const preRef = useRef(pre);
  preRef.current = pre;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const openRef = useRef(open);
  openRef.current = open;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [ready, setReady] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setReady(true)); }, []);
  /* everything on the screen bends with the glass (warp.ts) */
  const tube = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tube.current;
    if (!el) return;
    const stop = curve(el);
    el.dataset.curved = '';
    return stop;
  }, []);

  const show = useCallback((s: string | null, push = true) => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = matchMedia('(max-width: 999px)').matches;
    const was = openRef.current;
    if (s === was) return;
    setOpen(s);
    openRef.current = s;
    if (s) {
      if (was && shownRef.current && !still && !narrow) {
        /* the content on screen now, as it looks this instant */
        const art = document.querySelector<HTMLElement>('.article:not(.is-leaving):not(.is-pre)');
        const inner = art?.querySelector<HTMLElement>('.article-inner');
        const from = inner ? +getComputedStyle(inner).opacity : 1;
        const gone = { slug: shownRef.current, id: slotRef.current, at: art?.scrollTop ?? 0, from };
        setSlot(preRef.current?.slug === s ? preRef.current.key : ++outId.current);
        setOutgoing((list) => [...list.filter((o) => o.slug !== s), gone].slice(-3));
        clearTimeout(swap.current);
        swap.current = window.setTimeout(() => setOutgoing([]), SWITCH + 60);
      } else {
        setOutgoing([]);
        if (preRef.current?.slug === s) setSlot(preRef.current.key);
      }
      setPre(null);
      setShown(s);
    }
    const p = find(s);
    document.title = p ? `${p.name}, David Nguyen` : 'David Nguyen';
    if (push) {
      const url = urlOf(s);
      if (location.pathname !== url) history.pushState({ slug: s }, '', url);
    }
  }, [find]);

  useEffect(() => {
    const onPop = () => show(slugOf(location.pathname), false);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [show]);

  const close = useCallback(() => show(null), [show]);

  /* phones: the article owns scrolling while it is up */
  useEffect(() => {
    const narrow = matchMedia('(max-width: 999px)').matches;
    document.documentElement.style.overflow = open && narrow ? 'hidden' : '';
  }, [open]);

  /* the full size viewer */
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const onZoom = useCallback((src: string, alt: string) => setZoom({ src, alt }), []);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (zoom && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [zoom]);
  /* closing, the picture switches off like a set (a bright line, then
     nothing) before the dialog goes; with reduced motion it just goes */
  const closing = useRef(0);
  const unzoom = () => {
    const d = dialog.current;
    if (!d || !d.open || d.classList.contains('closing')) return;
    const done = () => { d.classList.remove('closing'); d.close(); setZoom(null); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    d.classList.add('closing');
    clearTimeout(closing.current);
    closing.current = window.setTimeout(done, 240);
  };

  /* Escape closes, arrows step through everything in order */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoom || e.metaKey || e.ctrlKey || e.altKey || !open) return;
      /* never while typing, or while the chat has focus */
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], .crt-slot')) return;
      if (e.key === 'Escape') { e.preventDefault(); show(null); return; }
      const i = all.findIndex((p) => p.slug === open);
      if (i < 0) return;
      if (e.key === 'ArrowDown' && i < all.length - 1) { e.preventDefault(); show(all[i + 1].slug); }
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); show(all[i - 1].slug); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, zoom, all, show]);

  /* Hover. A short grace on leaving, so moving between names never
     dips back through the resting colours. */
  const [hot, setHot] = useState<string | null>(null);
  const timer = useRef(0);
  const enter = (s: string, e: React.PointerEvent) => {
    preload(all.find((x) => x.slug === s));
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    setHot(s);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHot(null), 160);
  };

  const [light, setLight] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const sync = () => setLight(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* How much of the screen the article needs: the guide beside it and
     its own column, to the column's right edge. One source of truth for
     the split: the CSS (--side and --col, wider for the resume), read
     from a probe that is always there and sized by exactly those (.split
     in site.css). The article, the chat's panel (.crt-slot in the dock),
     its calm zone and the picture's edge (`cut`) all follow it, so they
     can never disagree, whatever the window or the open article. */
  const [col, setCol] = useState(0);
  const split = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = split.current;
    if (!el) return;
    const narrow = matchMedia('(max-width: 999px)');
    const sync = () => setCol(narrow.matches ? 0 : el.offsetLeft + el.offsetWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    narrow.addEventListener('change', sync);
    return () => { ro.disconnect(); narrow.removeEventListener('change', sync); };
  }, []);
  const cut = open ? col : 0;
  /* the chat glides between the middle and the panel beside an article
     along with the picture's sweep (chat/Live.tsx) */
  const chatOpen = open;

  /* With nothing open and the picture back over the article, the article
     is out of sight, so it quietly takes the project under the pointer: a
     click then only has to slide it in, not build and lay it out in the
     same moment. */
  const [covered, setCovered] = useState(!initial);
  useEffect(() => {
    if (open) { setCovered(false); return; }
    const t = window.setTimeout(() => setCovered(true), WIPE + 60);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (open || !covered || !hot || hot === shownRef.current) return;
    const t = window.setTimeout(() => startTransition(() => setShown(hot)), 120);
    return () => clearTimeout(t);
  }, [hot, open, covered]);
  useEffect(() => {
    if (!open) { setPre(null); return; }
    if (!hot || hot === open || hot === preRef.current?.slug) return;
    const t = window.setTimeout(() => startTransition(() => setPre({ slug: hot, key: ++outId.current })), 120);
    return () => clearTimeout(t);
  }, [hot, open]);

  /* the open project's colour becomes the accent for every link and mark */
  const accent = open && BRAND[open] ? brandAccent(BRAND[open].color, light) : null;

  /* the open project owns the colours; hover previews only when nothing is open */
  const focus = open ?? hot;
  const palette = useMemo(
    () => (focus && BRAND[focus] ? brandPalette(BRAND[focus].color, light) : light ? DEFAULT_PALETTE_LIGHT : DEFAULT_PALETTE),
    [focus, light],
  );

  /* each project's colour, readable as text, for its mark on hover */
  const tint = (slug: string) => (BRAND[slug] ? brandAccent(BRAND[slug].color, light) : undefined);

  return (
    <div className={`stage${open ? ' is-open' : ''}${open === 'cv' ? ' is-doc' : ''}${ready ? ' ready' : ''}`}
      style={accent ? ({ '--link': accent } as React.CSSProperties) : undefined}>
      <Marks slugs={slugs} />
      <div className="tube" ref={tube}>
        <div className="split" ref={split} aria-hidden="true" />
        {/* under the picture, shown where it gives way: the article */}
        <div className="under on-glass">
        {/* switching: what was on screen fades out over the new article,
            the very same article (kept by its key, as it was, where it was
            scrolled) rather than a copy built again in the click; one list,
            so the key carries it from the front to the fading copies */}
        {[
          pre && pre.slug !== shown && (
            <Panel key={`a${pre.key}`} p={find(pre.slug) ?? null} open={false} pre onClose={close} onZoom={onZoom} />
          ),
          <Panel
            key={`a${slot}`}
            p={find(shown) ?? null}
            open={!!open}
            swapping={outgoing.length > 0}
            onClose={close}
            onZoom={onZoom}
          />,
          ...outgoing.map((o) => (
            <Panel key={`a${o.id}`} p={find(o.slug) ?? null} open={false}
              leaving startAt={o.at} from={o.from} onClose={close} onZoom={onZoom} />
          )),
        ]}
        </div>
        <main className="main">
          <Field palette={palette} mark={open} cut={cut} />
        </main>

        {/* over the picture, drawn into it: the guide, the chat, and the
            scanlines that cross everything on the screen */}
        <div className="over on-glass">

        {/* The on screen display: a panel on the glass like a TV's channel
            guide. A header strip (name and the time), a line about David,
            the channels (each with its logo) in three sections, the open one on a
            selection bar, and the links at the foot. */}
        <header className="osd">
          <div className="osd-panel" data-calm="0.9">
            <div className="osd-top">
              <h1 className="name">David Nguyen</h1>
              <Clock />
            </div>
            <p className="bio">I design and build software products. Business at USC Marshall, minoring in Designing for Digital Experiences.</p>

            <nav className="lists" onPointerLeave={leave} aria-label="Work and projects">
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={`h-${s.id}`}>
                  <h2 id={`h-${s.id}`} className="label">{s.title}</h2>
                  <ul>
                    {s.items.map((p) => (
                      <li key={p.slug}>
                        <a
                          className={`channel${open === p.slug ? ' active' : ''}`}
                          style={{ '--tint': tint(p.slug) } as React.CSSProperties}
                          href={`/projects/${p.slug}/`}
                          aria-current={open === p.slug ? 'page' : undefined}
                          onPointerEnter={(e) => enter(p.slug, e)}
                          onFocus={() => preload(p)}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                            e.preventDefault();
                            show(open === p.slug ? null : p.slug);
                          }}
                        >
                          <Mini slug={p.slug} />
                          <span className="ch-name">{p.name}</span>
                          {open === p.slug && (
                            <svg className="x" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>

            {/* the chat's history, drawn here by chat/Corner.tsx */}
            <div id="crt-history-slot"><HistoryShell /></div>

            <ul className="links">
              {LINKS.map((l) => (
                <li key={l.label}><a className="link" href={l.url} target={l.url.startsWith('http') ? '_blank' : undefined} rel="noopener">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </header>

        {/* the chat, in the middle of the screen (#crt-chat-slot, see .crt-slot) */}
        {/* the picture quiets down behind the chat panel beside an open
            project (the panel's box, see .dock-calm), so its replies and
            cards read over any brand's colours */}
        <div className="dock-calm" data-calm={chatOpen ? '0.7' : '0'} aria-hidden="true" />
        <Chat all={all} sections={sections} open={chatOpen} show={show} />
        <div className="lines" aria-hidden="true" />
        </div>

        {/* the glass itself, flat over everything: the tube's edge falling
            into shadow, the corners darker, a reflection high on the left */}
        <div className="glass" aria-hidden="true" />
      </div>

      <dialog ref={dialog} className="viewer" aria-label="Full size image"
        onClick={unzoom} onCancel={(e) => { e.preventDefault(); unzoom(); }}>
        {zoom && <img src={zoom.src} alt={zoom.alt} />}
      </dialog>
    </div>
  );
}
