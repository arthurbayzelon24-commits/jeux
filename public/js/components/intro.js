import { h, prefersReducedMotion } from '../lib/dom.js';
import { logoMark } from './logo.js';
import { startParticles } from './particles.js';

const SEEN_KEY = 'solvex:intro-seen';
const MIN_DURATION = 2300; // lets the drawing finish; never waits for anything artificial
const MAX_DURATION = 6000; // the studio is revealed even if the server is slow

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode: the intro may simply replay next time.
  }
}

/**
 * Plays the opening sequence once per browser session. The progress bar only
 * advances when the real boot steps passed to `track()` complete.
 * Returns { track(promise, label), done() }.
 */
export function playIntro() {
  if (alreadySeen()) return { track: (promise) => promise, done: () => {} };
  markSeen();

  const reduced = prefersReducedMotion();
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const bar = h('span');
  const status = h('p', { class: 'intro__status', role: 'status' }, 'Initialisation du studio');
  const letters = [...'SOLVEX'].map((letter, index) => h('span', { style: { animationDelay: `${0.95 + index * 0.07}s` } }, letter));
  const ai = h('span', { class: 'ai gradient-text', style: { animationDelay: '1.45s' } }, 'AI');
  const skip = h('button', { class: 'intro__skip', type: 'button' }, 'Passer l’introduction');

  const root = h(
    'div',
    { class: 'intro', role: 'presentation' },
    canvas,
    h(
      'div',
      { class: 'intro__stage' },
      h('div', { class: 'intro__mark' }, h('div', { class: 'intro__halo' }), logoMark({ animated: true })),
      h('p', { class: 'intro__word', 'aria-label': 'SOLVEX AI' }, letters, ai),
      h('div', { class: 'intro__progress', 'aria-hidden': 'true' }, bar),
      status,
    ),
    skip,
  );
  document.body.append(root);
  document.body.style.overflow = 'hidden';
  const stopParticles = startParticles(canvas, { density: 0.00012, speed: 0.12 });

  const started = performance.now();
  let total = 0;
  let completed = 0;
  let finished = false;
  let ready = false;

  function update() {
    bar.style.width = total === 0 ? '0%' : `${Math.round((completed / total) * 100)}%`;
  }

  function finish() {
    if (finished) return;
    finished = true;
    root.classList.add('is-leaving');
    document.body.style.overflow = '';
    setTimeout(() => {
      stopParticles();
      root.remove();
    }, 750);
  }

  function maybeFinish() {
    if (!ready) return;
    const elapsed = performance.now() - started;
    const wait = reduced ? 0 : Math.max(0, MIN_DURATION - elapsed);
    setTimeout(finish, wait);
  }

  skip.addEventListener('click', finish);
  window.addEventListener('keydown', (event) => event.key === 'Escape' && finish(), { once: true });
  setTimeout(finish, MAX_DURATION);

  return {
    track(promise, label) {
      total += 1;
      update();
      status.textContent = label;
      const settle = () => {
        completed += 1;
        update();
      };
      promise.then(settle, settle);
      return promise;
    },
    done() {
      ready = true;
      status.textContent = 'Studio prêt';
      maybeFinish();
    },
  };
}
