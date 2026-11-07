/* FAZNIGHT — interface strings (French first, English second). */
window.FN = window.FN || {};
(function (FN) {
  const STR = {
    fr: {
      tagline: "La collection d'horreur animatronique",
      bootPresents: 'présente', bootWarnTitle: 'Avertissement', bootWarn: 'Ce jeu contient des images effrayantes, des sons soudains et forts, et des lumières qui clignotent.', bootHeadphones: 'Pour une meilleure expérience : jouez dans le noir, avec un casque.',
      bootScary: 'Veuillez ne pas rentrer dans l’écran, sinon vous allez mourir. Les animatroniques peuvent sortir légèrement de l’écran. Si vous mourez, ils sortiront littéralement de l’écran et vous tueront dans votre corps. Sinon, vous pourriez vomir ou avoir une crise cardiaque.',
      devBy: 'Développé par Dadabot 132', difficulty: 'Difficulté', chooseGame: 'Choisissez un jeu', soonStamp: 'COMING SOON', g_new: 'Nouvelle partie', g_continue: 'Continuer', g_night6: '6e nuit', g_custom: 'Custom Night', g_all: 'Toutes les nuits', g_locked2: 'Terminez la Nuit 5 du jeu 1 pour l’ouvrir.', g_play: 'Jouer', g_soon: 'Le prochain jeu de la collection est en préparation.', g_ad: 'Offre d’emploi', g_contNight: 'Nuit {n}',
      play: 'Jouer', continue: 'Continuer', resume: 'Reprendre la nuit', collection: 'Collection', trophies: 'Trophées',
      customNight: 'Custom Night', extras: 'Extras', settings: 'Paramètres', credits: 'Crédits',
      continueSub: '{chapter} — Nuit {night}', resumeSub: '{chapter} — Nuit {night}, {hour}', newGameSub: 'Aucune partie en cours',
      chapter: 'Chapitre {n}', night: 'Nuit {n}', locked: 'Verrouillé', start: 'Commencer',
      nightsOf: 'Nuits — {chapter}', newGame: 'Nouvelle partie', newGameConfirm: 'Recommencer le chapitre depuis la Nuit 1 ? Les trophées et les secrets sont conservés.',
      bestiary: 'Animatroniques', unknown: '???', seenOn: 'Découvert', notSeen: 'Pas encore aperçu',
      status_locked: 'Verrouillé', status_progress: 'En cours', status_done: 'Terminé',
      nightsDone: 'Nuits terminées : {n}/{t}', trophiesCount: 'Trophées : {n}/{t}', progressPct: 'Progression : {p} %',
      unlockHint1: 'Terminez la Nuit 5 du Chapitre 1', comingSoon: 'Prochain chapitre — en préparation',
      // night descriptions
      n1: 'Apprentissage et découverte', n2: 'La difficulté augmente', n3: 'Nouveaux comportements', n4: 'Agressivité accrue',
      n5: 'Difficulté maximale du scénario', n6: 'Nuit secrète',
      // HUD
      door: 'Porte', light: 'Lumière', cams: 'Caméras', power: 'Énergie : {p} %', usage: 'Conso :', mask: 'Masque', flash: 'Lampe',
      vent: 'Conduit', battery: 'Lampe : {p} %', wind: 'Remonter', muteCall: 'Couper l’appel', pause: 'Pause',
      camOff: 'CAMÉRA HORS SERVICE', audioOnly: 'AUDIO UNIQUEMENT', signalLost: 'SIGNAL PERDU',
      // overlays
      am: 'AM', hourLabel: '{h} AM', nightIntro: 'Nuit {n}', customIntro: 'Custom Night', winNight: 'Nuit {n} terminée',
      winCustom: 'Custom Night réussie', gameOver: 'GAME OVER', retry: 'Réessayer', menu: 'Menu principal', nextNight: 'Nuit suivante',
      resumeGame: 'Reprendre', restart: 'Recommencer la nuit', quitSave: 'Sauvegarder et quitter', paused: 'PAUSE',
      killedBy: 'Vous n’avez pas survécu à {name}.', powerOutTitle: 'Coupure de courant',
      rotate: 'Tournez votre téléphone en mode paysage pour une meilleure expérience.', playAnyway: 'Jouer quand même',
      tapToStart: 'Touchez pour commencer', loading: 'Chargement…', record: 'Record', reward: 'Récompense',
      starEarned: 'Étoile obtenue', unlockedNight: 'Nuit {n} débloquée', unlockedChapter: 'Nouveau chapitre débloqué',
      unlockedCustom: 'Custom Night débloquée', chapterUnlockTitle: 'CHAPITRE 2 DÉBLOQUÉ', newRecord: 'Nouveau record !',
      // custom
      customLocked: 'Terminez la Nuit 6 du chapitre pour débloquer sa Custom Night.', presets: 'Défis', freePlay: 'Libre',
      totalLevel: 'Difficulté totale : {n}', bestRecord: 'Meilleur record : {n}', challengeRule: 'Règle : {r}',
      // settings
      g_title: 'Votre gardien', g_color: 'Couleur de l’uniforme', g_outfit: 'Tenue', g_acc: 'Accessoire', g_skin: 'Teint', g_hair: 'Cheveux', g_classic: 'Chemise', g_jacket: 'Veste', g_none: 'Aucun', g_cap: 'Casquette', g_glasses: 'Lunettes', g_scarf: 'Écharpe', g_headset: 'Casque radio', g_lockCap: 'Terminez la Nuit 1', g_lockGlasses: '5 trophées', g_lockScarf: 'Nuit 1 du Chapitre 2', g_lockHeadset: 'Réussissez un défi',
      s_graphics: 'Graphismes', s_3d: 'Rendu 3D (Three.js)', s_3dSub: 'Bureaux et animatroniques en 3D temps réel. Désactivez-le sur un appareil peu puissant.', s_3dNone: 'WebGL indisponible sur cet appareil : rendu 2.5D utilisé.', s_quality: 'Qualité graphique', s_shadows: 'Ombres et lumières dynamiques', s_perf: 'Mode performance',
      s_perfSub: '30 images/s, effets allégés', s_immersion: 'Mode immersion', s_immersionSub: 'Plein écran, vibrations, aucun conseil à l’écran',
      s_audio: 'Audio', s_master: 'Volume général', s_music: 'Musique', s_sfx: 'Effets sonores', s_amb: 'Ambiance', s_voice: 'Voix (téléphone)',
      s_controls: 'Commandes', s_sens: 'Sensibilité tactile', s_sensSub: 'Vitesse de rotation du bureau', s_game: 'Jeu',
      s_duration: 'Durée d’une nuit', s_lang: 'Langue', s_profile: 'Profil', s_name: 'Nom du gardien', s_saves: 'Sauvegarde',
      s_export: 'Exporter', s_import: 'Importer', s_reset: 'Tout effacer', s_resetConfirm: 'Effacer toute la progression, les trophées et les secrets ? Cette action est définitive.',
      s_saveInfo: 'Sauvegarde locale automatique (stockage du navigateur + IndexedDB).', s_imported: 'Sauvegarde importée.', s_badFile: 'Fichier de sauvegarde invalide.',
      low: 'Basse', medium: 'Moyenne', high: 'Haute', on: 'Activé', off: 'Désactivé', min: '{n} min',
      s_vibrate: 'Vibrations', s_subtitles: 'Sous-titres du téléphone', s_account: 'Compte en ligne',
      s_accountSub: 'Facultatif — la synchronisation en ligne n’est pas encore disponible. Votre progression reste sur cet appareil ; utilisez Exporter pour la transférer.',
      s_install: 'Installer le jeu', s_installSub: 'Ajoutez FAZNIGHT à l’écran d’accueil (Android : menu ⋮ › Installer ; iPhone : Partager › Sur l’écran d’accueil).', s_installBtn: 'Installer',
      // extras
      x_archives: 'Archives', x_minigame: 'Mini-jeu : Le Dernier Service', x_terminal: 'Terminal', x_theater: 'Salle des frayeurs', x_secrets: 'Secrets découverts : {n}/{t}',
      x_lockedDoc: 'Document non découvert', x_playMini: 'Jouer', terminalPrompt: 'ENTREZ UN CODE', terminalBad: 'CODE INCONNU', terminalOk: 'CODE ACCEPTÉ',
      terminalUsed: 'CODE DÉJÀ UTILISÉ', close: 'Fermer', docFound: 'Document découvert', secretFound: 'Secret découvert',
      theaterHint: 'Touchez un animatronique pour revoir son attaque.',
      // trophies
      t_total: 'Trophées obtenus', t_platinum: 'Platine', bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine', obtained: 'Obtenu le {d}', notObtained: 'Non obtenu',
      trophyUnlocked: 'Trophée débloqué',
      tips: 'Conseil',
    },
    en: {
      tagline: 'The animatronic horror collection',
      bootPresents: 'presents', bootWarnTitle: 'Warning', bootWarn: 'This game contains frightening images, sudden loud sounds and flashing lights.', bootHeadphones: 'For the best experience: play in the dark, with headphones.',
      bootScary: 'Please do not go into the screen, or you will die. The animatronics may come slightly out of the screen. If you die, they will literally come out of the screen and kill you in your body. Otherwise, you could throw up or have a heart attack.',
      devBy: 'Developed by Dadabot 132', difficulty: 'Difficulty', chooseGame: 'Choose a game', soonStamp: 'COMING SOON', g_new: 'New game', g_continue: 'Continue', g_night6: '6th night', g_custom: 'Custom Night', g_all: 'All nights', g_locked2: 'Finish Night 5 of game 1 to open it.', g_play: 'Play', g_soon: 'The next game in the collection is in the works.', g_ad: 'Help wanted', g_contNight: 'Night {n}',
      play: 'Play', continue: 'Continue', resume: 'Resume night', collection: 'Collection', trophies: 'Trophies',
      customNight: 'Custom Night', extras: 'Extras', settings: 'Settings', credits: 'Credits',
      continueSub: '{chapter} — Night {night}', resumeSub: '{chapter} — Night {night}, {hour}', newGameSub: 'No game in progress',
      chapter: 'Chapter {n}', night: 'Night {n}', locked: 'Locked', start: 'Start',
      nightsOf: 'Nights — {chapter}', newGame: 'New game', newGameConfirm: 'Restart the chapter from Night 1? Trophies and secrets are kept.',
      bestiary: 'Animatronics', unknown: '???', seenOn: 'Discovered', notSeen: 'Not spotted yet',
      status_locked: 'Locked', status_progress: 'In progress', status_done: 'Completed',
      nightsDone: 'Nights completed: {n}/{t}', trophiesCount: 'Trophies: {n}/{t}', progressPct: 'Progress: {p}%',
      unlockHint1: 'Complete Night 5 of Chapter 1', comingSoon: 'Next chapter — in the works',
      n1: 'Learning the ropes', n2: 'Difficulty rises', n3: 'New behaviours', n4: 'Increased aggression',
      n5: 'Maximum story difficulty', n6: 'Secret night',
      door: 'Door', light: 'Light', cams: 'Cameras', power: 'Power: {p}%', usage: 'Usage:', mask: 'Mask', flash: 'Light',
      vent: 'Vent', battery: 'Flashlight: {p}%', wind: 'Wind up', muteCall: 'Mute call', pause: 'Pause',
      camOff: 'CAMERA OFFLINE', audioOnly: 'AUDIO ONLY', signalLost: 'SIGNAL LOST',
      am: 'AM', hourLabel: '{h} AM', nightIntro: 'Night {n}', customIntro: 'Custom Night', winNight: 'Night {n} complete',
      winCustom: 'Custom Night cleared', gameOver: 'GAME OVER', retry: 'Try again', menu: 'Main menu', nextNight: 'Next night',
      resumeGame: 'Resume', restart: 'Restart night', quitSave: 'Save and quit', paused: 'PAUSED',
      killedBy: 'You were caught by {name}.', powerOutTitle: 'Power outage',
      rotate: 'Turn your phone to landscape for the best experience.', playAnyway: 'Play anyway',
      tapToStart: 'Tap to start', loading: 'Loading…', record: 'Record', reward: 'Reward',
      starEarned: 'Star earned', unlockedNight: 'Night {n} unlocked', unlockedChapter: 'New chapter unlocked',
      unlockedCustom: 'Custom Night unlocked', chapterUnlockTitle: 'CHAPTER 2 UNLOCKED', newRecord: 'New record!',
      customLocked: 'Complete Night 6 of the chapter to unlock its Custom Night.', presets: 'Challenges', freePlay: 'Free',
      totalLevel: 'Total difficulty: {n}', bestRecord: 'Best record: {n}', challengeRule: 'Rule: {r}',
      g_title: 'Your guard', g_color: 'Uniform colour', g_outfit: 'Outfit', g_acc: 'Accessory', g_skin: 'Skin tone', g_hair: 'Hair', g_classic: 'Shirt', g_jacket: 'Jacket', g_none: 'None', g_cap: 'Cap', g_glasses: 'Glasses', g_scarf: 'Scarf', g_headset: 'Radio headset', g_lockCap: 'Complete Night 1', g_lockGlasses: '5 trophies', g_lockScarf: 'Chapter 2 Night 1', g_lockHeadset: 'Clear a challenge',
      s_graphics: 'Graphics', s_3d: '3D rendering (Three.js)', s_3dSub: 'Real-time 3D offices and animatronics. Turn it off on a low-end device.', s_3dNone: 'WebGL is not available on this device: 2.5D rendering is used.', s_quality: 'Graphics quality', s_shadows: 'Dynamic shadows & lights', s_perf: 'Performance mode',
      s_perfSub: '30 fps, lighter effects', s_immersion: 'Immersion mode', s_immersionSub: 'Fullscreen, vibration, no on-screen tips',
      s_audio: 'Audio', s_master: 'Master volume', s_music: 'Music', s_sfx: 'Sound effects', s_amb: 'Ambience', s_voice: 'Voice (phone)',
      s_controls: 'Controls', s_sens: 'Touch sensitivity', s_sensSub: 'Office panning speed', s_game: 'Game',
      s_duration: 'Night length', s_lang: 'Language', s_profile: 'Profile', s_name: 'Guard name', s_saves: 'Save data',
      s_export: 'Export', s_import: 'Import', s_reset: 'Erase all', s_resetConfirm: 'Erase all progress, trophies and secrets? This cannot be undone.',
      s_saveInfo: 'Automatic local save (browser storage + IndexedDB).', s_imported: 'Save imported.', s_badFile: 'Invalid save file.',
      low: 'Low', medium: 'Medium', high: 'High', on: 'On', off: 'Off', min: '{n} min',
      s_vibrate: 'Vibration', s_subtitles: 'Phone subtitles', s_account: 'Online account',
      s_accountSub: 'Optional — online sync is not available yet. Progress stays on this device; use Export to move it.',
      s_install: 'Install the game', s_installSub: 'Add FAZNIGHT to your home screen (Android: ⋮ menu › Install; iPhone: Share › Add to Home Screen).', s_installBtn: 'Install',
      x_archives: 'Archives', x_minigame: 'Mini-game: The Last Shift', x_terminal: 'Terminal', x_theater: 'Scare theatre', x_secrets: 'Secrets found: {n}/{t}',
      x_lockedDoc: 'Undiscovered document', x_playMini: 'Play', terminalPrompt: 'ENTER A CODE', terminalBad: 'UNKNOWN CODE', terminalOk: 'CODE ACCEPTED',
      terminalUsed: 'CODE ALREADY USED', close: 'Close', docFound: 'Document found', secretFound: 'Secret found',
      theaterHint: 'Tap an animatronic to replay its attack.',
      t_total: 'Trophies earned', t_platinum: 'Platinum', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', obtained: 'Earned on {d}', notObtained: 'Not earned',
      trophyUnlocked: 'Trophy unlocked',
      tips: 'Tip',
    },
  };

  FN.lang = 'fr';
  FN.t = function (key, vars) {
    let s = (STR[FN.lang] && STR[FN.lang][key]) ?? STR.fr[key] ?? key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return FN.names(s);
  };
  /** Pick the current-language variant of a {fr, en} object (or return a plain string). */
  /** Character names live in one place (FN.CHARS). Texts write {@id} and get the official name. */
  FN.names = function (s) {
    return typeof s === 'string' && s.includes('{@') ? s.replace(/\{@(\w+)\}/g, (m, id) => (FN.CHARS && FN.CHARS[id] ? FN.L(FN.CHARS[id].name) : m)) : s;
  };
  FN.L = function (obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return FN.names(obj);
    return FN.names(obj[FN.lang] ?? obj.fr);
  };
  FN.applyI18n = function (root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = FN.t(el.dataset.i18n)));
    document.documentElement.lang = FN.lang;
  };
})(window.FN);
