/* The visitor's daily allowance, as the server reports it with each
   message (`quota`), and a limit when one is reached (`limit`). Kept for
   the tab (sessionStorage) so a reload shows the same. David's own
   browsers are never sent either, so nothing shows for him. */
const KEY = 'dd_quota';

export type Quota = { left: number; limit: number; kind?: 'minute' | 'day'; until?: number };

export const readQuota = (): Quota | null => {
  try {
    const q = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Quota | null;
    if (!q) return null;
    if (q.until && q.until < Date.now()) return { left: q.kind === 'day' ? q.limit : q.left, limit: q.limit };
    return q;
  } catch { return null; }
};

export const writeQuota = (q: Quota) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(q)); } catch { /* blocked */ }
  dispatchEvent(new Event('dd-quota'));
};

/* the meter shows only this close to the limit */
export const NEAR = 15;
