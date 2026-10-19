import { h } from '../lib/dom.js';
import { logoMark } from './logo.js';

const reduced = () =>
  document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The SOLVEX mark « alive »: a soft aura, a gentle up-and-down float, and
 * now and then a loop-the-loop. Float and aura are pure CSS; the loops are
 * scheduled here at random intervals and stop when the element leaves the page.
 */
export function livingMark({ size = 'md', title = '' } = {}) {
  const loop = h('span', { class: 'living-mark__loop' }, logoMark({ title }));
  const el = h(
    'span',
    { class: `living-mark living-mark--${size}` },
    h('span', { class: 'living-mark__aura', 'aria-hidden': 'true' }),
    h('span', { class: 'living-mark__ring', 'aria-hidden': 'true' }),
    h('span', { class: 'living-mark__float' }, loop),
  );
  loop.addEventListener('animationend', () => loop.classList.remove('is-looping'));
  let timer;
  const schedule = (first) => {
    timer = setTimeout(
      () => {
        if (!el.isConnected && !first) return; // removed from the page: stop
        if (el.isConnected && !reduced() && !document.hidden) {
          loop.classList.remove('is-looping');
          void loop.offsetWidth; // restart the animation
          loop.classList.add('is-looping');
        }
        schedule(false);
      },
      (first ? 2500 : 7000) + Math.random() * 8000,
    );
  };
  schedule(true);
  // Hovering a large mark triggers a loop right away (a small easter egg).
  if (size !== 'sm') el.addEventListener('pointerenter', () => !reduced() && !loop.classList.contains('is-looping') && loop.classList.add('is-looping'));
  el.stop = () => clearTimeout(timer);
  return el;
}
