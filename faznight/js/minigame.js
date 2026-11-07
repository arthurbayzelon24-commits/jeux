/* FAZNIGHT — secret 8-bit mini-game "Le Dernier Service": deliver cake to four waiting children. */
(function (FN) {
  const MAP = [
    '####################',
    '#K....#......#.....#',
    '#.....#..T...#..T..#',
    '#..........#.......#',
    '#.....#....#.......#',
    '###.###....#####.###',
    '#..................#',
    '#..T......##.......#',
    '#.........##....T..#',
    '#..................#',
    '####.#########.#####',
    '#..................#',
    '#........P.........#',
    '#.........E........#',
    '####################',
  ];
  const TS = 8;

  FN.Minigame = {
    open(onClose) {
      const ov = document.getElementById('overlay');
      ov.className = '';
      ov.innerHTML = `<canvas id="mgc" width="160" height="120" style="image-rendering:pixelated;width:min(92vw,128vh);aspect-ratio:4/3;max-height:62vh;border:2px solid #333;background:#000"></canvas>
        <div id="mgtext" class="small" style="min-height:2.6em"></div>
        <div style="display:grid;grid-template-columns:repeat(3,58px);gap:6px;margin-top:8px">
          <span></span><button class="hbtn" style="position:static" data-d="0,-1">▲</button><span></span>
          <button class="hbtn" style="position:static" data-d="-1,0">◀</button><button class="hbtn" style="position:static" data-act="x">✕</button><button class="hbtn" style="position:static" data-d="1,0">▶</button>
          <span></span><button class="hbtn" style="position:static" data-d="0,1">▼</button><span></span>
        </div>`;
      const cv = ov.querySelector('#mgc'), x = cv.getContext('2d');
      const txt = ov.querySelector('#mgtext');
      const grid = MAP.map((r) => r.split(''));
      let px = 0, py = 0, sx = 1, sy = 13, carrying = false, served = 0, phase = 'play', t = 0, endT = 0;
      const kids = [];
      grid.forEach((r, y) => r.forEach((c, xx) => { if (c === 'P') { px = xx; py = y; } if (c === 'T') kids.push({ x: xx, y, fed: false }); }));
      const say = (s) => (txt.textContent = s);
      say(FN.lang === 'en' ? 'Bring cake from the kitchen (K) to each child.' : 'Apportez du gâteau de la cuisine (K) à chaque enfant.');
      let dir = null, held = 0, alive = true;
      const move = (dx, dy) => {
        if (phase !== 'play') return;
        const nx = px + dx, ny = py + dy;
        if (grid[ny] && grid[ny][nx] && grid[ny][nx] !== '#') { px = nx; py = ny; FN.Audio.play('uiMove'); }
        if (grid[py][px] === 'K' && !carrying) { carrying = true; FN.Audio.play('trophy'); say(FN.lang === 'en' ? 'Cake! Find a hungry child.' : 'Du gâteau ! Trouvez un enfant affamé.'); }
        for (const k of kids) if (!k.fed && carrying && Math.abs(k.x - px) + Math.abs(k.y - py) <= 1) {
          k.fed = true; carrying = false; served++; FN.Audio.play('squeak');
          say(served < 4 ? (FN.lang === 'en' ? `${served}/4 served.` : `${served}/4 servis.`) : FN.lang === 'en' ? 'Everyone is served… go to the exit (E).' : 'Tout le monde est servi… allez vers la sortie (E).');
        }
        if (served >= 4 && grid[py][px] === 'E') { phase = 'end'; endT = 0; FN.Audio.play('hiddenTape'); }
      };
      ov.querySelectorAll('[data-d]').forEach((b) => {
        const d = b.dataset.d.split(',').map(Number);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); dir = d; held = 0; move(...d); });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => (dir = null));
      });
      const close = () => { alive = false; window.removeEventListener('keydown', key); onClose && onClose(); };
      ov.querySelector('[data-act=x]').addEventListener('click', close);
      const key = (e) => {
        const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, -1], s: [0, 1], q: [-1, 0], d: [1, 0] }[e.key];
        if (m) { e.preventDefault(); move(...m); }
        if (e.key === 'Escape') close();
      };
      window.addEventListener('keydown', key);
      let last = performance.now();
      const loop = (now) => {
        if (!alive) return;
        const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
        if (dir) { held += dt; if (held > 0.18) { held = 0.06; move(...dir); } }
        // the shadow follows slowly
        if (phase === 'play' && Math.floor(t * 2.2) !== Math.floor((t - dt) * 2.2)) {
          const dx = Math.sign(px - sx), dy = Math.sign(py - sy);
          if (Math.random() < 0.5 && grid[sy][sx + dx] !== '#') sx += dx; else if (grid[sy + dy] && grid[sy + dy][sx] !== '#') sy += dy;
          if (sx === px && sy === py) { px = 9; py = 12; sx = 1; sy = 13; carrying = false; FN.Audio.play('glitch', {}); say(FN.lang === 'en' ? 'It caught you. Try again.' : 'La silhouette vous a rejoint. Recommencez.'); }
        }
        x.fillStyle = '#000'; x.fillRect(0, 0, 160, 120);
        grid.forEach((r, y) => r.forEach((c, xx) => {
          if (c === '#') { x.fillStyle = (xx + y) % 2 ? '#3a1a4a' : '#2a1238'; x.fillRect(xx * TS, y * TS, TS, TS); }
          else { x.fillStyle = (xx + y) % 2 ? '#141414' : '#0c0c0c'; x.fillRect(xx * TS, y * TS, TS, TS); }
          if (c === 'K') { x.fillStyle = '#d9b23a'; x.fillRect(xx * TS + 1, y * TS + 2, 6, 4); }
          if (c === 'E') { x.fillStyle = served >= 4 ? '#6bff6b' : '#225522'; x.fillRect(xx * TS + 1, y * TS + 1, 6, 6); }
        }));
        for (const k of kids) {
          x.fillStyle = k.fed ? '#8fd3ff' : '#777'; x.fillRect(k.x * TS + 2, k.y * TS + 1, 4, 3); x.fillRect(k.x * TS + 1, k.y * TS + 4, 6, 4);
          x.fillStyle = '#000'; x.fillRect(k.x * TS + 2, k.y * TS + 2, 1, 1); x.fillRect(k.x * TS + 5, k.y * TS + 2, 1, 1);
          if (!k.fed && Math.floor(t * 2) % 2) { x.fillStyle = '#fff'; x.fillRect(k.x * TS + 3, k.y * TS - 3, 2, 2); }
        }
        // player (small badger mask)
        x.fillStyle = '#9a948a'; x.fillRect(px * TS + 1, py * TS, 6, 5); x.fillStyle = '#eee'; x.fillRect(px * TS + 3, py * TS, 2, 2);
        x.fillStyle = '#c22'; x.fillRect(px * TS + 2, py * TS + 5, 4, 3);
        if (carrying) { x.fillStyle = '#d9b23a'; x.fillRect(px * TS + 5, py * TS + 3, 3, 2); }
        // shadow
        if (phase === 'play') { x.fillStyle = '#000'; x.fillRect(sx * TS, sy * TS, TS, TS); x.fillStyle = '#fff'; x.fillRect(sx * TS + 2, sy * TS + 2, 1, 1); x.fillRect(sx * TS + 5, sy * TS + 2, 1, 1); }
        if (phase === 'end') {
          endT += dt;
          x.fillStyle = `rgba(0,0,0,${Math.min(0.9, endT * 0.3)})`; x.fillRect(0, 0, 160, 120);
          if (endT > 1.5) {
            x.fillStyle = '#9c9783'; x.fillRect(72, 30, 16, 18); x.fillRect(70, 48, 20, 30);
            x.fillStyle = '#000'; x.fillRect(75, 36, 3, 3); x.fillRect(82, 36, 3, 3);
            x.fillStyle = '#fff'; x.fillRect(76, 37, 1, 1); x.fillRect(83, 37, 1, 1);
          }
          if (endT > 3) { x.fillStyle = '#c33'; x.font = '8px monospace'; x.textAlign = 'center'; x.fillText(FN.lang === 'en' ? 'THEY ARE STILL WAITING' : 'ILS ATTENDENT TOUJOURS', 80, 100); }
          if (endT > 3 && endT - dt <= 3) { FN.Trophies.secret('minigame'); say(FN.lang === 'en' ? 'Secret ending.' : 'Fin secrète.'); }
        }
        if (Math.random() < 0.02) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, Math.random() * 120, 160, 3); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };
})(window.FN);
