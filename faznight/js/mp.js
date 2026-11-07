/* FAZNIGHT — team nights (multiplayer).
   Create a game (2 to 4 guards, pick the night) or join one with its 4-letter code.
   Every guard has their own office and fights their own animatronics, but the night is shared:
   one clock (the host's), a camera on each teammate's office, energy you can send them,
   an alert button, and Endo-7 wakes up only when you play as a team. */
(function (FN) {
  const A = FN.Art, R = FN.Rooms, AU = FN.Audio;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const L = (fr, en) => (FN.lang === 'en' ? en : fr);
  const ICON = '<svg viewBox="0 0 24 24" class="mp-ico"><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2M13.5 14.6c.9-.6 1.9-.9 3-.9 2.3 0 4.2 1.6 4.8 4.6"/></svg>';
  const GAME = { 1: 'Pizza Palace', 2: 'Fun Factory' };

  const MP = { session: null, ICON };
  const ui = { ch: 1, max: 2, night: 1 };
  const body = () => $('#mpBody');
  const nick = () => (FN.Save.data.name || 'Gardien').slice(0, 14);

  // ---------------------------------------------------------------- menu
  MP.openMenu = function (ch) {
    ui.ch = ch;
    if (MP.session && !MP.session.inGame) { renderLobby(MP.session); FN.UI.show('mp'); return; }
    FN.UI.show('mp');
    renderMenu();
  };
  function setTitle(t) { $('#mpTitle').textContent = t; }
  const COLORS = ['#ff3b30', '#3b9bff', '#3bd16b', '#ffb300'];
  const avatar = (i, filled) => `<svg viewBox="0 0 40 40" class="mp-av" style="--c:${COLORS[i % 4]}"><circle cx="20" cy="20" r="19" class="ring"/>${filled ? '<circle cx="20" cy="15" r="6.5" class="fill"/><path d="M8 33c1.6-6.2 6.2-9.2 12-9.2s10.4 3 12 9.2" class="fill"/>' : '<text x="20" y="26" text-anchor="middle" class="q">?</text>'}</svg>`;
  /** Step indicator: 1 nickname, 2 game, 3 lobby. */
  const steps = (k) => `<ol class="mp-steps">${[L('Pseudo', 'Nickname'), L('Partie', 'Game'), L('Salon', 'Lobby')].map((t, i) => `<li class="${i < k ? 'done' : ''} ${i === k ? 'now' : ''}"><span>${i + 1}</span>${t}</li>`).join('')}</ol>`;
  /** Every view change slides in instead of popping. */
  function view(html) { const b = body(); b.innerHTML = html; b.classList.remove('mp-in'); void b.offsetWidth; b.classList.add('mp-in'); }
  function renderMenu() {
    setTitle(L('Multijoueur', 'Multiplayer') + ' · ' + GAME[ui.ch]);
    view(`${steps(0)}
      <div class="mp-hero">${ICON}<div><b>${L('Nuit en équipe', 'Team night')}</b>
        <p>${L('Chaque gardien a son bureau, mais la nuit est la même pour tous. Regardez le bureau de vos coéquipiers sur les caméras, envoyez-leur de l’énergie, prévenez-les du danger. En équipe, Endo-7 se réveille et les animatroniques sont plus agressifs.', 'Each guard has their own office, but the night is the same for everyone. Watch your teammates’ offices on the cameras, send them power, warn them of danger. As a team, Endo-7 wakes up and the animatronics get more aggressive.')}</p></div></div>
      <label class="mp-field" for="mpNick">${L('Votre pseudo', 'Your nickname')}<input id="mpNick" maxlength="14" autocomplete="off" value="${esc(nick())}" /></label>
      <div class="mp-actions">
        <button class="mp-choice" id="mpCreate"><span class="mp-ci">＋</span><b>${L('Créer une partie', 'Create a game')}</b><small>${L('Vous êtes l’hôte : vous choisissez la nuit et le nombre de joueurs.', 'You host: you pick the night and how many players.')}</small></button>
        <button class="mp-choice" id="mpJoin"><span class="mp-ci">⇥</span><b>${L('Rejoindre une partie', 'Join a game')}</b><small>${L('Tapez le code de 4 lettres donné par l’hôte.', 'Type the 4-letter code the host gives you.')}</small></button>
      </div>`);
    $('#mpNick').oninput = (e) => { FN.Save.data.name = e.target.value.trim().slice(0, 14) || 'Gardien'; FN.Save.save(); };
    $('#mpCreate').onclick = () => { AU.play('uiSelect'); renderCreate(); };
    $('#mpJoin').onclick = () => { AU.play('uiSelect'); renderJoin(); };
  }
  function opts(key, values, label, face) {
    return `<div class="mp-opt"><span class="mp-lab">${label}</span><div class="mp-tiles" data-k="${key}">${values.map((v) => `<button data-v="${v}" class="mp-tile ${ui[key] === v ? 'on' : ''}">${face(v)}</button>`).join('')}</div></div>`;
  }
  const playersFace = (v) => `<span class="avs">${Array.from({ length: v }, (_, i) => avatar(i, true)).join('')}</span><b>${v}</b><small>${L('joueurs', 'players')}</small>`;
  const nightFace = (v) => `<b>${v}</b><small>${L('Nuit', 'Night')}</small><span class="pips">${Array.from({ length: 6 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span>`;
  function renderCreate() {
    setTitle(L('Créer une partie', 'Create a game'));
    view(`${steps(1)}<div class="mp-card">
      ${opts('max', [2, 3, 4], L('Nombre de joueurs', 'Number of players'), playersFace)}
      ${opts('night', [1, 2, 3, 4, 5, 6], L('Nuit', 'Night'), nightFace)}
      <p class="mp-note">${GAME[ui.ch]} · ${L('Endo-7 rejoint la nuit, et chaque joueur en plus rend les animatroniques plus agressifs.', 'Endo-7 joins the night, and each extra player makes the animatronics more aggressive.')}</p>
      <div class="mp-actions"><button class="mp-big primary" id="mpGo">${L('Créer la partie', 'Create the game')}</button><button class="mp-big" id="mpBackMenu">${L('Retour', 'Back')}</button></div></div>`);
    // selecting a tile only moves the highlight (no full redraw, no flash)
    body().querySelectorAll('.mp-tiles[data-k]').forEach((o) => o.querySelectorAll('button').forEach((b) => (b.onclick = () => { ui[o.dataset.k] = +b.dataset.v; AU.play('uiMove'); o.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); })));
    $('#mpGo').onclick = () => { AU.play('uiSelect'); const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let code = ''; for (let i = 0; i < 4; i++) code += abc[Math.floor(Math.random() * abc.length)]; openLobby(code, true); };
    $('#mpBackMenu').onclick = renderMenu;
  }
  function renderJoin() {
    setTitle(L('Rejoindre une partie', 'Join a game'));
    view(`${steps(1)}<div class="mp-card">
      <label class="mp-field" for="mpCode">${L('Code de la partie', 'Game code')}
        <span class="mp-boxes" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <input id="mpCode" class="mp-code-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" /></label>
      <p class="mp-note" id="mpJoinMsg">${L('Demandez le code à l’hôte de la partie.', 'Ask the host for the game code.')}</p>
      <div class="mp-actions"><button class="mp-big primary" id="mpGo">${L('Rejoindre', 'Join')}</button><button class="mp-big" id="mpBackMenu">${L('Retour', 'Back')}</button></div></div>`);
    const inp = $('#mpCode');
    const boxes = [...body().querySelectorAll('.mp-boxes i')];
    const sync = () => { const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); inp.value = v; boxes.forEach((b, i) => { b.textContent = v[i] || ''; b.classList.toggle('cur', i === v.length); }); };
    inp.addEventListener('input', () => { sync(); AU.play('uiMove'); }); sync();
    body().querySelector('.mp-boxes').onclick = () => inp.focus();
    setTimeout(() => inp.focus(), 50);
    const go = () => { const c = inp.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 4) { AU.play('denied'); $('#mpJoinMsg').textContent = L('Le code fait 4 lettres.', 'The code is 4 letters.'); return; } AU.play('uiSelect'); openLobby(c, false); };
    $('#mpGo').onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#mpBackMenu').onclick = renderMenu;
  }

  // ---------------------------------------------------------------- lobby
  async function openLobby(code, host) {
    body().innerHTML = `<p class="mp-wait">${L('Connexion…', 'Connecting…')}</p>`;
    await MP.leave();
    const net = await FN.Net.open(code);
    const s = (MP.session = { net, code, host, ch: ui.ch, max: ui.max, night: ui.night, lastStart: 0, joinT: Date.now(), giftQ: 0, seen: {}, inGame: false, giveT: 0 });
    const base = { v: 1, nick: nick(), role: host ? 'host' : 'guest', j: Date.now(), ph: 'lobby' };
    if (host) Object.assign(base, { max: ui.max, ch: ui.ch, n: ui.night });
    net.presence(base);
    s.unsub = net.onPeers(() => onPeers(s));
    s.timer = setInterval(() => { if (!s.inGame) renderLobby(s); }, 1000);
    renderLobby(s);
  }
  const hostOf = (s) => s.net.peers().find((p) => p.presence.role === 'host' && p.presence.v === 1);
  function lobbyList(s) {
    return s.net.peers().filter((p) => p.presence.v === 1 && p.presence.ph !== 'left')
      .sort((a, b) => (a.presence.role === 'host' ? -1 : 0) - (b.presence.role === 'host' ? -1 : 0) || (a.presence.j || 0) - (b.presence.j || 0));
  }
  function onPeers(s) {
    if (MP.session !== s) return;
    const h = hostOf(s);
    const st = h && h.presence.st;
    if (st && st.at > s.lastStart && !s.inGame) {
      s.lastStart = st.at;
      const me = s.net.me();
      if (st.roster.includes(me)) return countdown(s, st);
      body().innerHTML = `<p class="mp-wait">${L('La partie a commencé sans vous (elle est complète).', 'The game started without you (it is full).')}</p>`;
      return;
    }
    if (!s.inGame) renderLobby(s);
    else if (s.inGame === 'over') renderTeam(s);
  }
  /** Replace the lobby only when its content changes (presence ticks must not rebuild buttons under the finger). */
  function paint(s, html, bind) {
    if (s.painted === html) return false;
    s.painted = html; body().innerHTML = html; bind && bind(); return true;
  }
  function renderLobby(s) {
    if (MP.session !== s || s.inGame) return;
    const h = hostOf(s);
    setTitle(L('Salon', 'Lobby') + ' · ' + s.code);
    if (!s.host && !h) {
      body().innerHTML = Date.now() - s.joinT > 7000
        ? `<div class="mp-card"><p class="mp-wait">${L('Aucune partie trouvée avec le code', 'No game found with the code')} <b>${esc(s.code)}</b>.</p><div class="mp-actions"><button class="mp-big" id="mpRetry">${L('Réessayer', 'Try again')}</button></div></div>`
        : `<p class="mp-wait">${L('Recherche de la partie', 'Looking for the game')} ${esc(s.code)}…</p>`;
      const r = $('#mpRetry'); if (r) r.onclick = () => { MP.leave(); renderJoin(); };
      return;
    }
    const max = (h && h.presence.max) || s.max, ch = (h && h.presence.ch) || s.ch, night = (h && h.presence.n) || s.night;
    s.ch = ch;
    const list = lobbyList(s);
    const meIdx = list.findIndex((p) => p.isMe);
    if (!s.host && meIdx >= max) {
      body().innerHTML = `<div class="mp-card"><p class="mp-wait">${L('La partie est complète', 'The game is full')} (${max}/${max}).</p><div class="mp-actions"><button class="mp-big" id="mpRetry">${L('Retour', 'Back')}</button></div></div>`;
      $('#mpRetry').onclick = () => { MP.leave(); renderMenu(); };
      return;
    }
    const rows = [];
    for (let i = 0; i < max; i++) {
      const p = list[i];
      rows.push(p
        ? `<li class="mp-slot full" style="--c:${COLORS[i % 4]}">${avatar(i, true)}<div><span class="mp-n">J${i + 1}</span><b>${esc(p.presence.nick || '?')}</b><span class="tags">${p.presence.role === 'host' ? `<em>${L('hôte', 'host')}</em>` : ''}${p.isMe ? `<em class="me">${L('vous', 'you')}</em>` : ''}<em class="ok">${L('prêt', 'ready')}</em></span></div></li>`
        : `<li class="mp-slot" style="--c:${COLORS[i % 4]}">${avatar(i, false)}<div><span class="mp-n">J${i + 1}</span><i>${L('En attente', 'Waiting')}<span class="dots"><b>.</b><b>.</b><b>.</b></span></i></div></li>`);
    }
    const n = Math.min(list.length, max);
    const local = s.net.kind === 'local';
    const html = `<div class="mp-lobby">
      ${steps(2)}
      <div class="mp-codebox"><small>${L('Code de la partie — donnez-le à vos amis', 'Game code — give it to your friends')}</small><div class="mp-code">${[...s.code].map((c) => `<span>${esc(c)}</span>`).join('')}</div><button class="act" id="mpCopy">${L('Copier', 'Copy')}</button>
        <p class="mp-note">${local ? L('Mode local : jouez dans plusieurs onglets de ce navigateur. En ligne, ouvrez le jeu depuis le lien partagé.', 'Local mode: play in several tabs of this browser. Online, open the game from the shared link.') : L('Les autres joueurs ouvrent le même lien FAZNIGHT, puis Multijoueur › Rejoindre.', 'Other players open the same FAZNIGHT link, then Multiplayer › Join.')}</p></div>
      <div class="mp-info"><b>${GAME[ch]}</b> · ${L('Nuit', 'Night')} ${night} · ${n}/${max} ${L('joueurs', 'players')}</div>
      <ul class="mp-slots">${rows.join('')}</ul>
      <div class="mp-actions">${s.host ? `<button class="mp-big primary" id="mpStart" ${n < 2 ? 'disabled' : ''}>${n < 2 ? L('Il faut au moins 2 joueurs', 'At least 2 players needed') : L('Lancer la nuit', 'Start the night')}</button>` : `<p class="mp-wait">${L('En attente de l’hôte…', 'Waiting for the host…')}</p>`}
        <button class="mp-big" id="mpQuit">${L('Quitter le salon', 'Leave the lobby')}</button></div></div>`;
    if (!paint(s, html)) return;
    $('#mpCopy').onclick = () => { const c = s.code; try { navigator.clipboard.writeText(c).then(() => FN.UI.toast('info', L('Code copié', 'Code copied'), c, '✓'), () => {}); } catch (e) {} };
    $('#mpQuit').onclick = () => { MP.leave(); renderMenu(); };
    const st = $('#mpStart');
    if (st) st.onclick = () => {
      const roster = lobbyList(s).slice(0, max).map((p) => p.peer);
      if (roster.length < 2) return;
      AU.play('uiSelect');
      s.net.presence({ st: { at: Date.now(), ch, n: night, roster, dur: 9 } });
      setTimeout(() => onPeers(s), 30);
    };
  }

  // ---------------------------------------------------------------- start
  /** 3, 2, 1 — everyone sees the team line-up, then the night starts. */
  function countdown(s, st) {
    s.inGame = true; s.painted = null;
    const o = $('#overlay');
    o.className = 'mp-count';
    const team = st.roster.map((peer, i) => { const p = peerOf(s, peer); return `<div class="mp-cm" style="--c:${COLORS[i % 4]};animation-delay:${i * 0.12}s">${avatar(i, true)}<b>${esc(p ? p.presence.nick || '?' : '?')}</b><span>J${i + 1}</span></div>`; }).join('');
    o.innerHTML = `<div class="mp-cgame">${GAME[st.ch]} · ${L('Nuit', 'Night')} ${st.n}</div><div class="mp-cteam">${team}</div><div class="mp-cnum" id="mpCnum">3</div><div class="mp-csub">${L('Restez dans votre bureau. Surveillez vos coéquipiers.', 'Stay in your office. Watch your teammates.')}</div>`;
    let k = 3;
    AU.play('clank', { vol: 0.4 });
    const iv = setInterval(() => {
      k--;
      const el = $('#mpCnum');
      if (k > 0 && el) { el.textContent = k; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); AU.play('clank', { vol: 0.4 }); return; }
      clearInterval(iv);
      o.className = 'hidden'; o.innerHTML = '';
      startGame(s, st);
    }, 1000);
  }
  function startGame(s, st) {
    s.inGame = true; s.painted = null; s.roster = st.roster; s.ch = st.ch; s.night = st.n; s.over = false;
    s.net.presence({ ph: 'play', g: null, k: null });
    const extra = st.roster.length - 1;
    const lv = st.ch === 1 ? FN.ch1Levels(st.n) : FN.ch2Levels(st.n);
    for (const k in lv) if (lv[k] > 0) lv[k] = Math.min(20, lv[k] + extra);
    lv.endo = Math.min(20, 3 + st.n * 2 + extra);
    FN.Game.start({ chapter: st.ch, night: st.n, levels: lv, rules: { duration: st.dur }, mp: true });
  }
  MP.attach = function (n) { const s = MP.session; if (!s) return; n.mp = s; s.night = n; s.tickT = 0; };
  MP.rosterIndex = (peer) => (MP.session ? MP.session.roster.indexOf(peer) : -1);
  function peerOf(s, id) { return s.net.peers().find((p) => p.peer === id); }
  MP.camLabel = function (peer) {
    const s = MP.session, p = s && peerOf(s, peer);
    return `J${MP.rosterIndex(peer) + 1} — ${L('Bureau de', 'Office of')} ${p ? p.presence.nick || '?' : '?'}`;
  };

  // ---------------------------------------------------------------- in-night sync
  function stateOf(n) {
    const o = { ph: 'play', t: Math.round(n.time * 10) / 10, ts: Date.now(), hr: n.hour };
    if (n.ch === 1) Object.assign(o, { pw: Math.max(0, Math.round(n.power)), d: [+n.doors.L, +n.doors.R], l: [+n.lights.L, +n.lights.R], w: [n.atDoor('L'), n.atDoor('R')], io: n.inOffice || null, out: n.out ? 1 : 0 });
    else Object.assign(o, { pw: Math.max(0, Math.round(n.battery)), m: n.mask ? 1 : 0, ix: n.intr ? n.intr.id : null, fl: n.flash ? 1 : 0, bx: Math.round(n.box * 100), hall: ['oldkrok', 'pepper', 'oldbruno', 'endo'].filter((id) => n.level(id) > 0 && n.room(id) === 'HALL') });
    return o;
  }
  MP.tick = function (n, dt) {
    const s = MP.session;
    if (!s || n.over) return;
    const me = s.net.me();
    // one clock for the whole team: follow the host's
    if (!s.host) {
      const h = hostOf(s);
      if (h && h.presence.ph === 'play' && typeof h.presence.t === 'number') {
        const ht = h.presence.t + Math.max(0, (Date.now() - (h.presence.ts || Date.now())) / 1000) * n.speed;
        if (Math.abs(ht - n.time) > 1.2) n.time = Math.min(n.duration - 0.05, ht);
      }
    }
    // gifts and alerts from teammates
    for (const p of s.net.peers()) {
      const g = p.presence.g;
      if (p.isMe || !g || g.to !== me) continue;
      const key = p.peer + ':' + g.q;
      if (s.seen[key]) continue;
      s.seen[key] = 1;
      const who = p.presence.nick || '?';
      if (g.k === 'pw') {
        if (n.ch === 1 && !n.out) n.power = Math.min(100, n.power + 10); else if (n.ch === 2) n.battery = Math.min(100, n.battery + 10);
        AU.play('lightOn', {}); FN.UI.toast('info', who, L('vous envoie 10 % d’énergie.', 'sends you 10% power.'), '⚡');
      } else if (g.k === 'alert') {
        AU.play('knock', { pan: 0 }); n.flicker = 1; FN.UI.toast('info', who, L('vous prévient : danger !', 'warns you: danger!'), '⚠');
      }
    }
    s.tickT -= dt / Math.max(1, n.speed);
    if (s.tickT <= 0) { s.tickT = 0.5; s.net.presence(stateOf(n)); }
  };
  MP.give = function (n, peer, kind) {
    const s = MP.session; if (!s) return;
    const now = performance.now();
    if (now - s.giveT < 1200) return;
    if (kind === 'pw') {
      const cur = n.ch === 1 ? n.power : n.battery;
      if (cur < 15 || (n.ch === 1 && n.out)) { AU.play('denied'); FN.UI.toast('info', L('Pas assez d’énergie', 'Not enough power'), L('Il faut au moins 15 %.', 'You need at least 15%.'), '⚡'); return; }
      if (n.ch === 1) n.power -= 10; else n.battery -= 10;
    }
    s.giveT = now; s.giftQ++;
    s.net.presence({ g: { to: peer, q: s.giftQ, k: kind } });
    AU.play(kind === 'pw' ? 'uiSelect' : 'knock', {});
  };
  MP.report = function (n, ph, killer) { const s = MP.session; if (s) s.net.presence({ ph, k: killer || null, t: Math.round(n.time * 10) / 10, ts: Date.now() }); };

  // ---------------------------------------------------------------- HUD: teammate cameras + help
  MP.hud = function (n) {
    const s = MP.session; if (!s) return;
    const me = s.net.me();
    const strip = document.createElement('div'); strip.className = 'mpstrip hidden';
    const btns = {};
    s.roster.forEach((peer, i) => {
      if (peer === me) return;
      const b = document.createElement('button');
      b.innerHTML = `${ICON}J${i + 1}`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); n.switchCam('P:' + peer); });
      strip.appendChild(b); btns[peer] = b;
    });
    n.hud.appendChild(strip);
    const help = document.createElement('div'); help.className = 'mphelp hidden';
    help.innerHTML = `<button data-k="pw">⚡ ${L('Envoyer 10 %', 'Send 10%')}</button><button data-k="alert">⚠ ${L('Prévenir', 'Warn')}</button>`;
    help.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (n.cam.startsWith('P:')) MP.give(n, n.cam.slice(2), b.dataset.k); }));
    n.hud.appendChild(help);
    const team = document.createElement('div'); team.className = 'mpteam';
    n.hud.appendChild(team);
    const upd = () => {
      if (n.over || !strip.isConnected) return;
      strip.classList.toggle('hidden', !n.camUp);
      const onP = n.camUp && n.cam.startsWith('P:');
      help.classList.toggle('hidden', !onP);
      for (const peer in btns) { const p = peerOf(s, peer), ph = p ? p.presence.ph : 'left'; btns[peer].classList.toggle('on', n.cam === 'P:' + peer); btns[peer].classList.toggle('dead', ph === 'dead' || ph === 'left'); btns[peer].classList.toggle('alert', !!(p && ((p.presence.w && (p.presence.w[0] || p.presence.w[1])) || p.presence.ix))); }
      team.innerHTML = s.roster.map((peer, i) => { const p = peerOf(s, peer), pr = p ? p.presence : { ph: 'left' }; const st = pr.ph === 'dead' ? '✝' : pr.ph === 'won' ? '6AM' : pr.ph === 'left' ? '—' : (pr.pw ?? '…') + '%'; return `<span class="${pr.ph}${peer === me ? ' me' : ''}">J${i + 1} ${st}</span>`; }).join('');
      setTimeout(upd, 250);
    };
    upd();
  };

  /** A teammate's office, seen through a security camera, built from their live state. */
  MP.drawPartner = function (n, t) {
    const s = MP.session, peer = n.cam.slice(2), p = s && peerOf(s, peer), pr = p && p.presence;
    const ctx = n.ctx, W = n.W, H = n.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const banner = (txt) => { ctx.save(); ctx.font = `bold ${Math.max(16, H * 0.06)}px VT323, monospace`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(txt, W / 2, H / 2); ctx.restore(); };
    if (!pr || pr.ph === 'dead' || pr.ph === 'left' || pr.ph === 'lobby') {
      A.staticFx(ctx, W, H, 0.9, t);
      banner(pr && pr.ph === 'dead' ? L('SIGNAL PERDU — GARDIEN ÉLIMINÉ', 'SIGNAL LOST — GUARD DOWN') : L('SIGNAL PERDU', 'SIGNAL LOST'));
      A.scanlines(ctx, W, H); return;
    }
    const off = R.office(n.ch), sc = Math.max(W / R.OW, (H / R.OH) * 0.9), ox = (W - R.OW * sc) / 2, oy = (H - R.OH * sc) / 2;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.drawImage(off, 0, 0);
    if (n.ch === 1) {
      for (let i = 0; i < 2; i++) {
        const x = i ? 1290 : 100, lit = pr.l && pr.l[i], who = pr.w && pr.w[i];
        ctx.drawImage(R.doorHall(i, !!lit), x, 130);
        if (who && FN.CHARS[who] && (lit || Math.sin(t * 3 + i) > 0.55)) { ctx.save(); ctx.beginPath(); ctx.rect(x, 130, 210, 500); ctx.clip(); A.drawChar(ctx, who, x + (i ? 80 : 130), 640, 470, { t, pose: 'lean', flip: i === 1, light: lit ? 0.9 : 0.12, eyes: 1 }); ctx.restore(); }
        if (pr.d && pr.d[i]) { const g = ctx.createLinearGradient(x, 0, x + 210, 0); g.addColorStop(0, '#2a2d30'); g.addColorStop(0.5, '#6b7075'); g.addColorStop(1, '#2a2d30'); ctx.fillStyle = g; ctx.fillRect(x, 130, 210, 500); ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 150; y < 630; y += 26) ctx.fillRect(x, y, 210, 4); }
      }
      if (pr.io && FN.CHARS[pr.io]) A.drawChar(ctx, pr.io, 800, 900, 760, { t, pose: 'idle', light: 0.7, eyes: 1, stare: true });
      if (pr.out) { ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, R.OW, R.OH); }
    } else {
      ctx.drawImage(R.hall2(!!pr.fl), 564, 136);
      (pr.hall || []).forEach((id, i) => FN.CHARS[id] && A.drawChar(ctx, id, 740 + i * 70, 560, 330, { t, light: pr.fl ? 0.85 : 0, eyes: 1 }));
      if (pr.ix && FN.CHARS[pr.ix]) A.drawChar(ctx, pr.ix, 800, 930, 820, { t, pose: pr.ix === 'lumi' ? 'float' : 'idle', light: 0.75, eyes: 1 });
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = n.ch === 1 ? '#a9c2b4' : '#c8b8ec'; ctx.fillRect(0, 0, W, H); ctx.restore();
    A.staticFx(ctx, W, H, 0.16 + (n.camSwitchT > 0 ? n.camSwitchT * 3 : 0), t);
    A.scanlines(ctx, W, H);
    const u = Math.max(14, H * 0.04);
    ctx.font = `${u}px VT323, monospace`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    const info = n.ch === 1 ? `${L('Énergie', 'Power')} ${pr.pw}%` : `${L('Lampe', 'Light')} ${pr.pw}% · ♪ ${pr.bx}%`;
    ctx.fillText(info, 18 * n.dpr, H - 100 * n.dpr - u * 1.4);
    if (n.ch === 2 && pr.m) { ctx.fillStyle = '#ffcc66'; ctx.fillText(L('☻ MASQUE PORTÉ', '☻ MASK ON'), 18 * n.dpr, H - 100 * n.dpr - u * 2.6); }
    if (Math.floor(t * 1.5) % 2) A.ell(ctx, W - 30 * n.dpr, 70 * n.dpr, u * 0.4, u * 0.4, '#e11');
  };

  // ---------------------------------------------------------------- pause, end of night, leaving
  MP.pauseMenu = function (n) {
    const o = $('#overlay');
    o.className = 'trans';
    o.innerHTML = `<div class="big">${L('PAUSE', 'PAUSED')}</div><div class="small">${L('La nuit continue pour votre équipe.', 'The night goes on for your team.')}</div>
      <div class="btns"><button class="mbtn" data-a="r">${FN.t('resumeGame')}</button><button class="mbtn" data-a="q">${L('Quitter la partie', 'Leave the game')}</button></div>`;
    o.querySelector('[data-a=r]').onclick = () => { o.className = 'hidden'; o.innerHTML = ''; };
    o.querySelector('[data-a=q]').onclick = () => { o.className = 'hidden'; o.innerHTML = ''; const ch = n.ch; MP.session && MP.session.net.presence({ ph: 'left' }); n.over = true; n.destroy(); MP.leave(); FN.UI.goTitle(ch); };
  };
  MP.onEnd = function (result, killer) {
    const s = MP.session; if (!s) return;
    s.inGame = 'over'; s.result = result; s.killer = killer;
    if (result === 'won') { AU.play('chimes6'); AU.music('victory'); }
    const o = $('#overlay');
    o.className = '';
    const head = result === 'won'
      ? `<div class="clockflip">6<span class="am">AM</span></div><div class="mid">${L('Vous avez survécu', 'You survived')}</div>`
      : `<div class="go-text">${FN.t('gameOver')}</div><div class="mid">${esc(FN.t('killedBy', { name: FN.L(FN.CHARS[killer].name) }))}</div>`;
    o.innerHTML = `${head}<div class="mp-team" id="mpTeam"></div><div class="small" id="mpTeamSum"></div>
      <div class="btns">${s.host ? `<button class="mbtn" data-a="lobby">${L('Nouvelle nuit (salon)', 'New night (lobby)')}</button>` : `<button class="mbtn" data-a="lobby">${L('Retour au salon', 'Back to the lobby')}</button>`}<button class="mbtn" data-a="q">${L('Quitter', 'Leave')}</button></div>`;
    o.querySelector('[data-a=lobby]').onclick = () => { o.className = 'hidden'; o.innerHTML = ''; AU.stopMusic(); MP.backToLobby(); };
    o.querySelector('[data-a=q]').onclick = () => { o.className = 'hidden'; o.innerHTML = ''; AU.stopMusic(); const ch = s.ch; MP.leave(); FN.UI.goTitle(ch); };
    renderTeam(s);
  };
  function renderTeam(s) {
    const el = $('#mpTeam'); if (!el) return;
    const me = s.net.me();
    let alive = 0, won = 0, done = 0;
    el.innerHTML = s.roster.map((peer, i) => {
      const p = peerOf(s, peer), pr = p ? p.presence : { ph: 'left' };
      let st;
      if (pr.ph === 'dead') { st = `✝ ${esc(FN.CHARS[pr.k] ? FN.L(FN.CHARS[pr.k].name) : L('éliminé', 'down'))}`; done++; }
      else if (pr.ph === 'won') { st = L('a survécu jusqu’à 6 h', 'made it to 6 AM'); won++; done++; }
      else if (pr.ph === 'play') { st = `${L('en vie', 'alive')} · ${FN.util.HOURS[pr.hr || 0]} AM · ${pr.pw ?? '?'} %`; alive++; }
      else { st = L('a quitté la partie', 'left the game'); done++; }
      return `<div class="mp-row ${pr.ph}"><span class="mp-n">J${i + 1}</span><b>${esc(pr.nick || '?')}${peer === me ? ` (${L('vous', 'you')})` : ''}</b><span>${st}</span></div>`;
    }).join('');
    const sum = $('#mpTeamSum');
    if (sum) sum.textContent = alive ? L(`${alive} gardien(s) encore en vie…`, `${alive} guard(s) still alive…`) : won ? L(`L’équipe a survécu : ${won}/${s.roster.length}`, `The team survived: ${won}/${s.roster.length}`) : L('Toute l’équipe a été éliminée.', 'The whole team is down.');
  }
  MP.backToLobby = function () {
    const s = MP.session; if (!s) return;
    s.inGame = false; s.roster = null; s.painted = null;
    s.net.presence({ ph: 'lobby', st: null, g: null, k: null, t: null, pw: null, w: null, d: null, l: null, io: null, ix: null, hall: null });
    FN.UI.show('mp');
    renderLobby(s);
  };
  MP.leave = async function () {
    const s = MP.session; if (!s) return;
    MP.session = null;
    clearInterval(s.timer); s.unsub && s.unsub();
    try { await s.net.presence({ ph: 'left' }); } catch (e) {}
    setTimeout(() => s.net.leave(), 150);
  };

  document.addEventListener('DOMContentLoaded', () => {});
  window.addEventListener('load', () => {
    const b = $('#mpBack');
    if (b) b.onclick = () => { if (MP.session && !MP.session.inGame) MP.leave(); FN.UI.back(); };
  });
  window.addEventListener('pagehide', () => { if (MP.session) MP.session.net.presence({ ph: 'left' }); });

  FN.MP = MP;
})(window.FN);
