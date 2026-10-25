// Holographic interface (armoured-hero style): floating glass screens (a radar
// that tracks your hands, live system stats, a terminal) and a holographic
// keyboard you really type on: tap a key with a quick finger press, pinch it,
// or rest a fingertip on it. The 🎤 key turns on speech: say something and the
// interface answers out loud. Your fingers pass in front of the holograms.
import { drawGlow, rand, TAU, clamp, noise1 } from './util.js';

const COLORS = [
  { name: 'Holo cyan', rgb: [80, 220, 255] },
  { name: 'Armure or', rgb: [255, 185, 70] },
  { name: 'Alerte rouge', rgb: [255, 80, 70] },
  { name: 'Vert système', rgb: [90, 255, 150] },
];

// AZERTY keyboard; each row: [label, width weight].
const ROWS = [
  'AZERTYUIOP'.split('').map((k) => [k, 1]),
  'QSDFGHJKLM'.split('').map((k) => [k, 1]),
  [
    ['W', 1],
    ['X', 1],
    ['C', 1],
    ['V', 1],
    ['B', 1],
    ['N', 1],
    ['?', 1],
    ['⌫', 2],
  ],
  [
    ['🎤', 1.5],
    ['ESPACE', 6],
    ['↵', 2],
  ],
];

const FONT = (px, weight = 600) => `${weight} ${Math.round(px)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

// Simple local answers (no server): time, date, greetings, help.
function answer(text) {
  const t = text.toLowerCase();
  const now = new Date();
  if (/bonjour|salut|hello|coucou/.test(t)) return 'Bonjour. Tous les systèmes sont opérationnels.';
  if (/heure/.test(t)) return `Il est ${now.getHours()} heures ${String(now.getMinutes()).padStart(2, '0')}.`;
  if (/date|jour|aujourd/.test(t))
    return `Nous sommes le ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;
  if (/merci/.test(t)) return 'À votre service.';
  if (/qui es|ton nom|tu es qui/.test(t)) return 'Je suis l’interface holographique de Magic Cam.';
  if (/aide|help|quoi faire/.test(t)) return 'Tapez sur le clavier holographique, ou appuyez sur le micro et parlez-moi.';
  if (/batterie|énergie|puissance/.test(t)) return 'Réacteur à cent pour cent. Puissance maximale disponible.';
  if (/scan|analyse/.test(t)) return 'Analyse en cours. Deux mains détectées, aucune menace.';
  return `Commande reçue : ${text}. Exécution terminée.`;
}

