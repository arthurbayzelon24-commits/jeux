import { h, clear, formatBytes } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { confirmDialog, toast } from '../components/feedback.js';
import { getPrefs, setPrefs, resetPrefs } from '../lib/prefs.js';
import { startAmbient, stopAmbient, isAmbientPlaying } from '../lib/ambient.js';
import { fetchReleases, checkForUpdates } from '../lib/pwa.js';
import { installBar } from '../components/installBar.js';
import { APP_VERSION, isStatic } from '../lib/env.js';
import { getCapabilities } from '../lib/state.js';
import { storageEstimate, requestPersistence, db } from '../studio/db.js';
import { deleteMedia } from '../studio/media.js';

// SOLVEX has no user accounts, so there is no « Compte » section.
const SECTIONS = [
  ['appearance', 'Apparence', ['appearance', 'sound']],
  ['creation', 'Préférences de création', ['editing', 'ai']],
  ['storage', 'Stockage et projets', ['storage', 'backup']],
  ['install', 'Installation', ['install']],
  ['privacy', 'Confidentialité et sécurité', ['privacy', 'accounts']],
  ['info', 'Informations', ['version', 'help']],
];
const PART_TITLES = {
  sound: 'Son et musique',
  editing: 'Montage',
  ai: 'Services d’IA du serveur',
  storage: 'Stockage',
  backup: 'Sauvegarde',
  accounts: 'Publication vers les réseaux',
  version: 'Version et mises à jour',
  help: 'Aide et raccourcis',
};
// Old links (e.g. ?section=version) keep working.
const ALIASES = { sound: 'appearance', editing: 'creation', ai: 'creation', backup: 'storage', accounts: 'privacy', version: 'info', help: 'info' };

const toggle = (label, key, hint) => {
  const input = h('input', { type: 'checkbox', checked: Boolean(getPrefs()[key]), role: 'switch' });
  input.addEventListener('change', () => setPrefs({ [key]: input.checked }));
  return h('label', { class: 'setting' }, h('span', {}, h('strong', {}, label), hint ? h('small', {}, hint) : null), input);
};

const range = (label, key, min, max, step, format = (v) => v) => {
  const input = h('input', { type: 'range', min, max, step, value: String(getPrefs()[key]) });
  const out = h('output', {}, format(getPrefs()[key]));
  input.addEventListener('input', () => {
    out.textContent = format(Number(input.value));
    setPrefs({ [key]: Number(input.value) });
  });
  return h('label', { class: 'setting' }, h('span', {}, h('strong', {}, label)), h('span', { class: 'setting-range' }, input, out));
};

