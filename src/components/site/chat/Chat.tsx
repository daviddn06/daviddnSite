/* The chat, in the middle of the screen. Built on assistant-ui's
   unstyled primitives (thread, messages, composer, autoscroll) with the
   site's own adapter (adapter.ts), styled by chat.css so it reads as text
   on the glass.

   Like ChatGPT. With nothing said yet it is one line picked at random
   above the box and "David can make mistakes. Check important info." under it. Once talking,
   the box settles to the bottom and the conversation reads down from the
   top, each question pinned to the top as it is asked.

   One conversation follows the visitor around the site: opening,
   switching and closing projects keep it, and every message tells the
   server which project is open and where the visitor is in it. With a
   project open the chat docks to the bottom of the strip beside the
   article ("Text David about ShoSoft") that opens upward
   while in use. Under 1000px it is a bar along the bottom of the screen
   that opens into a full screen conversation.

   A page load starts a new conversation; New chat starts one too. Past
   ones are kept in this browser (store.ts) and listed in History, a
   small on screen menu, to read and continue.

   Motion. Everything moves on the site's one curve (--ease), enters a
   little up and in, leaves quicker than it came, and can be interrupted.
   Changing where the chat sits (a project opening) fades it out and in
   rather than sliding it across the screen. Reduced motion turns it all
   off. */
import { memo, useEffect, useMemo, useState } from 'react';
import './chat.css';
import { SiteContext, type Site } from './cards';
import { firstChat, type Convo } from './store';
import { noteFor, placeholderFor } from './shared';
import type { Project } from '../Media';

/* The live chat's code (Live.tsx) is fetched once the page has painted
   and the browser is idle (at most about two seconds in), or at once
   when the visitor reaches for the box, whichever comes first, so it
   never competes with the screen starting up. Until it is here the
   still copy below holds its exact place and takes typing; what was
   typed, the focus and the caret carry over. */
let live: Promise<typeof import('./Live')> | null = null;
const loadLive = () => (live ??= import('./Live'));

export type Draft = { text: string; focused: boolean; start: number; end: number };

/* drawn again only when what it is given changes (the open project), not
   on every hover in the guide */
export const Chat = memo(function Chat(props: Site) {
  const [first, setFirst] = useState<{ convo: Convo | null; Live: typeof import('./Live').Live; draft: Draft | null } | null>(null);
  const [want, setWant] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let id = 0;
    const go = () => setWant(true);
    /* after the first paint, then when idle */
    const raf = requestAnimationFrame(() => {
      id = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 2200 }) : window.setTimeout(go, 1200);
    });
    return () => { cancelAnimationFrame(raf); if (w.cancelIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id); };
  }, []);
  useEffect(() => {
    if (!want) return;
    let on = true;
    loadLive().then(({ Live }) => {
      if (!on) return;
      /* what the visitor already typed into the still box */
      const ta = document.querySelector<HTMLTextAreaElement>('#crt-chat-slot .composer-input');
      const draft = ta && ta.value ? { text: ta.value, focused: document.activeElement === ta, start: ta.selectionStart, end: ta.selectionEnd }
        : ta && document.activeElement === ta ? { text: '', focused: true, start: 0, end: 0 } : null;
      setFirst({ convo: firstChat(), Live, draft });
    });
    return () => { on = false; };
  }, [want]);
  const site = useMemo(() => props, [props.all, props.sections, props.open, props.show]);
  return (
    <SiteContext.Provider value={site}>
      {first ? <first.Live {...props} first={first.convo} draft={first.draft} /> : <Still open={props.open} all={props.all} onReach={() => setWant(true)} />}
    </SiteContext.Provider>
  );
});

/* the chat before it is live: the same layout, nothing to do yet (the
   headline stays blank so a different one never flashes in) */
function Still({ open, all, onReach }: { open: string | null; all: Project[]; onReach: () => void }) {
  const p = all.find((x) => x.slug === open);
  return (
    <div id="crt-chat-slot" className="crt-slot" data-mode={open ? 'dock' : 'center'} data-empty=""
      onPointerDown={onReach} onFocus={onReach} onKeyDown={onReach}>
      <div className="chat">
        <div className="chat-sheet">
          <div className="chat-head" />
          <div className="chat-stage">
            <div className="chat-body" />
            <div className="chat-hello"><div><p className="chat-title">&nbsp;</p></div></div>
          </div>
        </div>
        <div className="composer">
          <textarea className="composer-input" rows={1} placeholder={placeholderFor(p)} aria-label="Message" />
          {/* the model pill and the send button, as the live ones are drawn */}
          <span className="model" aria-hidden="true">
            <span className="model-pill">
              <svg viewBox="0 0 16 16" width="13" height="13"><path d="M8 1.8l1.5 4.2 4.2 1.5-4.2 1.5L8 13.2 6.5 9 2.3 7.5 6.5 6z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
              <span className="model-name">Haiku 5.5</span>
              <svg className="model-caret" viewBox="0 0 10 10" width="8" height="8" style={{ transform: 'rotate(180deg)' }}><path d="M2 6.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
          <span className="composer-btn is-still" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 13V3.5M3.8 7.4 8 3.2l4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
        <p className="chat-note">{noteFor(p)}</p>
        <div className="chat-rest" />
      </div>
    </div>
  );
}