export function hudEffect() {
  let rgb = COLORS[0].rgb;
  const lines = ['SYSTÈME HOLO v3.0', 'TOUS LES SYSTÈMES EN LIGNE', ''];
  let input = '';
  let open = 0;
  let ripples = [];
  const handState = new Map();
  const speedHistory = [];
  const panelOffset = { radar: { x: 0, y: 0 }, stats: { x: 0, y: 0 }, term: { x: 0, y: 0 } };
  let drag = null;
  let layout = null;
  let listening = false;
  let recog = null;
  let interim = '';
  let speaking = 0;

  const say = (text) => {
    lines.push('» ' + text);
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = 1.05;
      u.pitch = 0.9;
      const voice = synth.getVoices().find((v) => v.lang?.startsWith('fr'));
      if (voice) u.voice = voice;
      u.onstart = () => (speaking = 1);
      u.onend = () => (speaking = 0);
      synth.speak(u);
    } catch {
      /* speech not available */
    }
  };

  const submit = () => {
    const text = input.trim();
    input = '';
    if (!text) return;
    lines.push('> ' + text);
    setTimeout(() => say(answer(text)), 350);
  };

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      lines.push('MICRO : reconnaissance vocale indisponible sur ce navigateur');
      return;
    }
    if (listening) {
      recog?.stop();
      return;
    }
    recog = new SR();
    recog.lang = 'fr-FR';
    recog.interimResults = true;
    recog.continuous = false;
    recog.onresult = (ev) => {
      let fin = '';
      interim = '';
      for (const r of ev.results) r.isFinal ? (fin += r[0].transcript) : (interim += r[0].transcript);
      if (fin) {
        input = fin;
        interim = '';
        submit();
      }
    };
    recog.onend = () => {
      listening = false;
      interim = '';
    };
    recog.onerror = () => (listening = false);
    try {
      recog.start();
      listening = true;
    } catch {
      listening = false;
    }
  };

  const press = (e, key) => {
    e.audio.play('tick', 0.5);
    ripples.push({ key, t: 0 });
    const k = key.label;
    if (k === '⌫') input = input.slice(0, -1);
    else if (k === '↵') submit();
    else if (k === 'ESPACE') input += ' ';
    else if (k === '🎤') toggleMic();
    else input += k;
    if (input.length > 40) input = input.slice(-40);
  };

  // Screen layout, following the body a little (parallax) when visible.
  const computeLayout = (e) => {
    const { W, H } = e;
    const m = Math.min(W, H);
    let follow = 0;
    const b = e.body?.points;
    if (b && e.body.presence > 0.3 && b[11].v > 0.5 && b[12].v > 0.5) follow = ((b[11].x + b[12].x) / 2 - W / 2) * 0.25;
    const kw = Math.min(W * 0.96, m * 1.35);
    const kh = Math.min(H * 0.24, kw * 0.36);
    const kb = { cx: W / 2 + follow * 0.5, y: H * 0.52, w: kw, h: kh };
    const top = H * 0.1;
    const room = kb.y - top - m * 0.04;
    if (W > H * 1.15) {
      // Landscape: radar left, stats right, terminal between them.
      const pw = Math.min(W * 0.26, room / 0.72);
      const ph = pw * 0.72;
      const tw = Math.max(W * 0.3, W - 2 * pw - W * 0.12);
      return {
        radar: { x: W * 0.03 + follow + panelOffset.radar.x, y: top + panelOffset.radar.y, w: pw, h: ph, skew: 0.08 },
        stats: { x: W * 0.97 - pw + follow + panelOffset.stats.x, y: top + panelOffset.stats.y, w: pw, h: ph, skew: -0.08 },
        term: { x: W / 2 - tw / 2 + follow + panelOffset.term.x, y: top + panelOffset.term.y, w: tw, h: ph * 0.62, skew: 0 },
        kb,
      };
    }
    // Portrait: terminal across the top, radar and stats side by side below.
    const th = Math.min(H * 0.13, room * 0.32);
    const pw = W * 0.45;
    const ph = Math.min(pw * 0.72, room - th - m * 0.03);
    return {
      term: { x: W * 0.04 + follow + panelOffset.term.x, y: top + panelOffset.term.y, w: W * 0.92, h: th, skew: 0 },
      radar: { x: W * 0.03 + follow + panelOffset.radar.x, y: top + th + m * 0.03 + panelOffset.radar.y, w: pw, h: ph, skew: 0.06 },
      stats: { x: W * 0.97 - pw + follow + panelOffset.stats.x, y: top + th + m * 0.03 + panelOffset.stats.y, w: pw, h: ph, skew: -0.06 },
      kb,
    };
  };

  // Keyboard keys in perspective (the far row is narrower).
  const keyQuads = (kb) => {
    const map = (u, v) => ({ x: kb.cx + (u - 0.5) * kb.w * (0.84 + 0.16 * v), y: kb.y + v * kb.h });
    const keys = [];
    ROWS.forEach((row, r) => {
      const total = row.reduce((s, [, w]) => s + w, 0);
      let u = 0;
      const v0 = r / ROWS.length + 0.01;
      const v1 = (r + 1) / ROWS.length - 0.01;
      for (const [label, w] of row) {
        const u0 = u / total + 0.004;
        const u1 = (u + w) / total - 0.004;
        u += w;
        keys.push({ label, u0, u1, v0, v1, quad: [map(u0, v0), map(u1, v0), map(u1, v1), map(u0, v1)] });
      }
    });
    const hit = (p) => {
      const v = (p.y - kb.y) / kb.h;
      if (v < 0 || v > 1) return null;
      const u = (p.x - kb.cx) / (kb.w * (0.84 + 0.16 * v)) + 0.5;
      return keys.find((k) => u >= k.u0 && u <= k.u1 && v >= k.v0 && v <= k.v1) || null;
    };
    return { keys, hit };
  };

  const inPanel = (p, pn) => p.x > pn.x && p.x < pn.x + pn.w && p.y > pn.y - 10 && p.y < pn.y + pn.h * 0.22;

  return {
    id: 'hud',
    name: 'Interface holographique',
    colors: COLORS,
    needs: { seg: false, pose: true },
    occlude: true,
    noBlur: true,
    setColor(i) {
      rgb = COLORS[i].rgb;
    },
    // Current terminal state (also handy for checks from the console).
    get typed() {
      return {
        input,
        lines: [...lines],
        keys: [...handState.values()].map((st) => [st.key?.label, st.stable?.label, +st.dwell.toFixed(2), +(st.peak || 0).toFixed(1)]),
      };
    },
    start() {
      open = 0;
      ripples = [];
      handState.clear();
    },
    stop() {
      recog?.stop();
      window.speechSynthesis?.cancel();
    },
    update(dt, hands, e) {
      if (open === 0) e.audio.play('chime', 0.5);
      open = Math.min(1, open + dt * 0.9);
      ripples = ripples.filter((r) => (r.t += dt) < 0.5);
      speaking = Math.max(0, speaking - dt * 0.2);
      layout = computeLayout(e);
      const kq = keyQuads(layout.kb);
      this.kq = kq;
      const live = hands.filter((h) => h.presence > 0.4);
      speedHistory.push(live.reduce((s, h) => Math.max(s, h.speed), 0) / Math.max(1, Math.min(e.W, e.H)));
      if (speedHistory.length > 90) speedHistory.shift();

      for (const h of live) {
        const st = handState.get(h.id) || { key: null, dwell: 0, cool: 0 };
        handState.set(h.id, st);
        const tip = h.lm[8];
        st.cool -= dt;
        // Finger "press": the tip dips quickly relative to its knuckle, or
        // pushes towards the camera.
        const rel = tip.y - h.lm[5].y;
        const relZ = tip.z - h.lm[0].z;
        const dRel = st.rel === undefined ? 0 : (rel - st.rel) / dt;
        const dZ = st.relZ === undefined ? 0 : (relZ - st.relZ) / dt;
        st.rel = rel;
        st.peak = Math.max((st.peak || 0) * 0.97, dRel / h.size);
        st.relZ = relZ;
        const key = kq.hit(tip);
        if (key !== st.key) {
          st.key = key;
          st.dwell = 0;
          if (key) e.audio.play('drop', 0.12);
        }
        // The key the finger has been resting on (a tap slides the tip down,
        // possibly onto the next row: the press goes to the key it came from).
        st.since = key === st.last ? (st.since || 0) + dt : 0;
        st.last = key;
        if (key && st.since > 0.05) st.stable = key;
        const tap = (dRel > h.size * 2.8 || dZ < -h.size * 2.8) && st.cool <= 0;
        const pinch = h.events.pinchStart && kq.hit(h.pinchPoint);
        if (key) st.dwell += dt;
        const target = tap ? st.stable || key : pinch || (st.dwell > 0.9 ? key : null);
        if (target) {
          press(e, target);
          st.cool = 0.28;
          st.dwell = -0.6;
        }
        // Grab a screen by its title bar with a pinch and move it.
        if (h.events.pinchStart && !key) {
          for (const name of ['radar', 'stats', 'term'])
            if (inPanel(h.pinchPoint, layout[name])) drag = { name, id: h.id, x: h.pinchPoint.x, y: h.pinchPoint.y };
          if (drag) e.audio.play('grab', 0.4);
        }
        if (drag?.id === h.id) {
          if (!h.pinch) drag = null;
          else {
            panelOffset[drag.name].x += h.pinchPoint.x - drag.x;
            panelOffset[drag.name].y += h.pinchPoint.y - drag.y;
            drag.x = h.pinchPoint.x;
            drag.y = h.pinchPoint.y;
          }
        }
      }
      for (const id of handState.keys()) if (!hands.some((h) => h.id === id)) handState.delete(id);
      while (lines.length > 6) lines.shift();
      e.audio.loop('hum', 0.12);
    },
    draw(ctx, e) {
      if (!layout) return;
      const t = e.t;
      const [r, g, b] = rgb;
      const col = (a) => `rgba(${r},${g},${b},${a})`;
      const m = Math.min(e.W, e.H);
      const flick = 0.92 + 0.08 * noise1(t * 20);

      // Glass panel with title bar, corner brackets and scanlines.
      const panel = (pn, title, delay, content) => {
        const o = clamp((open - delay) * 3);
        if (o <= 0) return;
        ctx.save();
        ctx.translate(pn.x, pn.y + pn.h / 2);
        ctx.transform(1, pn.skew, 0, o, 0, 0);
        ctx.translate(0, -pn.h / 2);
        ctx.globalAlpha = flick;
        const grad = ctx.createLinearGradient(0, 0, 0, pn.h);
        grad.addColorStop(0, col(0.2));
        grad.addColorStop(1, col(0.07));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, pn.w, pn.h);
        ctx.fillStyle = col(0.05);
        for (let y = 0; y < pn.h; y += 4) ctx.fillRect(0, y, pn.w, 1);
        ctx.strokeStyle = col(0.55);
        ctx.lineWidth = 1.2 * e.unit;
        ctx.strokeRect(0, 0, pn.w, pn.h);
        // Chromatic edge for a real projected-light look.
        ctx.strokeStyle = 'rgba(255,60,90,0.18)';
        ctx.strokeRect(-1.5, 0, pn.w, pn.h);
        ctx.strokeStyle = 'rgba(60,140,255,0.18)';
        ctx.strokeRect(1.5, 0, pn.w, pn.h);
        ctx.strokeStyle = col(1);
        ctx.lineWidth = 3 * e.unit;
        const c = pn.w * 0.08;
        ctx.beginPath();
        for (const [x, y, dx, dy] of [
          [0, 0, 1, 1],
          [pn.w, 0, -1, 1],
          [0, pn.h, 1, -1],
          [pn.w, pn.h, -1, -1],
        ]) {
          ctx.moveTo(x + dx * c, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + dy * c);
        }
        ctx.stroke();
        ctx.fillStyle = col(0.3);
        ctx.fillRect(0, 0, pn.w, pn.h * 0.16);
        ctx.fillStyle = col(1);
        ctx.font = FONT(pn.h * 0.09, 700);
        ctx.textBaseline = 'middle';
        ctx.fillText(title, pn.w * 0.04, pn.h * 0.08);
        ctx.fillText(`● ${String(Math.floor(t * 7) % 100).padStart(2, '0')}`, pn.w * 0.8, pn.h * 0.08);
        content(pn.w, pn.h);
        ctx.restore();
      };

      ctx.globalCompositeOperation = 'source-over';
      panel(layout.radar, 'RADAR', 0, (w, h) => {
        const cx = w / 2;
        const cy = h * 0.58;
        const R = Math.min(w, h) * 0.38;
        ctx.strokeStyle = col(0.45);
        ctx.lineWidth = 1;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(cx, cy, (R * k) / 3, 0, TAU);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx - R, cy);
        ctx.lineTo(cx + R, cy);
        ctx.moveTo(cx, cy - R);
        ctx.lineTo(cx, cy + R);
        ctx.stroke();
        const sweep = t * 2.2;
        for (let k = 0; k < 14; k++) {
          ctx.fillStyle = col(0.22 * (1 - k / 14));
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, R, sweep - (k + 1) * 0.06, sweep - k * 0.06);
          ctx.fill();
        }
        // Your hands are the targets on the radar.
        for (const hnd of e.hands) {
          const x = cx + ((hnd.palm.x / e.W) * 2 - 1) * R * 0.9;
          const y = cy + ((hnd.palm.y / e.H) * 2 - 1) * R * 0.9;
          ctx.fillStyle = 'rgba(255,90,80,0.95)';
          ctx.beginPath();
          ctx.arc(x, y, 3.5 * e.unit, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,90,80,0.7)';
          ctx.beginPath();
          ctx.arc(x, y, (7 + 3 * Math.sin(t * 8)) * e.unit, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = col(0.9);
        ctx.font = FONT(h * 0.07);
        ctx.fillText(`CIBLES : ${e.hands.filter((x) => x.visible).length}`, w * 0.04, h * 0.93);
      });

      panel(layout.stats, 'SYSTÈMES', 0.12, (w, h) => {
        // Live hand speed graph.
        ctx.strokeStyle = col(0.9);
        ctx.lineWidth = 1.5 * e.unit;
        ctx.beginPath();
        speedHistory.forEach((v, i) => {
          const x = w * 0.05 + (i / 90) * w * 0.9;
          const y = h * 0.62 - clamp(v / 3) * h * 0.38;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = col(0.9);
        ctx.font = FONT(h * 0.065);
        ctx.fillText('VITESSE DES MAINS', w * 0.05, h * 0.24);
        const fps = Math.round(1 / Math.max(1e-3, e.dt));
        const bars = [
          ['RÉACTEUR', 0.82 + 0.15 * noise1(t)],
          ['IMAGES/S', clamp(fps / 144)],
          ['BOUCLIERS', 0.6 + 0.3 * noise1(t * 0.7 + 4)],
        ];
        bars.forEach(([name, v], i) => {
          const y = h * (0.72 + i * 0.09);
          ctx.fillStyle = col(0.9);
          ctx.fillText(name, w * 0.05, y);
          ctx.fillStyle = col(0.2);
          ctx.fillRect(w * 0.42, y - h * 0.025, w * 0.5, h * 0.05);
          ctx.fillStyle = col(0.9);
          ctx.fillRect(w * 0.42, y - h * 0.025, w * 0.5 * clamp(v), h * 0.05);
        });
      });

      panel(layout.term, listening ? 'TERMINAL · ÉCOUTE…' : 'TERMINAL', 0.24, (w, h) => {
        ctx.font = FONT(h * 0.1);
        ctx.fillStyle = col(0.95);
        const shown = lines.slice(-4);
        shown.forEach((l, i) => ctx.fillText(l.slice(0, 44), w * 0.03, h * (0.3 + i * 0.14)));
        const cursor = Math.floor(t * 2) % 2 ? '▌' : ' ';
        ctx.fillStyle = '#fff';
        ctx.fillText(`> ${input || interim}${cursor}`, w * 0.03, h * 0.88);
        if (speaking > 0 || listening) {
          // Voice level bars.
          for (let i = 0; i < 12; i++) {
            const v = 0.3 + 0.7 * Math.abs(noise1(t * 12 + i));
            ctx.fillStyle = col(0.8);
            ctx.fillRect(w * 0.72 + i * w * 0.02, h * 0.88 - v * h * 0.12, w * 0.012, v * h * 0.12);
          }
        }
      });

      // Holographic keyboard.
      const ko = clamp((open - 0.3) * 2.5);
      if (ko > 0 && this.kq) {
        const hovered = new Set([...handState.values()].map((s) => s.key).filter(Boolean));
        ctx.save();
        ctx.globalAlpha = ko * flick;
        for (const k of this.kq.keys) {
          const q = k.quad;
          const hot = hovered.has(k);
          const rip = ripples.find((x) => x.key === k);
          ctx.beginPath();
          q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.fillStyle = rip ? `rgba(255,255,255,${0.7 * (1 - rip.t / 0.5)})` : col(hot ? 0.38 : 0.12);
          ctx.fill();
          ctx.strokeStyle = col(hot ? 1 : 0.6);
          ctx.lineWidth = (hot ? 2.2 : 1.1) * e.unit;
          ctx.stroke();
          const cx = (q[0].x + q[2].x) / 2;
          const cy = (q[0].y + q[2].y) / 2;
          ctx.fillStyle = hot || rip ? '#fff' : col(0.95);
          ctx.font = FONT((q[3].y - q[0].y) * 0.5, 700);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(k.label === '🎤' && listening ? '◉' : k.label, cx, cy);
          ctx.textAlign = 'left';
          // Resting a finger fills the key: a gentle way to press it.
          for (const st of handState.values()) {
            if (st.key !== k || st.dwell <= 0.15) continue;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 2 * e.unit;
            ctx.beginPath();
            ctx.arc(cx, cy, (q[3].y - q[0].y) * 0.42, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(st.dwell / 0.9));
            ctx.stroke();
          }
          if (rip) {
            ctx.strokeStyle = col(1 - rip.t / 0.5);
            ctx.lineWidth = 2 * e.unit;
            ctx.beginPath();
            ctx.ellipse(cx, cy, (q[1].x - q[0].x) * (0.6 + rip.t * 3), (q[3].y - q[0].y) * (0.4 + rip.t * 1.5), 0, 0, TAU);
            ctx.stroke();
          }
        }
        // Light projected under the keyboard.
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, rgb, layout.kb.cx, layout.kb.y + layout.kb.h * 1.05, layout.kb.w * 0.35, 0.25, 0.05);
        ctx.restore();
      }
    },
    // Drawn over the real hands: targeting brackets and fingertip reticles.
    drawOver(ctx, e) {
      const t = e.t;
      const [r, g, b] = rgb;
      const col = (a) => `rgba(${r},${g},${b},${a})`;
      const m = Math.min(e.W, e.H);
      for (const h of e.hands) {
        if (h.presence < 0.3) continue;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const p of h.lm) {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        }
        const pad = h.size * 0.25;
        x0 -= pad;
        y0 -= pad;
        x1 += pad;
        y1 += pad;
        const c = Math.min(x1 - x0, y1 - y0) * 0.18;
        ctx.strokeStyle = col(0.9 * h.presence);
        ctx.lineWidth = 2 * e.unit;
        ctx.beginPath();
        for (const [x, y, dx, dy] of [
          [x0, y0, 1, 1],
          [x1, y0, -1, 1],
          [x0, y1, 1, -1],
          [x1, y1, -1, -1],
        ]) {
          ctx.moveTo(x + dx * c, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + dy * c);
        }
        ctx.stroke();
        ctx.fillStyle = col(0.95 * h.presence);
        ctx.font = FONT(m * 0.022);
        ctx.fillText(`MAIN ${h.label === 'Left' ? 'D' : 'G'} · ${Math.round(h.speed / 10)} u/s`, x0, y0 - m * 0.015);
        for (const i of [4, 8]) {
          const p = h.lm[i];
          const R = h.size * 0.16;
          ctx.strokeStyle = col(0.9 * h.presence);
          ctx.lineWidth = 1.5 * e.unit;
          ctx.setLineDash([R * 0.5, R * 0.35]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, R, t * 3, t * 3 + TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    },
  };
}
