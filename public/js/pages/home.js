import { h } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { logoMark } from '../components/logo.js';
import { startParticles } from '../components/particles.js';
import { getCapabilities } from '../lib/state.js';

// Decorative CSS compositions. They are labelled as examples and are not AI output.
const EXAMPLES = [
  { art: 'aurora', title: 'Aurore sur une cité de verre', prompt: 'Une aurore boréale au-dessus d’une ville de cristal, vue cinématique' },
  { art: 'city', title: 'Néons après la pluie', prompt: 'Rue cyberpunk au crépuscule, reflets roses et violets' },
  { art: 'orb', title: 'Le cœur du prisme', prompt: 'Sphère d’énergie lumineuse en lévitation, rendu 3D' },
  { art: 'dune', title: 'Désert de lumière', prompt: 'Dunes au coucher du soleil, palette chaude, style illustration' },
  { art: 'wave', title: 'Onde électrique', prompt: 'Ondes lumineuses concentriques, art abstrait' },
  { art: 'prism', title: 'Réfraction', prompt: 'Faisceau traversant un prisme, photographie studio' },
];

function quickCard({ href, iconName, title, text, provider }) {
  const state = provider
    ? provider.configured
      ? h('span', { class: 'tag tag--ok' }, `Connecté · ${provider.model}`)
      : h('span', { class: 'tag tag--off' }, 'Fournisseur à configurer')
    : null;
  const card = h(
    'a',
    { class: 'quick-card', href, 'data-link': '' },
    h('div', { class: 'quick-card__icon' }, icon(iconName)),
    h('h3', {}, title),
    h('p', {}, text),
    state,
    h('span', { class: 'quick-card__go' }, 'Ouvrir le studio', icon('arrow')),
  );
  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
  });
  return card;
}

export function homePage() {
  const caps = getCapabilities();
  const imageProvider = caps?.providers.find((p) => p.kind === 'image');
  const videoProvider = caps?.providers.find((p) => p.kind === 'video');
  const canvas = h('canvas', { 'aria-hidden': 'true' });

  const el = h(
    'div',
    { class: 'page' },
    h(
      'section',
      { class: 'hero' },
      canvas,
      h(
        'div',
        { class: 'container hero__inner' },
        h(
          'div',
          {},
          h('span', { class: 'eyebrow' }, icon('sparkles', { size: 14 }), 'Studio visuel génératif'),
          h('h1', { class: 'hero__title' }, 'Donnez vie à ', h('span', { class: 'gradient-text' }, 'votre imagination.')),
          h(
            'p',
            { class: 'hero__lead' },
            'SOLVEX AI transforme vos idées en images et en vidéos. Décrivez une scène, importez une référence, choisissez un style : le studio s’occupe du reste.',
          ),
          h(
            'div',
            { class: 'hero__cta' },
            h('a', { class: 'btn btn--primary btn--lg', href: '/images', 'data-link': '' }, icon('image'), 'Créer une image'),
            h('a', { class: 'btn btn--lg', href: '/videos', 'data-link': '' }, icon('video'), 'Créer une vidéo'),
          ),
        ),
        h(
          'div',
          { class: 'hero__visual', 'aria-hidden': 'true' },
          h('div', { class: 'orbit' }),
          h('div', { class: 'orbit orbit--2' }, h('span', { class: 'orbit__dot' })),
          h('div', { class: 'orbit orbit--3' }, h('span', { class: 'orbit__dot' })),
          h(
            'div',
            { class: 'hero__tile hero__tile--a' },
            h('div', { class: 'art art--aurora' }),
            h('span', { class: 'hero__tile-label' }, 'Exemple'),
          ),
          h(
            'div',
            { class: 'hero__tile hero__tile--b' },
            h('div', { class: 'art art--city' }),
            h('span', { class: 'hero__tile-label' }, 'Exemple'),
          ),
          h('div', { class: 'hero__mark' }, logoMark({ title: '' })),
        ),
      ),
    ),
    h(
      'section',
      { class: 'section', style: { paddingTop: '8px' } },
      h(
        'div',
        { class: 'container' },
        h('span', { class: 'eyebrow' }, 'Accès rapide'),
        h('h2', { class: 'section__title' }, 'Trois ateliers, un seul studio'),
        h('p', { class: 'section__lead' }, 'Chaque atelier n’affiche que les options réellement prises en charge par le modèle connecté.'),
        h(
          'div',
          { class: 'quick-grid' },
          quickCard({
            href: '/images',
            iconName: 'image',
            title: 'Studio d’images',
            text: 'Texte vers image, image vers image, styles, formats et plusieurs variantes par génération.',
            provider: imageProvider,
          }),
          quickCard({
            href: '/videos',
            iconName: 'video',
            title: 'Studio vidéo',
            text: 'Texte vers vidéo ou animation d’une image de départ, avec suivi réel de la tâche.',
            provider: videoProvider,
          }),
          quickCard({
            href: '/retouche',
            iconName: 'wand',
            title: 'Retouche',
            text: 'Agrandissement, netteté, débruitage et couleurs en local ; modifications ciblées par IA.',
          }),
        ),
      ),
    ),
    h(
      'section',
      { class: 'section', style: { paddingTop: '0' } },
      h(
        'div',
        { class: 'container' },
        h('span', { class: 'eyebrow' }, 'Inspiration'),
        h('h2', { class: 'section__title' }, 'Des idées à explorer'),
        h(
          'p',
          { class: 'section__lead' },
          'Ces visuels sont des compositions décoratives réalisées pour illustrer le studio : ce ne sont pas des générations. Vos propres créations apparaissent dans la galerie.',
        ),
        h(
          'div',
          { class: 'showcase' },
          EXAMPLES.map((example) =>
            h(
              'figure',
              { class: 'showcase__item' },
              h('span', { class: 'tag example-badge' }, 'Exemple illustratif'),
              h('div', { class: `art art--${example.art}`, role: 'img', 'aria-label': `Illustration décorative : ${example.title}` }),
              h('figcaption', {}, h('strong', {}, example.title), h('em', {}, `Idée de prompt : « ${example.prompt} »`)),
            ),
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'section', style: { paddingTop: '0' } },
      h(
        'div',
        { class: 'container' },
        h('span', { class: 'eyebrow' }, 'Comment ça marche'),
        h('h2', { class: 'section__title' }, 'De l’idée au fichier final'),
        h(
          'div',
          { class: 'steps' },
          h(
            'div',
            { class: 'step' },
            h('h3', {}, 'Décrivez'),
            h('p', {}, 'Une phrase suffit. « Améliorer le prompt » peut l’enrichir en détails visuels.'),
          ),
          h(
            'div',
            { class: 'step' },
            h('h3', {}, 'Générez'),
            h('p', {}, 'La tâche est confiée au fournisseur connecté ; son statut réel s’affiche en direct.'),
          ),
          h(
            'div',
            { class: 'step' },
            h('h3', {}, 'Retrouvez'),
            h('p', {}, 'Chaque résultat est conservé dans la galerie du serveur, prêt à être téléchargé ou retouché.'),
          ),
        ),
      ),
    ),
  );

  const stop = startParticles(canvas, { density: 0.00005, speed: 0.12 });
  return { el, title: 'Accueil', cleanup: stop };
}
