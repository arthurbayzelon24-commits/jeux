import { h } from '../../lib/dom.js';
import { isEmbedded } from '../../lib/env.js';
import { icon } from '../../components/icons.js';
import { openModal, toast } from '../../components/feedback.js';
import { importFile, formatTime } from '../media.js';
import { setRecordingActive } from '../../lib/ambient.js';

const MODES = [
  ['screen', 'Écran, fenêtre ou onglet'],
  ['camera', 'Webcam'],
  ['both', 'Écran + webcam (incrustation)'],
  ['mic', 'Microphone seul (narration)'],
];

function pickMime(video) {
  const list = video
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return list.find((m) => window.MediaRecorder?.isTypeSupported(m)) || '';
}

/**
 * Screen / webcam / microphone recorder. Nothing is captured before the user
 * presses « Démarrer » and grants the browser permission.
 */
export function openRecorder({ onRecorded, mode: initialMode = 'screen' } = {}) {
  if (isEmbedded()) {
    openModal(
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', {}, 'Enregistrement'),
        h(
          'p',
          {},
          'La capture d’écran, de webcam et de micro n’est pas autorisée dans la version publique en ligne. Elle fonctionne quand SOLVEX est lancé depuis son serveur (npm start) ou installé comme application.',
        ),
      ),
      { label: 'Enregistrement' },
    );
    return;
  }
  if (!window.MediaRecorder || !navigator.mediaDevices) {
    openModal(
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', {}, 'Enregistrement'),
        h('p', {}, 'Ce navigateur ne permet pas l’enregistrement (MediaRecorder / mediaDevices indisponibles).'),
      ),
      { label: 'Enregistrement' },
    );
    return;
  }
  let mode = initialMode;
  let streams = [];
  let recorder = null;
  let chunks = [];
  let raf = 0;
  let timer = 0;
  let elapsed = 0;
  let paused = false;

  const modeSel = h(
    'select',
    { class: 'select' },
    MODES.map(([id, label]) => h('option', { value: id, selected: id === mode }, label)),
  );
  modeSel.addEventListener('change', () => (mode = modeSel.value));
  const micBox = h('input', { type: 'checkbox', checked: true });
  const sysBox = h('input', { type: 'checkbox', checked: true });
  const countdownBox = h('input', { type: 'checkbox', checked: true });
  const preview = h('video', { class: 'rec-preview', muted: true, playsInline: true, autoplay: true });
  const overlay = h('div', { class: 'rec-countdown', hidden: true });
  const clock = h('span', { class: 'rec-clock', 'aria-live': 'off' }, '00:00');
  const start = h('button', { class: 'btn btn--primary', type: 'button' }, '● Démarrer');
  const pause = h('button', { class: 'btn', type: 'button', hidden: true }, 'Pause');
  const stop = h('button', { class: 'btn btn--danger', type: 'button', hidden: true }, '■ Arrêter');
  const status = h(
    'p',
    { class: 'field__hint', 'aria-live': 'polite' },
    'Choisissez une source puis démarrez. Le navigateur vous demandera l’autorisation.',
  );

  const stopAll = () => {
    cancelAnimationFrame(raf);
    clearInterval(timer);
    streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streams = [];
    setRecordingActive(false);
  };

  async function acquire() {
    const wantMic = micBox.checked || mode === 'mic';
    if (mode === 'mic') {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      streams.push(mic);
      return mic;
    }
    let display = null;
    let camera = null;
    if (mode === 'screen' || mode === 'both') {
      if (!navigator.mediaDevices.getDisplayMedia) throw new Error('La capture d’écran n’est pas prise en charge par ce navigateur.');
      display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: sysBox.checked });
      streams.push(display);
    }
    if (mode === 'camera' || mode === 'both') {
      camera = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streams.push(camera);
    }
    let mic = null;
    if (wantMic) {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => null);
      if (mic) streams.push(mic);
      else toast('Microphone refusé ou absent : enregistrement sans micro.', { type: 'info' });
    }
    let videoTrack;
    if (mode === 'both') {
      // Composite screen + webcam bubble on a canvas.
      const sv = h('video', { muted: true, playsInline: true });
      sv.srcObject = display;
      const cv = h('video', { muted: true, playsInline: true });
      cv.srcObject = camera;
      await Promise.all([sv.play(), cv.play()]);
      const canvas = document.createElement('canvas');
      const settings = display.getVideoTracks()[0].getSettings();
      canvas.width = settings.width || 1920;
      canvas.height = settings.height || 1080;
      const ctx = canvas.getContext('2d');
      const draw = () => {
        ctx.drawImage(sv, 0, 0, canvas.width, canvas.height);
        const w = canvas.width * 0.22;
        const hh = (w * 9) / 16;
        const x = canvas.width - w - 32;
        const y = canvas.height - hh - 32;
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, hh, 20);
        else ctx.rect(x, y, w, hh);
        ctx.clip();
        ctx.drawImage(cv, x, y, w, hh);
        ctx.restore();
        ctx.strokeStyle = '#4263FF';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, hh);
        raf = requestAnimationFrame(draw);
      };
      draw();
      const canvasStream = canvas.captureStream(30);
      streams.push(canvasStream);
      videoTrack = canvasStream.getVideoTracks()[0];
    } else {
      videoTrack = (display || camera).getVideoTracks()[0];
    }
    // Mix system audio + microphone through Web Audio.
    const audioTracks = [...(display?.getAudioTracks() || []), ...(mic?.getAudioTracks() || [])];
    const out = new MediaStream([videoTrack]);
    if (audioTracks.length === 1) out.addTrack(audioTracks[0]);
    else if (audioTracks.length > 1) {
      const actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      for (const track of audioTracks) actx.createMediaStreamSource(new MediaStream([track])).connect(dest);
      out.addTrack(dest.stream.getAudioTracks()[0]);
    }
    // Stop when the user ends the share from the browser bar.
    videoTrack.addEventListener('ended', () => recorder?.state === 'recording' && recorder.stop());
    return out;
  }

  start.addEventListener('click', async () => {
    start.disabled = true;
    try {
      const stream = await acquire();
      preview.srcObject = stream;
      preview.hidden = mode === 'mic';
      setRecordingActive(true);
      if (countdownBox.checked) {
        overlay.hidden = false;
        for (const n of [3, 2, 1]) {
          overlay.textContent = String(n);
          await new Promise((r) => setTimeout(r, 1000));
        }
        overlay.hidden = true;
      }
      const isVideo = mode !== 'mic';
      const mimeType = pickMime(isVideo);
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        stopAll();
        pause.hidden = stop.hidden = true;
        start.hidden = false;
        start.disabled = false;
        const type = recorder.mimeType.split(';')[0] || (isVideo ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunks, { type });
        const name = `${isVideo ? 'Enregistrement' : 'Narration'} ${new Date().toLocaleString('fr-FR')}`;
        status.textContent = 'Import dans la bibliothèque…';
        try {
          const meta = await importFile(new File([blob], `${name}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type }), {
            name,
            origin: 'recording',
          });
          status.textContent = `Enregistrement ajouté (${formatTime(meta.duration)}).`;
          onRecorded?.(meta);
        } catch (error) {
          status.textContent = `Import impossible : ${error.message}`;
        }
      };
      recorder.start(1000);
      elapsed = 0;
      paused = false;
      timer = setInterval(() => {
        if (!paused) clock.textContent = formatTime(++elapsed);
      }, 1000);
      start.hidden = true;
      pause.hidden = stop.hidden = false;
      status.textContent = 'Enregistrement en cours…';
    } catch (error) {
      stopAll();
      start.disabled = false;
      status.textContent =
        error.name === 'NotAllowedError' ? 'Autorisation refusée : rien n’a été enregistré.' : `Impossible de démarrer : ${error.message}`;
    }
  });
  pause.addEventListener('click', () => {
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      paused = true;
      pause.textContent = 'Reprendre';
    } else {
      recorder.resume();
      paused = false;
      pause.textContent = 'Pause';
    }
  });
  stop.addEventListener('click', () => recorder?.state !== 'inactive' && recorder.stop());

  const modal = openModal(
    h(
      'div',
      { class: 'dialog__body recorder' },
      h('h2', {}, icon('video', { size: 20 }), ' Enregistreur'),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Source'), modeSel),
      h(
        'div',
        { class: 'chips' },
        h('label', { class: 'insp-check' }, micBox, 'Microphone'),
        h('label', { class: 'insp-check' }, sysBox, 'Son système (si le navigateur le permet)'),
        h('label', { class: 'insp-check' }, countdownBox, 'Compte à rebours'),
      ),
      h('div', { class: 'rec-stage' }, preview, overlay, h('span', { class: 'rec-badge' }, '● REC ', clock)),
      h('div', { class: 'dialog__actions', style: { padding: 0 } }, start, pause, stop),
      status,
    ),
    { label: 'Enregistreur' },
  );
  modal.dialog.classList.add('dialog--wide');
  modal.dialog.addEventListener('close', () => {
    if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
    else stopAll();
  });
}
