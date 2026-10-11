/* Words and settings the still chat and the live one share. */
import type { Project } from '../Media';

/* "ShoSoft AI" reads as "ShoSoft" here */
const short = (p: Project) => p.name.replace(/\s+AI$/, '');
/* the line under the box, the same on every view */
export const noteFor = (_p?: Project) => 'David can make mistakes. Check important info.';
export const placeholderFor = (p?: Project) => (p ? `Text David about ${short(p)}` : 'Message David');

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const NARROW = '(max-width: 999px)';
export type Mode = 'center' | 'dock' | 'bar';