export function settingsPage({ params }) {
  const asked = ALIASES[params.get('section')] || params.get('section');
  const current = SECTIONS.some(([id]) => id === asked) ? asked : 'appearance';
  const cleanups = [];
  const body = h('div', { class: 'settings-body' });
  const nav = h(
    'nav',
    { class: 'dash-nav', 'aria-label': 'Catégories des paramètres' },
    SECTIONS.map(([id, label]) =>
      h('a', { href: `/parametres?section=${id}`, 'data-link': '', 'aria-current': current === id ? 'page' : null }, label),
    ),
  );
  const title = SECTIONS.find(([id]) => id === current)[1];
  body.append(h('h1', {}, title));
  const install = installBar();
  cleanups.push(install.cleanup);
  if (current !== 'install') body.append(install.el);
  const card = (...children) => h('div', { class: 'panel settings-card' }, ...children);

  const renderPart = (part) => {
  if (PART_TITLES[part]) body.append(h('h2', { class: 'dash-h2' }, PART_TITLES[part]));
  if (part === 'appearance') {
    body.append(
      card(
        toggle('Réduire les animations', 'reduceMotion', 'Désactive les transitions et l’animation d’ouverture.'),
        toggle('Interface compacte', 'compact', 'Réduit les espacements pour les petits écrans.'),
        toggle('Animation d’ouverture', 'showIntro', 'Jouée une fois par session.'),
      ),
    );
  } else if (part === 'sound') {
    const play = h('button', { class: 'btn', type: 'button' });
    const sync = () => {
      play.replaceChildren(icon(isAmbientPlaying() ? 'pause' : 'play'), isAmbientPlaying() ? 'Arrêter la musique' : 'Lancer la musique');
    };
    play.addEventListener('click', async () => {
      try {
        if (isAmbientPlaying()) stopAmbient();
        else await startAmbient();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
      sync();
    });
    sync();
    body.append(
      card(
        h(
          'p',
          { class: 'field__hint' },
          'Musique d’ambiance de l’application, générée en direct (sans licence tierce). Elle n’est jamais ajoutée à vos projets.',
        ),
        h('div', { class: 'insp-actions' }, play),
        toggle('Couper la musique', 'ambientMuted'),
        range('Volume de l’interface', 'ambientVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)} %`),
        toggle(
          'Couper pendant un enregistrement',
          'muteAmbientWhileRecording',
          'Évite que la musique de l’application se retrouve dans vos captures.',
        ),
      ),
    );
  } else if (part === 'editing') {
    const mode = h(
      'select',
      { class: 'select select--sm' },
      h('option', { value: 'simple', selected: getPrefs().editorMode === 'simple' }, 'Débutant'),
      h('option', { value: 'advanced', selected: getPrefs().editorMode === 'advanced' }, 'Avancé'),
    );
    mode.addEventListener('change', () => setPrefs({ editorMode: mode.value }));
    body.append(
      card(
        h('label', { class: 'setting' }, h('span', {}, h('strong', {}, 'Mode de l’éditeur')), mode),
        toggle('Aimantation activée par défaut', 'snapping'),
        range('Durée par défaut des transitions', 'defaultTransition', 0.1, 3, 0.05, (v) => `${v} s`),
        range('Durée par défaut des images', 'defaultImageDuration', 1, 20, 0.5, (v) => `${v} s`),
        toggle('Entendre le son pendant l’export', 'exportMonitor'),
      ),
    );
  } else if (part === 'backup') {
    body.append(
      card(
        toggle(
          'Sauvegarde automatique',
          'autosave',
          'Les projets sont enregistrés peu après chaque modification. Un journal de récupération est écrit à chaque action.',
        ),
        range('Délai de sauvegarde automatique', 'autosaveDelay', 0.5, 30, 0.5, (v) => `${v} s`),
        h(
          'p',
          { class: 'field__hint' },
          'Pour une copie hors du navigateur : Studio → Projets → Exporter (fichier .solvex, médias inclus en option).',
        ),
      ),
    );
  } else if (part === 'storage') {
    const info = h('p', {}, 'Calcul…');
    const persistBtn = h('button', { class: 'btn btn--sm', type: 'button' }, 'Demander un stockage persistant');
    const clearBtn = h('button', { class: 'btn btn--sm btn--danger', type: 'button' }, 'Vider la bibliothèque de médias');
    const refresh = async () => {
      const est = await storageEstimate().catch(() => null);
      const [projects, media] = await Promise.all([db.listProjects().catch(() => []), db.listMedia().catch(() => [])]);
      info.textContent = `${projects.length} projet(s), ${media.length} média(s) (${formatBytes(media.reduce((s, m) => s + (m.size || 0), 0))}).${est ? ` Espace utilisé : ${formatBytes(est.usage)} sur ${formatBytes(est.quota)} disponibles. Stockage ${est.persisted ? 'persistant' : 'non persistant (le navigateur peut le libérer s’il manque de place)'}.` : ''}`;
    };
    persistBtn.addEventListener('click', async () => {
      toast(
        (await requestPersistence())
          ? 'Stockage persistant accordé.'
          : 'Le navigateur a refusé (il l’accorde souvent aux applications installées).',
        { type: 'info' },
      );
      refresh();
    });
    clearBtn.addEventListener('click', async () => {
      if (
        !(await confirmDialog({
          title: 'Vider la bibliothèque ?',
          message: 'Tous les médias importés seront supprimés de ce navigateur. Les projets resteront mais leurs clips seront vides.',
          confirmLabel: 'Tout supprimer',
          danger: true,
        }))
      )
        return;
      for (const m of await db.listMedia()) await deleteMedia(m.id);
      toast('Bibliothèque vidée.', { type: 'success' });
      refresh();
    });
    refresh();
    body.append(card(info, h('div', { class: 'insp-actions' }, persistBtn, clearBtn)));
  } else if (part === 'accounts') {
    body.append(
      card(
        ...['YouTube', 'TikTok', 'WhatsApp'].map((name) =>
          h(
            'div',
            { class: 'setting' },
            h(
              'span',
              {},
              h('strong', {}, name),
              h(
                'small',
                {},
                'Non connecté — la publication directe exige une application OAuth officielle enregistrée auprès du service et configurée côté serveur.',
              ),
            ),
            h('span', { class: 'tag tag--off' }, 'Non disponible'),
          ),
        ),
        h(
          'p',
          { class: 'field__hint' },
          'SOLVEX ne demandera jamais vos mots de passe. En attendant, exportez puis utilisez « Partager » ou l’application du service.',
        ),
      ),
    );
  } else if (part === 'ai') {
    const caps = getCapabilities();
    if (isStatic() || !caps) {
      body.append(
        card(
          h(
            'p',
            {},
            'Version publique sans serveur : aucun service IA n’est connecté. Lancez le serveur SOLVEX (voir README) pour activer la génération.',
          ),
        ),
      );
    } else {
      body.append(
        card(
          ...caps.providers.map((p) =>
            h(
              'div',
              { class: 'setting' },
              h(
                'span',
                {},
                h('strong', {}, p.label),
                h('small', {}, p.configured ? `${p.kind === 'image' ? 'Images' : 'Vidéo'} · connecté` : `Manque : ${p.missing.join(', ')}`),
              ),
              h('span', { class: `tag ${p.configured ? 'tag--ok' : 'tag--off'}` }, p.configured ? 'Connecté' : 'À configurer'),
            ),
          ),
          h(
            'div',
            { class: 'setting' },
            h(
              'span',
              {},
              h('strong', {}, 'Transcription'),
              h('small', {}, caps.transcription?.model ? `Modèle ${caps.transcription.model}` : 'Manque : OPENAI_TRANSCRIBE_MODEL'),
            ),
            h(
              'span',
              { class: `tag ${caps.transcription?.model ? 'tag--ok' : 'tag--off'}` },
              caps.transcription?.model ? 'Connecté' : 'À configurer',
            ),
          ),
          h(
            'div',
            { class: 'setting' },
            h(
              'span',
              {},
              h('strong', {}, 'Amélioration de prompt'),
              h(
                'small',
                {},
                caps.promptEnhancement.method === 'model'
                  ? `Modèle ${caps.promptEnhancement.model}`
                  : 'Règles locales (OPENAI_TEXT_MODEL non défini)',
              ),
            ),
            h('span', { class: 'tag tag--ok' }, 'Actif'),
          ),
          h(
            'p',
            { class: 'field__hint' },
            'Musique et effets sonores par IA, traduction, détourage vidéo et super-résolution IA : aucun fournisseur vérifié n’est branché pour le moment.',
          ),
        ),
      );
    }
  } else if (part === 'privacy') {
    const wipe = h('button', { class: 'btn btn--danger', type: 'button' }, 'Effacer toutes les données locales');
    wipe.addEventListener('click', async () => {
      if (
        !(await confirmDialog({
          title: 'Tout effacer ?',
          message: 'Projets, médias, préférences et journal de récupération seront supprimés de ce navigateur. Irréversible.',
          confirmLabel: 'Tout effacer',
          danger: true,
        }))
      )
        return;
      indexedDB.deleteDatabase('solvex-studio');
      resetPrefs();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      toast('Données locales effacées.', { type: 'success' });
      setTimeout(() => location.reload(), 800);
    });
    body.append(
      card(
        h(
          'p',
          {},
          'Vos projets et médias du studio sont stockés uniquement dans ce navigateur (IndexedDB). Ils ne sont envoyés à un serveur que lorsque vous utilisez une fonction IA ou la galerie SOLVEX, et seulement le fichier nécessaire.',
        ),
        h(
          'p',
          {},
          'Les fichiers envoyés pour une génération sont supprimés du serveur dès la fin du traitement (ou après 60 minutes au plus). Les prompts ne sont pas journalisés.',
        ),
        h('p', {}, 'Les captures d’écran, de webcam et de micro ne démarrent qu’après votre clic et l’autorisation du navigateur.'),
        wipe,
      ),
    );
  } else if (part === 'install') {
    body.append(
      install.el,
      card(
        h('h2', { class: 'dash-h2', style: { marginTop: 0 } }, 'Ce que change l’installation'),
        h(
          'ul',
          { class: 'plain-list' },
          h('li', {}, 'SOLVEX AI s’ouvre dans sa propre fenêtre, avec son icône, comme une application.'),
          h('li', {}, 'L’interface, le montage et la retouche locale fonctionnent hors ligne une fois l’application chargée.'),
          h('li', {}, 'La génération d’images et de vidéos par IA nécessite toujours une connexion Internet.'),
          h('li', {}, 'Chaque mise à jour vous est proposée avec son nom et ses notes : vous choisissez de l’installer ou non.'),
        ),
        h('p', { class: 'field__hint' }, 'Les clés API restent sur le serveur : l’application installée n’en contient aucune.'),
      ),
    );
  } else if (part === 'version') {
    const list = h('div', { class: 'release-list' }, h('p', { class: 'field__hint' }, 'Chargement des mises à jour…'));
    const check = h('button', { class: 'btn', type: 'button' }, icon('refresh'), 'Rechercher des mises à jour');
    check.addEventListener('click', async () => {
      const result = await checkForUpdates({ manual: true });
      if (result === 'up-to-date') toast(`Vous avez la dernière version (${APP_VERSION}).`, { type: 'success' });
      if (result === 'error') toast('Impossible de vérifier les mises à jour (hors ligne ?).', { type: 'error' });
    });
    fetchReleases()
      .then(({ releases }) => {
        clear(list);
        for (const r of releases) {
          list.append(
            h(
              'article',
              { class: 'panel release' },
              h('h3', {}, `${r.version} — ${r.name}`, r.version === APP_VERSION ? h('span', { class: 'tag tag--ok' }, 'installée') : null),
              h('time', { class: 'field__hint' }, new Date(r.date).toLocaleDateString('fr-FR')),
              h(
                'ul',
                {},
                r.notes.map((n) => h('li', {}, n)),
              ),
            ),
          );
        }
      })
      .catch(() => clear(list).append(h('p', { class: 'field__hint' }, 'Historique indisponible hors ligne.')));
    body.append(
      card(h('p', {}, `Version installée : `, h('strong', {}, APP_VERSION)), check),
      h('h2', { class: 'dash-h2' }, 'Historique des mises à jour'),
      list,
    );
  } else if (part === 'help') {
    const keys = [
      ['Espace', 'Lecture / pause'],
      ['S', 'Diviser au curseur'],
      ['Suppr', 'Supprimer la sélection'],
      ['Ctrl+Z / Ctrl+Y', 'Annuler / rétablir'],
      ['Ctrl+C / X / V', 'Copier / couper / coller'],
      ['Ctrl+D', 'Dupliquer'],
      ['Ctrl+G', 'Grouper / dégrouper'],
      ['Ctrl+S', 'Enregistrer'],
      ['I / O', 'Point d’entrée / de sortie'],
      ['M', 'Marqueur'],
      ['N', 'Aimantation'],
      ['← / →', 'Image précédente / suivante (Maj : 1 s)'],
      ['+ / −  ou  Ctrl+molette', 'Zoom de la timeline'],
    ];
    body.append(
      card(
        h('h2', { class: 'dash-h2' }, 'Raccourcis clavier'),
        h(
          'dl',
          { class: 'details' },
          keys.map(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)]),
        ),
      ),
      card(
        h('h2', { class: 'dash-h2' }, 'Ce qui est disponible'),
        h(
          'p',
          {},
          'La liste complète des fonctions (implémentées, limitées ou non disponibles) se trouve dans le fichier FONCTIONNALITES.md du projet.',
        ),
      ),
    );
  }

  };
  for (const part of SECTIONS.find(([id]) => id === current)[2]) renderPart(part);

  return {
    el: h('div', { class: 'page dashboard' }, nav, h('div', { class: 'dash-main' }, body)),
    title: `Paramètres — ${title}`,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}
