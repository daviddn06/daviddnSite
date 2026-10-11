/* Words and settings the still chat and the live one share. */
import type { Project } from '../Media';

/* "ShoSoft AI" reads as "ShoSoft" here */
const short = (p: Project) => p.name.replace(/\s+AI$/, '');
export const noteFor = (p?: Project) => `Ask anything about ${p ? short(p) : 'David'}.`;
export const placeholderFor = (p?: Project) => (p ? `Ask anything about ${short(p)}` : 'Ask anything');

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const NARROW = '(max-width: 999px)';
export type Mode = 'center' | 'dock' | 'bar';
/* wide enough for History to stand in the corner beside the chat */
export const WIDE = '(min-width: 1200px)';
