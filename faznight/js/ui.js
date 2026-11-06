/* FAZNIGHT — menus, collection, trophies, custom night, settings, extras and every overlay. */
(function (FN) {
  const A = FN.Art, R = FN.Rooms, AU = FN.Audio, T = FN.t;
  const $ = (s, r = document) => r.querySelector(s);
  const D = () => FN.Save.data;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------------------------------------------------------------- custom-night presets
  const PRESETS = {
    1: [
      { id: 'c1_nocam', name: { fr: 'Nuit sans caméra', en: 'No-camera night' }, rule: { fr: 'Caméras désactivées', en: 'Cameras disabled' }, levels: [6, 8, 8, 6], rules: { noCam: true } },
      { id: 'c1_nolight', name: { fr: 'Nuit sans lumière', en: 'No-light night' }, rule: { fr: 'Lumières des portes désactivées', en: 'Door lights disabled' }, levels: [6, 8, 8, 8], rules: { noLight: true } },
      { id: 'c1_lowpower', name: { fr: 'Énergie limitée', en: 'Low power' }, rule: { fr: 'Départ à 50 % d’énergie', en: 'Start at 50% power' }, levels: [5, 7, 7, 7], rules: { lowPower: true } },
      { id: 'c1_flawless', name: { fr: 'Nuit sans erreur', en: 'Flawless night' }, rule: { fr: 'Ne jamais descendre sous 25 % et aucune charge de Krok', en: 'Never drop below 25% and no Krok charge' }, levels: [8, 10, 10, 10], rules: { flawless: true } },
      { id: 'c1_allmax', name: { fr: 'Tous au maximum', en: 'All at max' }, rule: { fr: '20 / 20 / 20 / 20', en: '20 / 20 / 20 / 20' }, levels: [20, 20, 20, 20], rules: {} },
      { id: 'c1_nightmare', name: { fr: 'Nuit cauchemardesque', en: 'Nightmare night' }, rule: { fr: 'Tous à 15, événements rares fréquents', en: 'All at 15, frequent rare events' }, levels: [15, 15, 15, 15], rules: {} },
      { id: 'c1_hollow', secret: 'codehollow', name: { fr: 'Nuit du Creux', en: 'Hollow night' }, rule: { fr: 'Il vient chaque heure', en: 'It comes every hour' }, levels: [8, 8, 8, 8], rules: { hollow: true } },
    ],
    2: [
      { id: 'c2_nocam', name: { fr: 'Nuit sans caméra', en: 'No-camera night' }, rule: { fr: 'Tablette désactivée', en: 'Tablet disabled' }, levels: [8, 8, 8, 8, 6, 0, 0], rules: { noCam: true } },
      { id: 'c2_nolight', name: { fr: 'Nuit sans lumière', en: 'No-light night' }, rule: { fr: 'Lampe désactivée', en: 'Flashlight disabled' }, levels: [8, 8, 8, 0, 8, 8, 6], rules: { noLight: true } },
      { id: 'c2_lowpower', name: { fr: 'Pile faible', en: 'Weak battery' }, rule: { fr: 'Lampe à 50 %', en: 'Flashlight at 50%' }, levels: [8, 8, 8, 8, 6, 8, 5], rules: { lowPower: true } },
      { id: 'c2_allmax', name: { fr: 'Tous au maximum', en: 'All at max' }, rule: { fr: 'Tout le monde à 20', en: 'Everyone at 20' }, levels: [20, 20, 20, 20, 20, 20, 20], rules: {} },
      { id: 'c2_nightmare', name: { fr: 'Nuit cauchemardesque', en: 'Nightmare night' }, rule: { fr: 'Tous à 15', en: 'All at 15' }, levels: [15, 15, 15, 15, 15, 15, 15], rules: {} },
      { id: 'c2_hollow', secret: 'codehollow', name: { fr: 'Nuit du Creux', en: 'Hollow night' }, rule: { fr: 'Il attend dans le couloir', en: 'It waits in the hallway' }, levels: [8, 8, 8, 8, 8, 8, 8], rules: { hollow: true } },
    ],
  };

  // ---------------------------------------------------------------- animated canvases (menus)
  const anims = new Set();
  let menuRAF = 0, menuLast = 0;
  function animate(canvas, draw) { const a = { canvas, draw }; anims.add(a); return a; }
  function clearAnims(root) { for (const a of [...anims]) if (!a.keep && (!root || root.contains(a.canvas))) anims.delete(a); }
  function menuLoop(now) {
    menuRAF = requestAnimationFrame(menuLoop);
    if (now - menuLast < (D().settings.perf ? 66 : 33)) return;
    menuLast = now;
    const t = now / 1000;
    for (const a of anims) {
      if (!a.canvas.isConnected || a.canvas.offsetParent === null) continue;
      try { a.draw(a.canvas.getContext('2d'), a.canvas.width, a.canvas.height, t); } catch (e) { console.error(e); anims.delete(a); }
    }
  }
  function fitCanvas(cv, scale = 1) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, D().settings.quality === 'high' ? 2 : 1.25) * scale;
    const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }

  // ---------------------------------------------------------------- menu background
  const eyesState = { next: 2, show: 0, x: 0.5, y: 0.5, id: 'bruno' };
  function drawMenuBg(ctx, W, H, t) {
    const bg = R.menu(960, 540);
    const s = Math.max(W / 960, H / 540);
    const ox = (W - 960 * s) / 2 + Math.sin(t * 0.07) * 20 * s, oy = (H - 540 * s) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, ox, oy, 960 * s, 540 * s);
    // silhouettes on the stage
    const stageY = oy + 540 * s * 0.6;
    const flick = Math.random() < 0.03 ? 0 : 1;
    const wide = W / H > 1.25, cx = wide ? 0.68 : 0.5;
    [['gus', cx - 0.12], ['bruno', cx], ['nora', cx + 0.12]].forEach(([id, x], i) => {
      A.drawChar(ctx, id, W * x, wide ? stageY : H * 0.97, wide ? 540 * s * 0.42 : H * 0.3, { t: t + i * 2, pose: 'idle', light: 0.07 * flick, eyes: Math.max(0, Math.sin(t * 0.4 + i * 2.1) - 0.6) * 2.5, tilt: Math.sin(t * 0.3 + i) * 0.05 });
    });
    // eyes that briefly appear in the dark
    eyesState.next -= 1 / 30;
    if (eyesState.next <= 0 && !eyesState.show) { eyesState.show = 1.2; eyesState.x = Math.random() < 0.5 ? 0.08 + Math.random() * 0.1 : 0.82 + Math.random() * 0.1; eyesState.y = 0.45 + Math.random() * 0.2; eyesState.id = ['krok', 'gus', 'nora', 'bruno'][Math.floor(Math.random() * 4)]; }
    if (eyesState.show > 0) {
      eyesState.show -= 1 / 30;
      const a = Math.sin((eyesState.show / 1.2) * Math.PI);
      A.drawChar(ctx, eyesState.id, W * eyesState.x, H * (eyesState.y + 0.55), H * 0.9, { t, light: 0, eyes: a });
      if (eyesState.show <= 0) eyesState.next = 4 + Math.random() * 8;
    }
    ctx.fillStyle = `rgba(0,0,0,${0.25 + (Math.random() < 0.05 ? 0.4 : 0)})`; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W * 0.7, 0); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    A.staticFx(ctx, W, H, D().settings.perf ? 0.05 : 0.09, t);
    A.scanlines(ctx, W, H, 0.12);
  }

  // ---------------------------------------------------------------- toasts
  // one notification at a time so the screen never fills up during a night
  const toastQueue = [];
  let toastBusy = false;
  function toast(cls, title, sub, icon) { toastQueue.push([cls, title, sub, icon]); if (!toastBusy) nextToast(); }
  function nextToast() {
    const n = toastQueue.shift();
    if (!n) { toastBusy = false; return; }
    toastBusy = true;
    const [cls, title, sub, icon] = n;
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = `<div class="medal">${icon || ''}</div><div><b>${esc(title)}</b><span>${esc(sub || '')}</span></div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 5000);
    setTimeout(nextToast, toastQueue.length ? 2600 : 600);
  }

  // ---------------------------------------------------------------- overlay helpers
  const ov = () => $('#overlay');
  function overlay(html, trans) {
    const o = ov();
    o.className = trans ? 'trans' : '';
    o.innerHTML = html;
    return o;
  }
  function hideOverlay() { const o = ov(); o.className = 'hidden'; o.innerHTML = ''; }
  function confirmBox(text, ok) {
    const o = overlay(`<div class="mid" style="max-width:520px;line-height:1.5">${esc(text)}</div><div class="btns"><button class="mbtn" data-a="yes">OK</button><button class="mbtn" data-a="no">${T('close')}</button></div>`, true);
    o.querySelector('[data-a=yes]').onclick = () => { hideOverlay(); ok(); };
    o.querySelector('[data-a=no]').onclick = hideOverlay;
  }
  function letter(title, text, after) {
    const o = overlay(`<div class="letter"><h3>${esc(title)}</h3><p>${esc(text)}</p></div><div class="btns"><button class="mbtn" data-a="ok">${T('close')}</button></div>`, true);
    AU.play('uiSelect');
    o.querySelector('[data-a=ok]').onclick = () => { hideOverlay(); after && after(); };
  }

  // ---------------------------------------------------------------- screens
  let current = 'home';
  let bgAnim = null;
  const history = [];
  function show(id, push = true) {
    if (push && current !== id && id !== 'game') history.push(current);
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    $('#menuBg').style.display = id === 'game' ? 'none' : '';
    current = id;
    clearAnims();
    if (id !== 'game') {
      if (!menuRAF) menuRAF = requestAnimationFrame(menuLoop);
      if (AU.ready && !AU._musicOut) AU.music('menu');
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
    } else { cancelAnimationFrame(menuRAF); menuRAF = 0; AU.stopMusic(); }
    if (!bgAnim) {
      const bg = $('#menuBg');
      bgAnim = { canvas: bg, keep: true, draw: (c, w, h, t) => { fitCanvas(bg, 0.8); drawMenuBg(c, bg.width, bg.height, t); } };
      anims.add(bgAnim);
    }
    const fn = BUILD[id];
    if (fn) fn();
  }
  function back() { const prev = history.pop() || 'home'; show(prev, false); AU.play('uiMove'); }

  // ---------------------------------------------------------------- HOME
  function refreshHome() {
    const d = D();
    const c = $('#btnContinue');
    if (d.resume) {
      const r = d.resume;
      c.innerHTML = `${T('resume')}<span class="small">${esc(T('resumeSub', { chapter: T('chapter', { n: r.cfg.chapter }), night: r.cfg.night === 'custom' ? 'C' : r.cfg.night, hour: FN.util.HOURS[r.hour || 0] + ' AM' }))}</span>`;
      c.disabled = false;
    } else {
      const ch = d.last.chapter || 1;
      const anyDone = Object.keys(d.chapters[1].done).length || Object.keys(d.chapters[2].done).length;
      c.innerHTML = `${T('continue')}<span class="small">${anyDone ? esc(T('continueSub', { chapter: T('chapter', { n: ch }), night: Math.min(7, d.chapters[ch].next) })) : esc(T('newGameSub'))}</span>`;
      c.disabled = !anyDone;
    }
    const cu = d.customUnlocked[1] || d.customUnlocked[2];
    $('#btnCustom').innerHTML = `${T('customNight')}${cu ? '' : `<span class="small">🔒 ${esc(T('customLocked'))}</span>`}`;
    $('#btnExtras').classList.toggle('hidden', Object.keys(d.secrets).length < 2);
    $('#profileLine').textContent = `${d.name} · ${FN.Trophies.count()}/${FN.Trophies.list.length} ★`;
  }

  // ---------------------------------------------------------------- NIGHT SELECT
  let nightsChapter = 1;
  function buildNights() {
    const d = D();
    const grid = $('#nightGrid');
    $('#nightsTitle').textContent = T('nightsOf', { chapter: T('chapter', { n: nightsChapter }) });
    const chap = d.chapters[nightsChapter];
    let html = '';
    if (d.chapters[2].unlocked) {
      html += `<div class="seg" style="grid-column:1/-1">${[1, 2].map((n) => `<button data-ch="${n}" class="${n === nightsChapter ? 'on' : ''}">${T('chapter', { n })}</button>`).join('')}</div>`;
    }
    for (let n = 1; n <= 7; n++) {
      const locked = n > chap.next;
      const doneN = chap.done[n];
      html += `<button class="night-card ${doneN ? 'done' : ''} ${locked ? 'locked' : ''} ${n >= 6 ? 'secret' : ''}" data-n="${n}"><b>${T('night', { n })}</b><span>${T('n' + n)}</span></button>`;
    }
    html += `<button class="night-card" data-new="1"><b>${T('newGame')}</b><span>${T('chapter', { n: nightsChapter })}</span></button>`;
    grid.innerHTML = html;
    grid.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => { nightsChapter = +b.dataset.ch; buildNights(); AU.play('uiMove'); }));
    grid.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => { AU.play('uiSelect'); FN.Game.start({ chapter: nightsChapter, night: +b.dataset.n }); }));
    grid.querySelector('[data-new]').onclick = () => confirmBox(T('newGameConfirm'), () => {
      const c = D().chapters[nightsChapter]; c.done = {}; c.next = 1; D().resume = null; FN.Save.flush();
      FN.Game.start({ chapter: nightsChapter, night: 1 });
    });
  }

  // ---------------------------------------------------------------- COLLECTION
  function chapterPct(ch) {
    const d = D();
    const nights = Object.keys(d.chapters[ch].done).length;
    const chars = FN.charsOf(ch).filter((id) => d.seen[id]).length;
    const total = 7 + FN.charsOf(ch).length;
    return { nights, pct: Math.round(((nights + chars) / total) * 100) };
  }
  function drawPoster(ch, locked) {
    return (c, W, H, t) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      const bg = R.bg(ch, ch === 1 ? '01' : '09');
      const s = Math.max(W / 960, H / 540);
      c.drawImage(bg, (W - 960 * s) / 2 + Math.sin(t * 0.2) * 10, (H - 540 * s) / 2, 960 * s, 540 * s);
      const ids = ch === 1 ? ['gus', 'bruno', 'nora'] : ['rico', 'pepper', 'lumi'];
      ids.forEach((id, i) => A.drawChar(c, id, W * (0.25 + i * 0.25), H * (0.92 + (i === 1 ? 0.03 : 0)), H * (i === 1 ? 0.7 : 0.6), { t: t + i, pose: locked ? 'idle' : i === 1 ? 'stage' : 'dance', light: locked ? 0 : 0.8, eyes: locked ? 0.6 + Math.sin(t * 3 + i) * 0.3 : 0.6 }));
      const g = c.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.font = `bold ${W * 0.1}px Georgia`; c.textAlign = 'center'; c.fillStyle = locked ? '#555' : '#f0e4c8'; c.shadowColor = '#c4161c'; c.shadowBlur = locked ? 0 : 14;
      c.fillText(ch === 1 ? 'PIZZA PALACE' : 'FUN FACTORY', W / 2, H * 0.14); c.shadowBlur = 0;
      if (locked) {
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#555'; c.lineWidth = W * 0.02;
        c.beginPath(); c.moveTo(0, H * 0.2); c.lineTo(W, H * 0.8); c.moveTo(W, H * 0.2); c.lineTo(0, H * 0.8); c.stroke();
        c.font = `${W * 0.2}px serif`; c.fillStyle = '#aaa'; c.fillText('🔒', W / 2, H * 0.58);
      }
      A.staticFx(c, W, H, 0.08, t);
    };
  }
  function buildCollection() {
    const d = D();
    const list = $('#chapterList');
    const card = (ch) => {
      const unlocked = d.chapters[ch].unlocked;
      const p = chapterPct(ch);
      const tr = FN.Trophies.list.filter((x) => (ch === 1 ? /^(b_first|b_krok|b_call|s_three|s_secret|s_census|s_dark|g_ch1|g_n6|g_n7)$/ : /^(b_ch2|b_wind|s_ch2three|s_mask|g_ch2|g_ch2n6|g_ch2n7)$/).test(x.id));
      const got = tr.filter((x) => d.trophies[x.id]).length;
      const status = !unlocked ? T('status_locked') : p.nights >= 7 ? T('status_done') : T('status_progress');
      return `<button class="chapter ${unlocked ? '' : 'locked'}" data-ch="${ch}"><canvas></canvas><div class="info"><b>${T('chapter', { n: ch })} — ${ch === 1 ? 'Grimwood’s Pizza Palace' : 'Grimwood’s Fun Factory'}</b>
        <span>${status}${unlocked ? '' : ' — ' + esc(T('unlockHint1'))}</span>
        <div class="progress"><i style="width:${unlocked ? p.pct : 0}%"></i></div>
        <span>${T('progressPct', { p: unlocked ? p.pct : 0 })} · ${T('nightsDone', { n: p.nights, t: 7 })} · ${T('trophiesCount', { n: got, t: tr.length })}</span></div></button>`;
    };
    list.innerHTML = card(1) + card(2) + `<div class="chapter locked"><canvas data-soon="1"></canvas><div class="info"><b>${T('chapter', { n: 3 })} — ???</b><span>${T('comingSoon')}</span></div></div>`;
    list.querySelectorAll('.chapter canvas').forEach((cv) => {
      fitCanvas(cv);
      const ch = cv.closest('[data-ch]') ? +cv.closest('[data-ch]').dataset.ch : 0;
      if (ch) animate(cv, drawPoster(ch, !d.chapters[ch].unlocked));
      else animate(cv, (c, W, H, t) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); A.staticFx(c, W, H, 0.25, t); c.font = `bold ${W * 0.25}px Georgia`; c.textAlign = 'center'; c.fillStyle = '#333'; c.fillText('?', W / 2, H * 0.6); });
    });
    list.querySelectorAll('button[data-ch]').forEach((b) => (b.onclick = () => {
      const ch = +b.dataset.ch;
      if (!d.chapters[ch].unlocked) { AU.play('denied'); return; }
      nightsChapter = ch; AU.play('uiSelect'); show('nights');
    }));
    buildBestiary();
  }
  function buildBestiary() {
    const d = D();
    const ids = [...FN.charsOf(1), ...FN.charsOf(2), 'hollow'];
    const el = $('#bestiary');
    el.innerHTML = ids.map((id) => {
      const c = FN.CHARS[id], seen = d.seen[id];
      return `<button class="beast" data-id="${id}"><canvas></canvas><div><b>${seen ? esc(FN.L(c.name)) : T('unknown')}</b><span>${seen ? esc(FN.L(c.role)) : T('notSeen')}</span></div></button>`;
    }).join('');
    el.querySelectorAll('.beast').forEach((b) => {
      const id = b.dataset.id, cv = b.querySelector('canvas'), seen = d.seen[id];
      fitCanvas(cv);
      animate(cv, (c, W, H, t) => {
        c.setTransform(1, 0, 0, 1, 0, 0);
        const g = c.createRadialGradient(W / 2, H * 0.4, 5, W / 2, H / 2, W * 0.8); g.addColorStop(0, '#2a2020'); g.addColorStop(1, '#050505');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        A.drawChar(c, id, W / 2, H * 1.25, H * 1.25, { t, pose: id === 'lumi' ? 'float' : 'idle', light: seen ? 0.95 : 0, eyes: seen ? 1 : 0.35 });
        A.staticFx(c, W, H, 0.06, t);
      });
      b.onclick = () => { if (seen) beastDetail(id); else AU.play('denied'); };
    });
  }
  function beastDetail(id) {
    const c = FN.CHARS[id];
    const kills = D().stats.kills[id] || 0;
    const o = overlay(`<canvas class="full"></canvas><div style="background:#000b;padding:16px;border-radius:8px;max-width:560px;margin-top:auto"><div class="mid">${esc(FN.L(c.name))}</div>
      <div class="small">${esc(FN.L(c.role))}</div><div class="small" style="color:#ddd">${esc(FN.L(c.desc))}</div>
      <div class="small"><b>${T('tips')} :</b> ${esc(FN.L(c.hint))}</div><div class="small">☠ ${kills}</div>
      <div class="btns" style="margin:12px auto 0"><button class="mbtn">${T('close')}</button></div></div>`, false);
    const cv = o.querySelector('canvas');
    fitCanvas(cv);
    const a = animate(cv, (ctx, W, H, t) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
      const pose = ['idle', 'walk', 'stage', 'dance'][Math.floor(t / 4) % 4];
      A.drawChar(ctx, id, W / 2, H * 0.98, H * 0.9, { t, pose: id === 'lumi' ? 'float' : pose, light: 0.9, eyes: 1, jaw: Math.max(0, Math.sin(t * 1.3)) * 0.5 });
      A.vignette(ctx, W, H, 0.8);
    });
    o.querySelector('.mbtn').onclick = () => { anims.delete(a); hideOverlay(); };
  }

  // ---------------------------------------------------------------- TROPHIES
  function buildTrophies() {
    const d = D();
    const list = FN.Trophies.list;
    const got = FN.Trophies.count();
    const pct = Math.round((got / list.length) * 100);
    const byTier = (tier) => list.filter((t) => t.tier === tier && d.trophies[t.id]).length + '/' + list.filter((t) => t.tier === tier).length;
    $('#trophSummary').innerHTML = `<span class="big">${pct} %</span><span>${T('t_total')} : ${got}/${list.length}</span>
      <span style="color:var(--bronze)">✦ ${byTier('bronze')}</span><span style="color:var(--silver)">✧ ${byTier('silver')}</span><span style="color:var(--gold)">★ ${byTier('gold')}</span><span style="color:var(--plat)">◆ ${byTier('platinum')}</span>
      <div class="progress"><i style="width:${pct}%"></i></div>`;
    $('#trophGrid').innerHTML = list.map((t) => {
      const g = d.trophies[t.id];
      return `<button class="troph ${t.tier} ${g ? 'got' : ''}" data-id="${t.id}"><div class="medal">${FN.Trophies.icon(t.tier)}</div><div><b>${esc(FN.L(t.name))}</b><span>${esc(FN.L(t.desc))}</span><span>${T(t.tier)} · ${g ? esc(T('obtained', { d: new Date(g).toLocaleDateString(FN.lang) })) : T('notObtained')}</span></div></button>`;
    }).join('');
    $('#trophGrid').querySelectorAll('.troph').forEach((b) => (b.onclick = () => {
      const t = list.find((x) => x.id === b.dataset.id), g = d.trophies[t.id];
      const o = overlay(`<div class="troph ${t.tier} ${g ? 'got' : ''}" style="transform:scale(1.25);max-width:340px"><div class="medal">${FN.Trophies.icon(t.tier)}</div><div><b>${esc(FN.L(t.name))}</b><span>${esc(FN.L(t.desc))}</span></div></div>
        <div class="small" style="margin-top:30px">${T(t.tier)} — ${g ? esc(T('obtained', { d: new Date(g).toLocaleString(FN.lang) })) : T('notObtained')}</div><div class="btns"><button class="mbtn">${T('close')}</button></div>`, true);
      o.querySelector('.mbtn').onclick = hideOverlay;
    }));
  }
  function toastTrophy(t) {
    AU.play('trophy');
    toast(t.tier, T('trophyUnlocked') + ' — ' + T(t.tier), FN.L(t.name), FN.Trophies.icon(t.tier));
  }

  // ---------------------------------------------------------------- CUSTOM NIGHT
  let customCh = 1, customLv = null, customPreset = null;
  function buildCustom() {
    const d = D();
    if (!d.customUnlocked[customCh] && d.customUnlocked[customCh === 1 ? 2 : 1]) customCh = customCh === 1 ? 2 : 1;
    const ids = FN.charsOf(customCh);
    if (!customLv || customLv.ch !== customCh) { customLv = { ch: customCh }; ids.forEach((id) => (customLv[id] = 5)); customPreset = null; }
    $('#customChapter').innerHTML = [1, 2].map((n) => `<button data-ch="${n}" class="${n === customCh ? 'on' : ''}" ${d.chapters[n].unlocked ? '' : 'disabled'}>${T('chapter', { n })}</button>`).join('');
    $('#customChapter').querySelectorAll('button').forEach((b) => (b.onclick = () => { customCh = +b.dataset.ch; customLv = null; buildCustom(); }));
    const locked = !d.customUnlocked[customCh];
    const presets = PRESETS[customCh].filter((p) => !p.secret || d.secrets[p.secret]);
    $('#presetList').innerHTML = `<button class="preset ${!customPreset ? 'on' : ''}" data-p="">${T('freePlay')}</button>` +
      presets.map((p) => `<button class="preset ${customPreset === p.id ? 'on' : ''} ${d.challengesDone[p.id] ? 'done' : ''}" data-p="${p.id}">${esc(FN.L(p.name))}<small>${esc(FN.L(p.rule))}</small></button>`).join('');
    $('#presetList').querySelectorAll('.preset').forEach((b) => (b.onclick = () => {
      const p = presets.find((x) => x.id === b.dataset.p);
      customPreset = p ? p.id : null;
      if (p) ids.forEach((id, i) => (customLv[id] = p.levels[i]));
      AU.play('uiMove'); buildCustom();
    }));
    $('#sliderList').innerHTML = ids.map((id) => `<div class="slider-card" data-id="${id}"><canvas></canvas><div class="name">${esc(d.seen[id] ? FN.L(FN.CHARS[id].name) : T('unknown'))}</div>
      <div class="lvl"><button data-d="-1">−</button><output>${customLv[id]}</output><button data-d="1">+</button></div></div>`).join('');
    $('#sliderList').querySelectorAll('.slider-card').forEach((card) => {
      const id = card.dataset.id, cv = card.querySelector('canvas');
      fitCanvas(cv);
      animate(cv, (c, W, H, t) => {
        c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#080606'; c.fillRect(0, 0, W, H);
        const lv = customLv[id];
        A.drawChar(c, id, W / 2, H * 1.35, H * 1.35, { t, pose: lv >= 15 ? 'attack' : 'idle', light: d.seen[id] ? 0.35 + lv * 0.03 : 0, eyes: lv / 20, jaw: lv / 30 });
        if (lv === 0) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H); }
      });
      card.querySelectorAll('[data-d]').forEach((b) => {
        let iv = 0;
        const step = () => { customLv[id] = Math.max(0, Math.min(20, customLv[id] + +b.dataset.d)); card.querySelector('output').textContent = customLv[id]; customPreset = null; updateInfo(); AU.play('uiMove'); };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); step(); iv = setTimeout(function rep() { step(); iv = setTimeout(rep, 90); }, 400); });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(iv));
      });
    });
    const updateInfo = () => {
      const total = ids.reduce((a, id) => a + customLv[id], 0);
      $('#customInfo').innerHTML = locked ? `🔒 ${esc(T('customLocked'))}` : `${T('totalLevel', { n: total + ' / ' + ids.length * 20 })}<br>${T('bestRecord', { n: d.customRecords[customCh] })}`;
      $('#presetList').querySelectorAll('.preset').forEach((b) => b.classList.toggle('on', (b.dataset.p || null) === customPreset));
    };
    updateInfo();
    const go = $('#customGo');
    go.disabled = locked;
    go.onclick = () => {
      if (locked) return;
      const p = PRESETS[customCh].find((x) => x.id === customPreset);
      const levels = {}; ids.forEach((id) => (levels[id] = customLv[id]));
      AU.play('uiSelect');
      FN.Game.start({ chapter: customCh, night: 'custom', levels, challenge: p ? p.id : null, rules: p ? p.rules : {} });
    };
  }
  function presetName(id) { for (const ch of [1, 2]) { const p = PRESETS[ch].find((x) => x.id === id); if (p) return p.name; } return id; }

  // ---------------------------------------------------------------- SETTINGS
  let tapeTaps = 0;
  function buildSettings() {
    const d = D(), s = d.settings;
    const opts = (key, values, labels) => `<div class="opts" data-key="${key}">${values.map((v, i) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${labels[i]}</button>`).join('')}</div>`;
    const range = (key, min = 0, max = 1, step = 0.05) => `<input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}" />`;
    const onoff = (key) => opts(key, ['true', 'false'], [T('on'), T('off')]);
    $('#settingsBody').innerHTML = `
      <h4>${T('s_profile')}</h4>
      <div class="row"><label>${T('s_name')}</label><input type="text" id="nameInput" maxlength="18" value="${esc(d.name)}" /></div>
      <div class="row"><label>${T('s_lang')}</label>${opts('lang', ['fr', 'en'], ['Français', 'English'])}</div>
      <h4>${T('s_graphics')}</h4>
      <div class="row"><label>${T('s_3d')}<small>${FN.G3.ok ? T('s_3dSub') : T('s_3dNone')}</small></label>${FN.G3.ok ? onoff('render3d') : ''}</div>
      <div class="row"><label>${T('s_quality')}</label>${opts('quality', ['low', 'medium', 'high'], [T('low'), T('medium'), T('high')])}</div>
      <div class="row"><label>${T('s_shadows')}</label>${onoff('shadows')}</div>
      <div class="row"><label>${T('s_perf')}<small>${T('s_perfSub')}</small></label>${onoff('perf')}</div>
      <div class="row"><label>${T('s_immersion')}<small>${T('s_immersionSub')}</small></label>${onoff('immersion')}</div>
      <h4 id="audioHead">${T('s_audio')}</h4>
      <div class="row"><label>${T('s_master')}</label>${range('master')}</div>
      <div class="row"><label>${T('s_music')}</label>${range('music')}</div>
      <div class="row"><label>${T('s_sfx')}</label>${range('sfx')}</div>
      <div class="row"><label>${T('s_amb')}</label>${range('amb')}</div>
      <div class="row"><label>${T('s_voice')}</label>${range('voice')}</div>
      <div class="row"><label>${T('s_subtitles')}</label>${onoff('subtitles')}</div>
      <h4>${T('s_controls')}</h4>
      <div class="row"><label>${T('s_sens')}<small>${T('s_sensSub')}</small></label>${range('sens', 0.4, 2.5, 0.1)}</div>
      <div class="row"><label>${T('s_vibrate')}</label>${onoff('vibrate')}</div>
      <h4>${T('s_game')}</h4>
      <div class="row"><label>${T('s_duration')}</label>${opts('duration', [3, 4, 6, 8, 9], [3, 4, 6, 8, 9].map((n) => T('min', { n })))}</div>
      <h4>${T('s_saves')}</h4>
      <div class="row"><label>${T('s_saves')}<small>${T('s_saveInfo')}</small></label><div class="opts"><button class="act" id="exp">${T('s_export')}</button><button class="act" id="imp">${T('s_import')}</button><button class="act danger" id="rst">${T('s_reset')}</button></div></div>
      <div class="row"><label>${T('s_account')}<small>${T('s_accountSub')}</small></label></div>
      <div class="row"><label>${T('s_install')}<small>${T('s_installSub')}</small></label>${deferredInstall ? `<button class="act" id="inst">${T('s_installBtn')}</button>` : ''}</div>
      <input type="file" id="impFile" accept="application/json,.json" class="hidden" />`;
    const body = $('#settingsBody');
    body.querySelectorAll('.opts[data-key]').forEach((o) => o.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      const key = o.dataset.key; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (!isNaN(+v)) v = +v;
      s[key] = v; FN.Save.save(); AU.play('uiMove');
      if (key === 'lang') { FN.lang = v; FN.applyI18n(); }
      if (key === 'immersion' && v) enterFullscreen();
      if (key === 'render3d' || key === 'quality' || key === 'perf') { FN.G3.reset(); FN.G3.setup(); }
      buildSettings();
    })));
    body.querySelectorAll('input[type=range]').forEach((r) => (r.oninput = () => { s[r.dataset.key] = +r.value; FN.Save.save(); AU.setVolumes(s); }));
    $('#nameInput').oninput = (e) => { d.name = e.target.value.trim() || 'Gardien'; FN.Save.save(); };
    $('#exp').onclick = () => {
      const blob = new Blob([FN.Save.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'faznight-sauvegarde.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('#imp').onclick = () => $('#impFile').click();
    $('#impFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { FN.Save.importJSON(await f.text()); FN.lang = D().settings.lang || FN.lang; FN.applyI18n(); toast('info', T('s_imported'), '', '✓'); buildSettings(); } catch (err) { toast('info', T('s_badFile'), '', '✕'); }
    };
    $('#rst').onclick = () => confirmBox(T('s_resetConfirm'), () => { const lang = FN.lang; FN.Save.reset(); D().settings.lang = lang; FN.Save.flush(); buildSettings(); });
    const inst = $('#inst'); if (inst) inst.onclick = async () => { deferredInstall.prompt(); deferredInstall = null; buildSettings(); };
    $('#audioHead').onclick = () => { if (++tapeTaps >= 7) { tapeTaps = 0; AU.init(); AU.play('hiddenTape'); FN.Trophies.secret('tape'); } };
  }
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

  // ---------------------------------------------------------------- CREDITS
  function buildCredits() {
    const en = FN.lang === 'en';
    $('#creditsBody').innerHTML = en
      ? `<h3>FAZNIGHT</h3><p>The animatronic horror collection. Chapter 1: Grimwood’s Pizza Palace. Chapter 2: Grimwood’s Fun Factory.</p>
         <h3>Original creation</h3><p>Every character, room, poster and animation is drawn procedurally in code (2.5D canvas rendering). Every sound and piece of music is synthesised live with the Web Audio API. No external image or audio file is used.</p>
         <h3>Inspiration</h3><p>The gameplay pays tribute to classic night-watch survival games (doors, cameras, power, mask, flashlight). FAZNIGHT is an independent fan-style project with its own characters and world; it is not affiliated with any existing franchise.</p>
         <h3>Technology</h3><p>HTML, CSS, JavaScript, Canvas 2D, Web Audio API, localStorage + IndexedDB, installable PWA.</p>
         <h3>Thanks</h3><p>To every night guard who never came back.</p>`
      : `<h3>FAZNIGHT</h3><p>La collection d’horreur animatronique. Chapitre 1 : Grimwood’s Pizza Palace. Chapitre 2 : Grimwood’s Fun Factory.</p>
         <h3>Création originale</h3><p>Chaque personnage, décor, affiche et animation est dessiné de façon procédurale dans le code (rendu Canvas 2.5D). Chaque son et chaque musique est synthétisé en direct avec la Web Audio API. Aucun fichier image ou audio externe n’est utilisé.</p>
         <h3>Inspiration</h3><p>Le gameplay rend hommage aux jeux de survie et de surveillance nocturne (portes, caméras, énergie, masque, lampe torche). FAZNIGHT est un projet indépendant, avec ses propres personnages et son propre univers ; il n’est affilié à aucune licence existante.</p>
         <h3>Technologies</h3><p>HTML, CSS, JavaScript, Canvas 2D, Web Audio API, localStorage + IndexedDB, application installable (PWA).</p>
         <h3>Remerciements</h3><p>À tous les gardiens de nuit qui ne sont jamais revenus.</p>`;
  }

  // ---------------------------------------------------------------- EXTRAS (secret menu)
  function buildExtras() {
    const d = D();
    const sc = Object.keys(d.secrets).length;
    const docs = FN.DOCS.map((doc) => `<button class="doc ${d.docs[doc.id] ? '' : 'locked'}" data-doc="${doc.id}"><b>${d.docs[doc.id] ? esc(FN.L(doc.title)) : '???'}</b><span>${d.docs[doc.id] ? '✉' : T('x_lockedDoc')}</span></button>`).join('');
    const seen = [...FN.charsOf(1), ...FN.charsOf(2), 'hollow'].filter((id) => d.seen[id]);
    $('#extrasBody').innerHTML = `<p class="small" style="color:var(--dim)">${T('x_secrets', { n: sc, t: FN.SECRETS.length })}</p>
      <div class="extras-grid">${FN.SECRETS.map((s) => `<div class="doc ${d.secrets[s.id] ? '' : 'locked'}"><b>${d.secrets[s.id] ? esc(FN.L(s.name)) : '???'}</b><span>${d.secrets[s.id] ? '✓' : ''}</span></div>`).join('')}</div>
      <h3 class="sub">${T('x_archives')}</h3><div class="extras-grid">${docs}</div>
      <h3 class="sub">${T('x_minigame')}</h3><div class="extras-grid"><button class="doc ${d.secrets.codefrog ? '' : 'locked'}" id="mini"><b>${T('x_playMini')}</b><span>${d.secrets.codefrog ? '▶' : '???'}</span></button></div>
      <h3 class="sub">${T('x_terminal')}</h3><div class="extras-grid"><button class="doc" id="term"><b>${T('x_terminal')}</b><span>&gt;_</span></button></div>
      <h3 class="sub">${T('x_theater')}</h3><p class="small" style="color:var(--dim)">${T('theaterHint')}</p>
      <div class="extras-grid">${seen.map((id) => `<button class="doc" data-scare="${id}"><b>${esc(FN.L(FN.CHARS[id].name))}</b><span>☠</span></button>`).join('')}</div>`;
    const body = $('#extrasBody');
    body.querySelectorAll('[data-doc]').forEach((b) => (b.onclick = () => { const doc = FN.DOCS.find((x) => x.id === b.dataset.doc); letter(FN.L(doc.title), FN.L(doc.text)); }));
    $('#mini').onclick = () => { if (!d.secrets.codefrog) return; FN.Minigame.open(() => { hideOverlay(); buildExtras(); }); };
    $('#term').onclick = terminal;
    body.querySelectorAll('[data-scare]').forEach((b) => (b.onclick = () => {
      const o = overlay('<canvas class="full" style="z-index:0"></canvas>');
      const cv = o.querySelector('canvas'); cv.width = innerWidth; cv.height = innerHeight;
      AU.init();
      FN.Scare.run(cv, b.dataset.scare, hideOverlay);
    }));
  }
  function terminal() {
    const o = overlay(`<div class="terminal"><p>GRIMWOOD ENTERTAINMENT — TERMINAL v1.987</p><p>${T('terminalPrompt')}</p><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" /><p id="tmsg">&nbsp;</p></div><div class="btns"><button class="mbtn" data-a="ok">OK</button><button class="mbtn" data-a="x">${T('close')}</button></div>`, false);
    const input = o.querySelector('#code'), msg = o.querySelector('#tmsg');
    setTimeout(() => input.focus(), 50);
    const submit = () => {
      const v = input.value.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const d = D();
      const codes = { '2704': 'code2704', GRENOUILLE: 'codefrog', FROG: 'codefrog', HOLLOW: 'codehollow' };
      const sec = codes[v];
      AU.init();
      if (!sec) { msg.textContent = T('terminalBad'); AU.play('denied'); return; }
      if (d.secrets[sec]) { msg.textContent = T('terminalUsed'); return; }
      msg.textContent = T('terminalOk'); AU.play('unlock');
      FN.Trophies.secret(sec);
      if (sec === 'code2704') setTimeout(() => FN.Trophies.doc('d2'), 400);
    };
    o.querySelector('[data-a=ok]').onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    o.querySelector('[data-a=x]').onclick = () => { hideOverlay(); if (current === 'extras') buildExtras(); refreshHome(); };
  }

  // ---------------------------------------------------------------- night overlays
  function nightIntro(cfg, go) {
    const label = cfg.night === 'custom' ? T('customIntro') : T('nightIntro', { n: cfg.night });
    const o = overlay(`<div class="clockflip">12:00<span class="am">AM</span></div><div class="mid">${esc(label)}</div><div class="small">${cfg.resume ? T('resume') : T('chapter', { n: cfg.chapter }) + ' — ' + (cfg.chapter === 1 ? 'Grimwood’s Pizza Palace' : 'Grimwood’s Fun Factory')}</div>`);
    AU.play('sting');
    let done = false;
    const finish = () => { if (done) return; done = true; hideOverlay(); go(); };
    o.onclick = finish;
    setTimeout(finish, 2800);
  }
  function pauseMenu(n) {
    const o = overlay(`<div class="big">${T('paused')}</div><div class="mid">${esc(n.hourLabel())} — ${n.night === 'custom' ? T('customIntro') : T('night', { n: n.night })}</div>
      <div class="btns"><button class="mbtn" data-a="r">${T('resumeGame')}</button><button class="mbtn" data-a="re">${T('restart')}</button><button class="mbtn" data-a="q">${T('quitSave')}</button></div>`, true);
    o.querySelector('[data-a=r]').onclick = () => { hideOverlay(); n.resume(); };
    o.querySelector('[data-a=re]').onclick = () => { hideOverlay(); const cfg = Object.assign({}, n.cfg, { resume: null }); n.over = true; n.destroy(); FN.Game.start(cfg); };
    o.querySelector('[data-a=q]').onclick = () => { hideOverlay(); n.quitAndSave(); show('home'); refreshHome(); };
  }
  function gameOver(cfg, id, opts) {
    const c = FN.CHARS[id];
    const showGO = () => {
      const o = overlay(`<canvas class="full"></canvas><div class="go-text">${T('gameOver')}</div><div class="mid">${esc(T('killedBy', { name: FN.L(c.name) }))}</div>
        ${D().settings.immersion ? '' : `<div class="small"><b>${T('tips')} :</b> ${esc(FN.L(c.hint))}</div>`}
        <div class="btns"><button class="mbtn" data-a="r">${T('retry')}</button><button class="mbtn" data-a="m">${T('menu')}</button></div>`);
      const cv = o.querySelector('canvas'); fitCanvas(cv, 0.6);
      const a = animate(cv, (ctx, W, H, t) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); A.drawChar(ctx, id, W / 2, H * 1.3, H * 1.1, { t, light: 0.15, eyes: 0.7 }); A.staticFx(ctx, W, H, 0.35, t); });
      if (!menuRAF) menuRAF = requestAnimationFrame(menuLoop);
      AU.loop('staticNoise', { vol: 0.04 });
      const leave = () => { anims.delete(a); AU.stopAllLoops(0.2); hideOverlay(); };
      o.querySelector('[data-a=r]').onclick = () => { leave(); FN.Game.start(Object.assign({}, cfg, { resume: null })); };
      o.querySelector('[data-a=m]').onclick = () => { leave(); show('home'); refreshHome(); };
    };
    if (opts && opts.crash) {
      overlay(`<div class="terminal" style="color:#ccc"><p>FAZNIGHT.EXE</p><p>Erreur fatale 0x000HOLLOW</p><p>${FN.lang === 'en' ? 'IT SAW YOU LOOKING.' : 'IL VOUS A VU LE REGARDER.'}</p></div>`);
      AU.play('hiddenTape');
      setTimeout(showGO, 3200);
    } else showGO();
  }
  function sixAM(n, rewards, cb) {
    const o = overlay(`<div class="clockflip"><span id="hh">5</span><span class="am">AM</span></div><div class="mid" id="winmsg">&nbsp;</div><div id="rewards"></div>`);
    setTimeout(() => {
      const hh = o.querySelector('#hh'); if (!hh) return;
      hh.textContent = '6';
      hh.style.animation = 'fadeIn 0.6s';
      AU.play('chimes6');
      o.querySelector('#winmsg').textContent = n.night === 'custom' ? T('winCustom') : T('winNight', { n: n.night });
      o.querySelector('#rewards').innerHTML = rewards.map((r) => `<div class="reward">★ ${esc(r)}</div>`).join('<br>');
    }, 1800);
    setTimeout(() => { AU.music('victory'); cb(); }, 6200);
  }
  function afterWin(cfg, cinematic) {
    const d = D();
    const results = () => {
      const isStory = cfg.night !== 'custom';
      const canNext = isStory && cfg.night < 7 && d.chapters[cfg.chapter].next > cfg.night;
      const o = overlay(`<div class="clockflip" style="font-size:clamp(40px,12vmin,90px)">6<span class="am">AM</span></div><div class="mid">${cfg.night === 'custom' ? T('winCustom') : T('winNight', { n: cfg.night })}</div>
        <div class="btns">${canNext ? `<button class="mbtn" data-a="n">${T('nextNight')}</button>` : ''}<button class="mbtn" data-a="m">${T('menu')}</button></div>`);
      const nb = o.querySelector('[data-a=n]');
      if (nb) nb.onclick = () => { hideOverlay(); FN.Game.start({ chapter: cfg.chapter, night: cfg.night + 1 }); };
      o.querySelector('[data-a=m]').onclick = () => { hideOverlay(); AU.stopMusic(); show('home'); refreshHome(); };
    };
    const en = FN.lang === 'en';
    const C = {
      paycheck: (next) => letter(en ? 'Paycheck' : 'Fiche de paie', en ? 'Grimwood’s Pizza Palace — 5 nights of security work: $120.50. Thank you for your loyalty. We are pleased to offer you overtime (Night 6).' : 'Grimwood’s Pizza Palace — 5 nuits de surveillance : 120,50 €. Merci pour votre fidélité. Nous avons le plaisir de vous proposer des heures supplémentaires (Nuit 6).', next),
      ch2: (next) => {
        const o = overlay(`<canvas class="full"></canvas><div class="big" style="color:#ff6fb0;text-shadow:0 0 20px #ff2a8a">${T('chapterUnlockTitle')}</div><div class="mid">Grimwood’s Fun Factory</div><div class="btns"><button class="mbtn">OK</button></div>`);
        AU.play('unlock');
        const cv = o.querySelector('canvas'); fitCanvas(cv, 0.7);
        const t0 = performance.now();
        const draw = drawPoster(2, false);
        const a = animate(cv, (c, W, H, t) => { draw(c, W, H, t); const k = (performance.now() - t0) / 1000; if (k < 1.5) { A.staticFx(c, W, H, 1 - k / 1.5, t); } c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, H); });
        if (!menuRAF) menuRAF = requestAnimationFrame(menuLoop);
        d.flags.ch2Seen = true; FN.Save.flush();
        o.querySelector('.mbtn').onclick = () => { anims.delete(a); hideOverlay(); next(); };
      },
      letter: (next) => { const doc = FN.DOCS.find((x) => x.id === 'd4'); letter(FN.L(doc.title), FN.L(doc.text), next); },
      ending2: (next) => letter(en ? 'Ending — The Factory Closes' : 'Fin — La fermeture de l’usine', en ? 'The Fun Factory closes its doors for good. The animatronics are boxed up, one by one. Somewhere in the dark, a music box keeps playing. (Find every document for another ending.)' : 'La Fun Factory ferme définitivement ses portes. Les animatroniques sont mis en caisse, un par un. Quelque part dans le noir, une boîte à musique continue de jouer. (Retrouvez tous les documents pour une autre fin.)', next),
      trueEnding: (next) => letter(en ? 'True ending — The one they waited for' : 'Vraie fin — Celui qu’ils attendaient', en ? 'With Gérard’s note in hand, you understand: they were never hunting you. They were waiting for Harold Grimwood. At 6 AM, the old mascots turn towards the empty office chair… and power down, at peace.' : 'Avec la note de Gérard, vous comprenez : ils ne vous chassaient pas. Ils attendaient Harold Grimwood. À 6 h, les vieilles mascottes se tournent vers le fauteuil vide du bureau… et s’éteignent, apaisées.', next),
      ending6: (next) => letter(en ? 'Final closing' : 'Fermeture définitive', en ? 'Notice: the guard is dismissed for tampering with the animatronics and for odour. Night 7 remains available… for those who insist.' : 'Avis : le gardien est licencié pour avoir trafiqué les animatroniques et pour mauvaise odeur. La Nuit 7 reste disponible… pour ceux qui insistent.', next),
      n7: (next) => letter(en ? 'Seventh night' : 'Septième nuit', en ? 'Nobody was supposed to come back. You did. The Custom Night is waiting for you.' : 'Personne n’était censé revenir. Vous l’avez fait. La Custom Night vous attend.', next),
    };
    let chain = [];
    if (cinematic === 'ch2') chain = ['paycheck', 'ch2'];
    else if (cinematic) chain = [cinematic];
    const run = () => { const c = chain.shift(); if (c && C[c]) C[c](run); else results(); };
    run();
  }

  // ---------------------------------------------------------------- orientation & fullscreen
  const isTouch = () => matchMedia('(pointer: coarse)').matches;
  function enterFullscreen() {
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
      if (p && p.then) p.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
    } catch (e) {}
  }
  function autoLandscape() { if (isTouch() || D().settings.immersion) enterFullscreen(); }
  function maybeRotateHint() {
    const el = $('#rotateHint');
    const check = () => {
      const portrait = innerHeight > innerWidth * 1.05;
      if (!portrait || current !== 'game' || el.dataset.dismissed) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      if (FN.Game.current && !FN.Game.current.paused) FN.Game.current.paused = 'rotate';
    };
    el.innerHTML = `<div class="phone"></div><div>${T('rotate')}</div><button class="mbtn primary">${T('playAnyway')}</button>`;
    el.querySelector('button').onclick = () => { el.dataset.dismissed = '1'; el.classList.add('hidden'); const g = FN.Game.current; if (g && g.paused === 'rotate') g.resume(); };
    delete el.dataset.dismissed;
    if (!isTouch()) return;
    check();
    window.onorientationchange = window.onresize = () => {
      check();
      const g = FN.Game.current;
      if (g && g.paused === 'rotate' && el.classList.contains('hidden')) g.resume();
    };
  }

  const BUILD = { home: refreshHome, nights: buildNights, collection: buildCollection, trophies: buildTrophies, custom: buildCustom, settings: buildSettings, credits: buildCredits, extras: buildExtras };

  FN.UI = {
    show, back, refreshHome, toast, toastTrophy, nightIntro, pauseMenu, gameOver, sixAM, afterWin, presetName, terminal,
    enterFullscreen, autoLandscape, maybeRotateHint, hideOverlay, PRESETS,
    get current() { return current; },
    openNights(ch) { nightsChapter = ch; show('nights'); },
  };
})(window.FN);
