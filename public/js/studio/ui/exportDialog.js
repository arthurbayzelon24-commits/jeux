import { h, formatBytes } from '../../lib/dom.js';
import { saveFile } from '../../lib/download.js';
import { icon } from '../../components/icons.js';
import { openModal, toast } from '../../components/feedback.js';
import { supportedFormats, EXPORT_PRESETS, SOCIAL_PRESETS, exportSize, estimateBytes, exportVideo } from '../engine/exporter.js';
import { projectDuration, changeAspect } from '../project.js';
import { formatTime, importFile } from '../media.js';
import { getPrefs } from '../../lib/prefs.js';

/** Export screen: only settings the MediaRecorder engine can honour are shown. */
export function openExportDialog({ store, player, onSaved }) {
  const project = store.project;
  const formats = supportedFormats();
  const full = projectDuration(project);
  const state = {
    name: project.name.replace(/[\\/:*?"<>|]+/g, '-') || 'solvex-export',
    format: formats[0],
    preset: '1080',
    fps: project.settings.fps,
    mbps: 10,
    range: project.inPoint != null && project.outPoint != null ? 'inout' : 'all',
    monitor: getPrefs().exportMonitor,
  };
  if (!formats.length || full <= 0) {
    openModal(
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', {}, 'Exporter'),
        h(
          'p',
          {},
          !formats.length
            ? 'Ce navigateur ne permet pas l’enregistrement vidéo (MediaRecorder). Utilisez Chrome, Edge ou Firefox récents.'
            : 'Le projet est vide : ajoutez au moins un clip.',
        ),
      ),
      { label: 'Exporter' },
    );
    return;
  }

  const summary = h('div', { class: 'export-summary' });
  const progressBar = h('span');
  const progress = h(
    'div',
    { class: 'job__bar', hidden: true, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    progressBar,
  );
  const status = h('p', { class: 'field__hint', 'aria-live': 'polite' });
  const result = h('div', { class: 'export-result' });
  const go = h('button', { class: 'btn btn--primary', type: 'button' }, icon('download'), 'Exporter');
  const cancel = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true }, 'Annuler l’export');

  const range = () =>
    state.range === 'inout' && project.inPoint != null && project.outPoint != null ? [project.inPoint, project.outPoint] : [0, full];
  const update = () => {
    const { width, height } = exportSize(project, state.preset);
    const [a, b] = range();
    summary.replaceChildren(
      h('div', {}, h('span', {}, 'Dimensions'), h('strong', {}, `${width} × ${height}`)),
      h('div', {}, h('span', {}, 'Durée'), h('strong', {}, formatTime(b - a))),
      h('div', {}, h('span', {}, 'Taille estimée'), h('strong', {}, `≈ ${formatBytes(estimateBytes(b - a, state.mbps))}`)),
      h('div', {}, h('span', {}, 'Temps d’export'), h('strong', {}, `≈ ${formatTime(b - a)} (temps réel)`)),
    );
  };

  const field = (label, control) => h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), control);
  const nameInput = h('input', { class: 'input', value: state.name });
  nameInput.addEventListener('input', () => (state.name = nameInput.value));
  const formatSel = h(
    'select',
    { class: 'select' },
    formats.map((f, i) => h('option', { value: String(i) }, f.label)),
  );
  formatSel.addEventListener('change', () => (state.format = formats[Number(formatSel.value)]));
  const presetSel = h(
    'select',
    { class: 'select' },
    EXPORT_PRESETS.map((p) => h('option', { value: p.id, selected: p.id === state.preset }, p.label)),
  );
  presetSel.addEventListener('change', () => ((state.preset = presetSel.value), update()));
  const fpsSel = h(
    'select',
    { class: 'select' },
    [24, 25, 30, 50, 60].map((f) => h('option', { value: String(f), selected: f === state.fps }, `${f} i/s`)),
  );
  fpsSel.addEventListener('change', () => (state.fps = Number(fpsSel.value)));
  const bitrate = h('input', { type: 'range', min: 1, max: 40, step: 1, value: String(state.mbps) });
  const bitrateOut = h('output', {}, `${state.mbps} Mb/s`);
  bitrate.addEventListener(
    'input',
    () => ((state.mbps = Number(bitrate.value)), (bitrateOut.textContent = `${state.mbps} Mb/s`), update()),
  );
  const rangeSel = h(
    'select',
    { class: 'select' },
    h('option', { value: 'all' }, 'Projet entier'),
    h(
      'option',
      { value: 'inout', disabled: project.inPoint == null || project.outPoint == null, selected: state.range === 'inout' },
      'Entre les points d’entrée et de sortie',
    ),
  );
  rangeSel.addEventListener('change', () => ((state.range = rangeSel.value), update()));
  const monitor = h('input', { type: 'checkbox', checked: state.monitor });
  monitor.addEventListener('change', () => (state.monitor = monitor.checked));

  const social = h(
    'div',
    { class: 'chips' },
    SOCIAL_PRESETS.map((s) =>
      h(
        'button',
        {
          class: 'btn btn--sm',
          type: 'button',
          onclick: () => {
            if (s.aspect && s.aspect !== store.project.settings.aspect) {
              toast(`Le format du projet passe en ${s.aspect} (annulable).`, { type: 'info' });
              store.commit(`Format ${s.label}`, changeAspect(store.project, s.aspect));
            }
            state.preset = s.preset;
            state.fps = s.fps;
            state.mbps = s.bitrate;
            presetSel.value = s.preset;
            fpsSel.value = String(s.fps);
            bitrate.value = String(s.bitrate);
            bitrateOut.textContent = `${s.bitrate} Mb/s`;
            update();
          },
        },
        s.label,
      ),
    ),
  );

  let controller = null;
  go.addEventListener('click', async () => {
    const { width, height } = exportSize(store.project, state.preset);
    const [from, to] = range();
    controller = new AbortController();
    go.disabled = true;
    cancel.hidden = false;
    progress.hidden = false;
    result.replaceChildren();
    status.textContent = 'Export en cours : gardez cet onglet visible jusqu’à la fin.';
    try {
      const { blob, ext } = await exportVideo(player, {
        width,
        height,
        fps: state.fps,
        mbps: state.mbps,
        format: state.format,
        from,
        to,
        monitor: state.monitor,
        signal: controller.signal,
        onProgress: (p) => {
          progressBar.style.width = `${Math.round(p * 100)}%`;
          progress.setAttribute('aria-valuenow', String(Math.round(p * 100)));
        },
      });
      const filename = `${state.name || 'solvex-export'}.${ext}`;
      const url = URL.createObjectURL(blob);
      status.textContent = `Export terminé : ${formatBytes(blob.size)}.`;
      const file = new File([blob], filename, { type: blob.type });
      const share = navigator.canShare?.({ files: [file] })
        ? h(
            'button',
            { class: 'btn', type: 'button', onclick: () => navigator.share({ files: [file], title: state.name }).catch(() => {}) },
            'Partager…',
          )
        : null;
      const save = h('button', { class: 'btn', type: 'button' }, 'Ajouter à la bibliothèque');
      save.addEventListener('click', async () => {
        save.disabled = true;
        try {
          await importFile(file, { name: filename, origin: 'export' });
          toast('Export ajouté à la bibliothèque de médias.', { type: 'success' });
          onSaved?.();
        } catch (error) {
          toast(error.message, { type: 'error' });
          save.disabled = false;
        }
      });
      result.replaceChildren(
        h('video', { src: url, controls: true, class: 'export-preview' }),
        h(
          'div',
          { class: 'insp-actions' },
          h(
            'button',
            {
              class: 'btn btn--primary',
              type: 'button',
              onclick: () => saveFile(blob, filename).catch((error) => toast(error.message, { type: 'error' })),
            },
            icon('download'),
            `Télécharger ${filename}`,
          ),
          share,
          save,
        ),
        h(
          'p',
          { class: 'field__hint' },
          'Publication directe sur YouTube, TikTok ou WhatsApp : non configurée (elle exige une autorisation OAuth officielle côté serveur). Téléchargez le fichier ou utilisez « Partager » puis publiez depuis l’application du service.',
        ),
      );
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'Export annulé.' : `Échec de l’export : ${error.message}`;
    } finally {
      go.disabled = false;
      cancel.hidden = true;
    }
  });
  cancel.addEventListener('click', () => controller?.abort());

  update();
  const modal = openModal(
    h(
      'div',
      { class: 'dialog__body export-dialog' },
      h('h2', {}, 'Exporter la vidéo'),
      h('p', { class: 'field__hint' }, 'Préréglages réseaux sociaux'),
      social,
      h(
        'div',
        { class: 'grid-2' },
        field('Nom du fichier', nameInput),
        field('Format', formatSel),
        field('Résolution', presetSel),
        field('Images par seconde', fpsSel),
        field('Plage', rangeSel),
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'field__label' }, 'Débit vidéo'),
          h('div', { class: 'insp-row' }, bitrate, bitrateOut),
        ),
      ),
      h('label', { class: 'insp-check' }, monitor, 'Entendre le son pendant l’export'),
      summary,
      progress,
      status,
      h('div', { class: 'dialog__actions', style: { padding: 0 } }, cancel, go),
      result,
    ),
    { label: 'Exporter la vidéo' },
  );
  modal.dialog.classList.add('dialog--wide');
  modal.dialog.addEventListener('close', () => controller?.abort());
}
