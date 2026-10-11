/* The chat's connection to the site's backend, `POST /a/chat` on the same
   origin, as an assistant-ui ChatModelAdapter. No key ever lives here;
   the backend holds it.

   Sent: the visitor id the tracker keeps (`dd_v`, if any), the project
   open on screen, and the conversation as plain text, the last 16 turns,
   each of the visitor's messages cut to 800 characters.

   Received: server sent events over the fetch stream, one JSON object
   per `data:` line. Text arrives in pieces, tool calls arrive whole and
   are acted on at once (opening a project goes through the same path as
   clicking it) and kept in the message so their cards render where they
   happened. Each yield carries the whole message so far, as the runtime
   expects. */
import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react';


export const MAX_CHARS = 800;
const MAX_TURNS = 16;

/* what the chat can do to the page */
export type Actions = {
  page: () => string | null;
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
  if (said) return said;
  if (status === 403) return 'The chat only answers on daviddn.dev.';
  if (status === 400) return 'Something in that message did not go through. Try rephrasing it.';
  return 'Something went wrong on my end. Try again in a moment.';
};

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
        body: JSON.stringify({ vid: visitor(), page: actions.page(), messages: history }),
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
    let n = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let changed = false;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let ev: { t?: string; v?: string; name?: string; input?: Record<string, unknown> };
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.t === 'text' && ev.v) {
          const last = parts[parts.length - 1];
          if (last?.type === 'text') last.text += ev.v;
          else parts.push({ type: 'text', text: ev.v });
          changed = true;
        } else if (ev.t === 'ui' && ev.name) {
          const input = ev.input ?? {};
          parts.push({ type: 'tool-call', toolCallId: `ui${Date.now().toString(36)}${n++}`, toolName: ev.name, args: input, argsText: JSON.stringify(input), result: { shown: true } });
          actions.act(ev.name, input);
          changed = true;
        } else if (ev.t === 'error') {
          if (parts.length) yield { content: parts.map((p) => ({ ...p })) };
          throw new Error(ev.v || kindly(500));
        } else if (ev.t === 'done') {
          if (changed) yield { content: parts.map((p) => ({ ...p })) };
          return;
        }
      }
      if (changed) yield { content: parts.map((p) => ({ ...p })) };
    }
  },
});
