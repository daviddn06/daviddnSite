/* Which model answers, beside the send button. The chat runs on Haiku
   5.5; Sonnet 5.5 and Opus 5.5 are listed but locked, so choosing one
   gives a small shake and stays on Haiku. Only for show here, nothing is
   sent to the server. The day's messages show at its foot. A menu that drops down below the pill, or opens
   upward when there is no room below (measured on open), keyboard friendly
   (arrows, Enter, Escape); on phones the pill folds to its icon. */
import { useEffect, useRef, useState } from 'react';

const MODELS = [
  { id: 'haiku', name: 'Haiku 5.5', locked: false },
  { id: 'sonnet', name: 'Sonnet 5.5', locked: true },
  { id: 'opus', name: 'Opus 5.5', locked: true },
];

const Spark = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.8l1.5 4.2 4.2 1.5-4.2 1.5L8 13.2 6.5 9 2.3 7.5 6.5 6z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
);
const Lock = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
);
const Check = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/* the day's messages, shown at the foot of the menu (quota.ts) */
type Usage = { left: number | null; limit: number; team: boolean };
const SEGS = 15;

export function ModelPicker({ usage }: { usage?: Usage }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  /* a click elsewhere closes it */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('pointerdown', onDown);
    return () => removeEventListener('pointerdown', onDown);
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelectorAll<HTMLElement>('[role="option"]')[at]?.focus(); }, [open, at]);

  /* down when it fits under the pill inside the screen, else up */
  const place = () => {
    const b = button.current?.getBoundingClientRect();
    const tube = button.current?.closest('.tube')?.getBoundingClientRect();
    const need = (list.current?.offsetHeight ?? 130) + 16;
    setUp(!!b && (tube ? tube.bottom : innerHeight) - b.bottom < need);
  };
  /* known before it opens too, so the chevron points the right way */
  useEffect(() => {
    place();
    const ro = new ResizeObserver(() => place());
    const tube = button.current?.closest('.tube');
    if (tube) ro.observe(tube);
    if (button.current) ro.observe(button.current);
    /* and again once the chat has settled into a new place (a first
       message, a project opening) */
    let t = 0;
    const mo = new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(place, 650); });
    const chat = button.current?.closest('#crt-chat-slot');
    if (chat) mo.observe(chat, { attributes: true, attributeFilter: ['data-empty', 'data-mode'] });
    return () => { ro.disconnect(); mo.disconnect(); clearTimeout(t); };
  }, []);
  const choose = (i: number) => {
    const m = MODELS[i];
    if (m.locked) {
      setShake(null);
      requestAnimationFrame(() => setShake(m.id));
      return;
    }
    setOpen(false);
    button.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : MODELS.length - 1)) % MODELS.length); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(at); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); button.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const left = usage?.left ?? null;
  const near = left !== null && !usage?.team && left <= SEGS;
  const lit = left === null ? 0 : Math.round((left / (usage?.limit || 100)) * SEGS);
  return (
    <div className="model" ref={root}>
      {/* the chevron points where the menu opens: toward it while closed,
          back once open */}
      <button type="button" ref={button} className="model-pill" aria-haspopup="listbox" aria-expanded={open} aria-label="Model, Haiku 5.5"
        data-flip={up === open ? '' : undefined}
        onClick={() => { if (!open) place(); setAt(0); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); place(); setAt(0); setOpen(true); } }}>
        <Spark /><span className="model-name">Haiku 5.5</span>
        <svg className="model-caret" viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="M2 6.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {near && <span className="model-dot" aria-hidden="true" />}
      </button>
      <div ref={list} className="model-menu" data-on={open ? '' : undefined} data-up={up ? '' : undefined} onKeyDown={onKey} inert={!open || undefined}>
        <ul className="model-list" role="listbox" aria-label="Model">
          {MODELS.map((m, i) => (
            <li key={m.id} role="option" tabIndex={-1} aria-selected={!m.locked && m.id === 'haiku'} aria-disabled={m.locked || undefined}
              className={`model-opt${shake === m.id ? ' is-shaking' : ''}`} onAnimationEnd={() => setShake(null)}
              onClick={() => choose(i)} onPointerEnter={() => setAt(i)}>
              <span className="model-opt-name">{m.name}</span>
              {m.locked ? <span className="model-lock"><Lock />Locked</span> : <span className="model-check"><Check /></span>}
            </li>
          ))}
        </ul>
        {left !== null && (
          <div className="model-usage">
            <span className="quota-bar" aria-hidden="true">
              {Array.from({ length: SEGS }, (_, i) => <i key={i} data-on={i < lit ? '' : undefined} />)}
            </span>
            <span className="model-usage-text">
              {left} of {usage!.limit} messages left today{usage!.team && <span className="model-usage-sub">no limit for you</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
