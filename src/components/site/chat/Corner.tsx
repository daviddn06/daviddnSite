/* History in the bottom left corner of the screen, under the guide, in
   its column (Live.tsx renders it beside the chat, on the same curved
   layer as the guide).

   A standing list composed like the guide's channels: New chat at the
   top, then every past conversation, newest first, numbered in the order
   they were started (so a chat keeps its number), titled by its first
   question, with how long ago it was last used. The one on screen is
   marked; with a fresh chat on screen, New chat is. Up and down move
   through it, Enter opens. It fills the room the guide leaves below it
   and scrolls when long, and appears once there is something in it.

   When the window is too short to leave room under the guide it stands
   down, and the chat's own History and New chat buttons take over
   (`onRoom`). Phones reach History from the chat bar (Composer in
   Live.tsx).

   Only opacity and transform move, and only when something changes; the
   room is measured when the guide or the screen changes size, not per
   frame. */
import { useEffect, useRef, useState } from 'react';
import { ago, when, type Convo } from './store';

/* the least room worth standing in: the label, New chat and two chats */
const ROOM = 128;
const GAP = 16;

type Props = {
  /* there is a guide to stand under (not on phones) */
  enabled: boolean;
  chats: Convo[];
  current: string;
  /* the conversation on screen has nothing in it yet */
  fresh: boolean;
  onNew: () => void;
  onPick: (c: Convo) => void;
  /* tells the chat whether the list is standing, so it can hide its own
     History and New chat buttons */
  onRoom: (room: boolean) => void;
};

export function Corner({ enabled, chats, current, fresh, onNew, onPick, onRoom }: Props) {
  const nav = useRef<HTMLElement>(null);

  /* the room under the guide: from just below its panel to the bottom of
     the screen */
  const [room, setRoom] = useState(false);
  useEffect(() => {
    const el = nav.current;
    const layer = el?.offsetParent as HTMLElement | null;
    const guide = document.querySelector<HTMLElement>('.osd-panel');
    if (!enabled || !el || !layer || !guide) { setRoom(false); return; }
    const measure = () => {
      const top = guide.getBoundingClientRect().bottom - layer.getBoundingClientRect().top + GAP;
      const bottom = parseFloat(getComputedStyle(el).bottom) || 0;
      const fits = layer.clientHeight - top - bottom >= ROOM;
      el.style.top = `${Math.round(top)}px`;
      setRoom(fits);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(guide);
    ro.observe(layer);
    return () => ro.disconnect();
  }, [enabled]);

  const on = enabled && room && chats.length > 0;
  useEffect(() => { onRoom(enabled && room); }, [enabled, room, onRoom]);

  /* rows that arrive after the list is first drawn rise in */
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null && chats.length) seen.current = new Set(chats.map((c) => c.id));
  useEffect(() => { chats.forEach((c) => seen.current?.add(c.id)); }, [chats]);

  /* "5m" becomes "6m": a quiet redraw once a minute while it shows */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [on, chats]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...(nav.current?.querySelectorAll<HTMLButtonElement>('.hist-row') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  return (
    <nav ref={nav} className="crt-history" data-on={on ? '' : undefined} aria-label="Chat history" aria-hidden={!on} inert={!on || undefined} onKeyDown={onKey}>
      <p className="hist-label">History</p>
      <button type="button" className="hist-row hist-new" aria-current={fresh ? 'true' : undefined} onClick={onNew}>
        <span className="ch" aria-hidden="true">
          <svg viewBox="0 0 12 12" width="10" height="10"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
        <span className="hist-title">New chat</span>
      </button>
      <ul className="hist-list">
        {chats.map((c, i) => (
          <li key={c.id} className={seen.current && !seen.current.has(c.id) ? 'is-new' : undefined}>
            <button type="button" className="hist-row" aria-current={c.id === current && !fresh ? 'true' : undefined}
              aria-label={`${c.title}, ${when(c.updated)}`} onClick={() => onPick(c)}>
              <span className="ch" aria-hidden="true">{String(chats.length - i).padStart(2, '0')}</span>
              <span className="hist-title">{c.title}</span>
              <span className="hist-when" aria-hidden="true">{ago(c.updated, now)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
