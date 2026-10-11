/* The chat, in the middle of the screen. Built on assistant-ui's
   unstyled primitives (thread, messages, composer, autoscroll) with the
   site's own adapter (adapter.ts), styled by chat.css so it reads as text
   on the glass.

   Like ChatGPT. With nothing said yet it is one line picked at random
   above the box and "Ask anything about David." under it. Once talking,
   the box settles to the bottom and the conversation reads down from the
   top, each question pinned to the top as it is asked.

   One conversation follows the visitor around the site: opening,
   switching and closing projects keep it, and every message tells the
   server which project is open and where the visitor is in it. With a
   project open the chat docks to the bottom of the strip beside the
   article as a slim bar ("Ask anything about ShoSoft") that opens upward
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
import { useEffect, useMemo, useState } from 'react';
import './chat.css';
import { SiteContext, type Site } from './cards';
import { firstChat, type Convo } from './store';
import { noteFor, placeholderFor } from './shared';
import type { Project } from '../Media';

/* the live chat's code, asked for as soon as this runs in the browser so
   it loads alongside the rest of the page rather than inside it */
let live: Promise<typeof import('./Live')> | null = null;
const loadLive = () => (live ??= import('./Live'));
if (typeof window !== 'undefined') loadLive();

export function Chat(props: Site) {
  /* the server renders a still copy; the live chat takes over once the
     page is running and its code (Live.tsx, loaded on its own) is here */
  const [first, setFirst] = useState<{ convo: Convo | null; Live: typeof import('./Live').Live } | null>(null);
  useEffect(() => {
    let on = true;
    loadLive().then(({ Live }) => { if (on) setFirst({ convo: firstChat(), Live }); });
    return () => { on = false; };
  }, []);
  const site = useMemo(() => props, [props.all, props.sections, props.open, props.show]);
  return (
    <SiteContext.Provider value={site}>
      {first ? <first.Live {...props} first={first.convo} /> : <Still open={props.open} all={props.all} />}
    </SiteContext.Provider>
  );
}

/* the chat before it is live: the same layout, nothing to do yet (the
   headline stays blank so a different one never flashes in) */
function Still({ open, all }: { open: string | null; all: Project[] }) {
  const p = all.find((x) => x.slug === open);
  return (
    <div id="crt-chat-slot" className="crt-slot" data-mode={open ? 'dock' : 'center'} data-empty="">
      <div className="chat">
        <div className="chat-sheet">
          <div className="chat-head" />
          <div className="chat-stage">
            <div className="chat-body" />
            <div className="chat-hello"><div><p className="chat-title">&nbsp;</p></div></div>
          </div>
        </div>
        <div className="composer">
          <textarea className="composer-input" rows={1} placeholder={placeholderFor(p)} aria-label="Message" disabled />
          <span className="composer-btn" aria-hidden="true" />
        </div>
        <p className="chat-note">{noteFor(p)}</p>
        <div className="chat-rest" />
      </div>
    </div>
  );
}

