/* FAZNIGHT — boot sequence and global wiring. */
(function (FN) {
  const $ = (s) => document.querySelector(s);

  async function boot() {
    const d = await FN.Save.load();
    const params = new URLSearchParams(location.search);
    if (params.get('speed')) FN.debugSpeed = Math.max(1, Math.min(200, +params.get('speed')));
    FN.lang = d.settings.lang || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');
    d.settings.lang = FN.lang;
    FN.applyI18n();
    FN.Audio.vols = { master: d.settings.master, music: d.settings.music, sfx: d.settings.sfx, amb: d.settings.amb, voice: d.settings.voice };

    // home menu
    $('#homeMenu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      FN.Audio.init();
      FN.Audio.setVolumes(FN.Audio.vols);
      FN.Audio.play('uiSelect');
      const act = b.dataset.act;
      if (act === 'continue') {
        if (FN.Game.resumeSaved()) return;
        const ch = d.last.chapter || 1;
        const n = Math.min(7, FN.Save.data.chapters[ch].next);
        FN.Game.start({ chapter: ch, night: n });
      } else if (act === 'play') FN.UI.openNights(FN.Save.data.chapters[2].unlocked ? FN.Save.data.last.chapter || 1 : 1);
      else if (act === 'custom') {
        const sd = FN.Save.data;
        if (!sd.customUnlocked[1] && !sd.customUnlocked[2]) { FN.Audio.play('denied'); FN.UI.toast('info', FN.t('customNight'), FN.t('customLocked'), '🔒'); return; }
        FN.UI.show('custom');
      } else FN.UI.show(act);
    });
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => FN.UI.back()));
    document.addEventListener('mouseover', (e) => { if (e.target.closest && e.target.closest('.mbtn') && FN.Audio.ready) FN.Audio.play('uiMove'); });

    // logo: tap 5 times for the terminal
    let taps = 0, tapT = 0;
    $('#logo').addEventListener('click', () => {
      const now = Date.now();
      taps = now - tapT < 800 ? taps + 1 : 1; tapT = now;
      if (taps >= 5) { taps = 0; FN.Audio.init(); FN.Audio.play('glitch', {}); FN.UI.terminal(); }
    });

    // first gesture: unlock audio and start the menu music
    const unlock = () => {
      FN.Audio.init();
      FN.Audio.setVolumes(FN.Audio.vols);
      if (FN.UI.current !== 'game' && !FN.Audio._musicOut) FN.Audio.music('menu');
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    // pause automatically when the app goes to background, and save the night
    document.addEventListener('visibilitychange', () => {
      const g = FN.Game.current;
      if (document.hidden) {
        if (g && g.running && !g.over) {
          g.pause();
          FN.Save.data.resume = { cfg: Object.assign({}, g.cfg, { resume: null }), state: g.serialize(), hour: g.hour, saved: Date.now() };
          FN.Save.flush();
        }
        FN.Audio.suspend();
      } else FN.Audio.resume();
    });
    window.addEventListener('pagehide', () => FN.Save.flush());

    // prevent pinch-zoom / double-tap zoom on iOS during play
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 300 && e.target.closest('#game')) e.preventDefault(); lastTouch = now; }, { passive: false });

    FN.UI.show('home', false);
    FN.Trophies.evaluate();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  boot();
})(window.FN);
