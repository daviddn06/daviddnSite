/* The chat's connection to the site's backend, `POST /a/chat` on the same
   origin, as an assistant-ui ChatModelAdapter. No key ever lives here;
   the backend holds it.

   Sent: the visitor id the tracker keeps (`dd_v`, if any), this
   conversation's id, the project open on screen and where the visitor is
   in it (the heading they are reading, how far down, desktop or phone),
   and the conversation as plain text, the last 16 turns, each of the
   visitor's messages cut to 800 characters.

   Received: server sent events over the fetch stream, one JSON object
   per `data:` line. Text arrives in pieces, tool calls arrive whole and
   are acted on at once (opening a project goes through the same path as
   clicking it) and kept in the message so their cards render where they
   happened. Each yield carries the whole message so far, as the runtime
   expects. Text that only repeats what already arrived, and a card asked
   for twice in one answer, are dropped, so an answer never shows twice. */
import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react';


export const MAX_CHARS = 800;
const MAX_TURNS = 16;

/* what the chat can do to the page */
export type Context = { section: string; scrolled: number; viewport: 'desktop' | 'phone' };
export type Actions = {
  cid: () => string;
  page: () => string | null;
  context: () => Context;
  act: (name: string, input: Record<string, unknown>) => void;
};

type Part =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, any>; argsText: string; result: { shown: true } };

const textOf = (m: ThreadMessage) =>
  m.content.map((p) => (p.type === 'text' ? p.text : '')).join('').trim();

const visitor = () => {
  try { return localStorage.getItem('dd_v'); } catch { return null; }
};

/* kind words for the ways a request can fail */
const kindly = (status: number, said?: string) => {
  if (status === 413) return 'That message is a bit long for me. Try a shorter one.';
  if (status === 429) return 'That is a lot of messages at once. Give it a minute and try again.';
  if (status === 403) return 'The chat can only answer on daviddn.dev, in an everyday browser.';
  if (said) return said;
  if (status === 400) return 'Something in that message did not go through. Try rephrasing it.';
  return 'Something went wrong on my end. Try again in a moment.';
};

/* the next frame, or a moment later where frames are not running (a
   tab in the background) */
const frame = () => new Promise<void>((resolve) => {
  const t = setTimeout(resolve, 50);
  requestAnimationFrame(() => { clearTimeout(t); resolve(); });
});

export const chatAdapter = (actions: Actions): ChatModelAdapter => ({
  async *run({ messages, abortSignal }) {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.role === 'user' ? textOf(m).slice(0, MAX_CHARS) : textOf(m) }))
      .filter((m) => m.content)
      .slice(-MAX_TURNS);

    let res: Response;
    try {
      res = await fetch('/a/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vid: visitor(), cid: actions.cid(), page: actions.page(), context: actions.context(), messages: history }),
        signal: abortSignal,
      });
    } catch (e) {
      if (abortSignal.aborted) throw e;
      throw new Error('I could not reach the chat just now. Check your connection and try again.');
    }
    if (!res.ok || !res.body) {
      let said: string | undefined;
      try { said = (await res.json())?.error; } catch { /* not JSON */ }
      throw new Error(kindly(res.status, typeof said === 'string' ? said : undefined));
    }

    const parts: Part[] = [];
    const asked = new Set<string>();
    let n = 0;
    const soFar = () => parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
    const snapshot = () => ({ content: parts.map((p) => ({ ...p })) });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    /* what the stream has said since the message was last handed over */
    let changed = false;
    let ended: { error?: string } | null = null;
    const take = (value: Uint8Array) => {
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while (!ended && (nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let ev: { t?: string; v?: string; name?: string; input?: Record<string, unknown> };
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.t === 'text' && ev.v) {
          /* a replay of everything so far keeps only what is new */
          let v = ev.v;
          const so = soFar();
          if (so.length >= 24 && v.startsWith(so)) v = v.slice(so.length);
          if (!v) continue;
          const last = parts[parts.length - 1];
          if (last?.type === 'text') last.text += v;
          else parts.push({ type: 'text', text: v });
          changed = true;
        } else if (ev.t === 'ui' && ev.name) {
          const input = ev.input ?? {};
          const key = ev.name + JSON.stringify(input);
          if (asked.has(key)) continue;
          asked.add(key);
          parts.push({ type: 'tool-call', toolCallId: `ui${Date.now().toString(36)}${n++}`, toolName: ev.name, args: input, argsText: JSON.stringify(input), result: { shown: true } });
          actions.act(ev.name, input);
          changed = true;
        } else if (ev.t === 'error') {
          ended = { error: ev.v || kindly(500) };
        } else if (ev.t === 'done') {
          ended = {};
        }
      }
    };
    /* Pieces that arrive within one frame go to the screen together: the
       message is handed over as soon as something new arrives, but at
       most once a frame, so a quick burst of pieces costs one redraw, not
       one each. Reading never waits on it. */
    const read = () => { const r = reader.read(); r.catch(() => {}); return r; };
    let next = read();
    let eof = false;
    let tick: Promise<null> | null = null;
    while (!eof && !ended) {
      const { value, done } = await next;
      if (done) break;
      next = read();
      take(value);
      if (!changed || ended) continue;
      /* already handed over this frame: gather until the next one */
      while (tick && !ended) {
        const got = await Promise.race([next, tick]);
        if (!got) break;
        if (got.done) { eof = true; break; }
        next = read();
        take(got.value);
      }
      if (ended) break;
      changed = false;
      const t: Promise<null> = frame().then(() => { if (tick === t) tick = null; return null; });
      tick = t;
      yield snapshot();
    }
    if (ended?.error !== undefined) {
      if (parts.length) yield snapshot();
      throw new Error(ended.error);
    }
    if (changed) yield snapshot();
  },
});
