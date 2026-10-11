/* Which model answers, beside the send button. The chat runs on Haiku
   5.5; Sonnet 5.5 and Opus 5.5 are listed but locked, so choosing one
   gives a small shake and stays on Haiku. Only for show here, nothing is
   sent to the server. A menu that opens upward, keyboard friendly
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

export function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  /* a click elsewhere closes it */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('pointerdown', onDown);
    return () => removeEventListener('pointerdown', onDown);
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelectorAll<HTMLElement>('[role="option"]')[at]?.focus(); }, [open, at]);

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

  return (
    <div className="model" ref={root}>
      <button type="button" ref={button} className="model-pill" aria-haspopup="listbox" aria-expanded={open} aria-label="Model, Haiku 5.5"
        onClick={() => { setAt(0); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setAt(0); setOpen(true); } }}>
        <Spark /><span className="model-name">Haiku 5.5</span>
        <svg className="model-caret" viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="M2 6.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <ul ref={list} className="model-menu" role="listbox" aria-label="Model" data-on={open ? '' : undefined} onKeyDown={onKey} inert={!open || undefined}>
        {MODELS.map((m, i) => (
          <li key={m.id} role="option" tabIndex={-1} aria-selected={!m.locked && m.id === 'haiku'} aria-disabled={m.locked || undefined}
            className={`model-opt${shake === m.id ? ' is-shaking' : ''}`} onAnimationEnd={() => setShake(null)}
            onClick={() => choose(i)} onPointerEnter={() => setAt(i)}>
            <span className="model-opt-name">{m.name}</span>
            {m.locked ? <span className="model-lock"><Lock />Locked</span> : <span className="model-check"><Check /></span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
