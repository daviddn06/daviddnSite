import type { ComponentType } from 'react';
import { createElement } from 'react';
import { ProjectLogo, LOGO_META } from './ProjectLogo';

export { ProjectLogo, LOGO_META } from './ProjectLogo';
export type { LogoMeta } from './ProjectLogo';
export { ProjectLockup } from './ProjectLockup';
export { LOCKUPS } from './wordmarks';
export type { Lockup } from './wordmarks';
export { useLogoPlay, useLogoTap } from './useLogoPlay';
export { BRAND } from './brand';
export type { Brand } from './brand';

type SlugLogoProps = { size?: number; className?: string; color?: string };

/** Slug to a ready component, e.g. `const L = LOGOS.vecka; <L size={24} />`. */
export const LOGOS: Record<string, ComponentType<SlugLogoProps>> = Object.fromEntries(
  Object.keys(LOGO_META).map((slug) => {
    const C = (p: SlugLogoProps) => createElement(ProjectLogo, { slug, ...p });
    C.displayName = `Logo(${slug})`;
    return [slug, C];
  }),
);
