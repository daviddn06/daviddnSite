import { useEffect, type RefObject } from 'react';

/* Plays a logo's motion once, start to finish, then leaves it at rest.
   Triggers: the pointer entering the nearest `.logo-host` ancestor (or the
   logo itself when it has no host), keyboard focus landing inside the host,
   and a tap on touch screens. A tap also sets `data-tap` on the host for
   the length of the motion. The motion always finishes, so leaving early
   never snaps the mark back, and it never repeats on its own. Reduced
   motion means nothing plays (logos.css also switches every animation off). */

const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useLogoPlay(ref: RefObject<HTMLElement | null>, duration: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const host = (el.closest('.logo-host') as HTMLElement | null) ?? el;
    let timer = 0;
    let playing = false;

    const play = (tap = false) => {
      if (playing || reduced()) return;
      playing = true;
      el.removeAttribute('data-play');
      void el.getBoundingClientRect(); // restart cleanly if the attribute lingered
      el.setAttribute('data-play', '');
      if (tap) host.setAttribute('data-tap', '');
      timer = window.setTimeout(() => {
        playing = false;
        el.removeAttribute('data-play');
        host.removeAttribute('data-tap');
      }, duration + 40);
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') play();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') play(true);
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as Element | null;
      // keyboard focus only, a mouse click already played on enter
      try {
        if (t && t.matches(':focus-visible')) play();
      } catch {
        play();
      }
    };

    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointerdown', onDown, { passive: true });
    host.addEventListener('focusin', onFocus);
    return () => {
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('focusin', onFocus);
      window.clearTimeout(timer);
      el.removeAttribute('data-play');
    };
  }, [ref, duration]);
}

/** Alias kept for callers that asked for the touch hook by this name. */
export const useLogoTap = useLogoPlay;
