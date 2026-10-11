/* Works out logo distance fields off the page's main thread (marks.ts). */
import { field } from './sdf';

self.onmessage = (e: MessageEvent<{ id: number; a: Uint8ClampedArray; w: number; h: number }>) => {
  const { id, a, w, h } = e.data;
  const { data, on } = field(a, w, h);
  (self as unknown as Worker).postMessage({ id, data, on }, [data.buffer]);
};
