/* FAZNIGHT — trophies (real conditions only), secrets and documents. */
(function (FN) {
  const S = () => FN.Save.data;
  const done = (ch, ...n) => n.every((k) => S().chapters[ch].done[k]);
  const seenAll = (ch) => FN.charsOf(ch).every((id) => S().seen[id]);

  // Challenges counted for "Défis principaux"
  FN.MAIN_CHALLENGES = ['c1_nocam', 'c1_nolight', 'c1_lowpower', 'c1_flawless'];

  const T = [
    // ---------------- bronze
    { id: 'b_first', tier: 'bronze', name: { fr: 'Premier service', en: 'First Shift' }, desc: { fr: 'Survivre à la Nuit 1 du Chapitre 1.', en: 'Survive Night 1 of Chapter 1.' }, check: () => done(1, 1) },
    { id: 'b_spot', tier: 'bronze', name: { fr: 'Premier regard', en: 'First Glance' }, desc: { fr: 'Découvrir un animatronique sur les caméras.', en: 'Spot an animatronic on camera.' }, check: () => Object.keys(S().seen).length >= 1 },
    { id: 'b_death', tier: 'bronze', name: { fr: 'Bienvenue chez Grimwood', en: 'Welcome to Grimwood’s' }, desc: { fr: 'Se faire attraper pour la première fois.', en: 'Get caught for the first time.' }, check: () => S().stats.deaths >= 1 },
    { id: 'b_krok', tier: 'bronze', name: { fr: 'Porte blindée', en: 'Reinforced Door' }, desc: { fr: 'Survivre à une charge de {@krok} grâce à la porte.', en: 'Survive {@krok}’s charge thanks to the door.' } },
    { id: 'b_call', tier: 'bronze', name: { fr: 'Bonne écoute', en: 'Good Listener' }, desc: { fr: 'Écouter un appel téléphonique en entier.', en: 'Listen to a whole phone call.' } },
    { id: 'b_ch2', tier: 'bronze', name: { fr: 'Nouvelle usine', en: 'New Factory' }, desc: { fr: 'Survivre à la Nuit 1 du Chapitre 2.', en: 'Survive Night 1 of Chapter 2.' }, check: () => done(2, 1) },
    { id: 'b_wind', tier: 'bronze', name: { fr: 'Mélomane', en: 'Music Lover' }, desc: { fr: 'Remonter complètement la boîte à musique.', en: 'Fully wind the music box.' } },
    // ---------------- silver
    { id: 's_three', tier: 'silver', name: { fr: 'Trois nuits', en: 'Three Nights' }, desc: { fr: 'Terminer les Nuits 1 à 3 du Chapitre 1.', en: 'Complete Nights 1–3 of Chapter 1.' }, check: () => done(1, 1, 2, 3) },
    { id: 's_secret', tier: 'silver', name: { fr: 'Nuit secrète', en: 'Secret Night' }, desc: { fr: 'Débloquer la Nuit 6 du Chapitre 1.', en: 'Unlock Night 6 of Chapter 1.' }, check: () => done(1, 5) },
    { id: 's_challenge', tier: 'silver', name: { fr: 'Défi relevé', en: 'Challenge Accepted' }, desc: { fr: 'Réussir un défi de Custom Night.', en: 'Clear a Custom Night challenge.' }, check: () => Object.keys(S().challengesDone).length >= 1 },
    { id: 's_dark', tier: 'silver', name: { fr: 'Dans le noir', en: 'In the Dark' }, desc: { fr: 'Atteindre 6 h après une coupure de courant.', en: 'Reach 6 AM after a power outage.' } },
    { id: 's_census', tier: 'silver', name: { fr: 'Recensement', en: 'Census' }, desc: { fr: 'Apercevoir les quatre animatroniques du Chapitre 1.', en: 'Spot all four Chapter 1 animatronics.' }, check: () => seenAll(1) },
    { id: 's_ch2three', tier: 'silver', name: { fr: 'Habitué de l’usine', en: 'Factory Regular' }, desc: { fr: 'Terminer les Nuits 1 à 3 du Chapitre 2.', en: 'Complete Nights 1–3 of Chapter 2.' }, check: () => done(2, 1, 2, 3) },
    { id: 's_mask', tier: 'silver', name: { fr: 'Visage de plastique', en: 'Plastic Face' }, desc: { fr: 'Tromper 6 intrus avec le masque en une seule nuit.', en: 'Fool 6 intruders with the mask in a single night.' } },
    // ---------------- gold
    { id: 'g_ch1', tier: 'gold', name: { fr: 'Gardien de Grimwood', en: 'Grimwood’s Guard' }, desc: { fr: 'Terminer les cinq nuits principales du Chapitre 1.', en: 'Complete the five main nights of Chapter 1.' }, check: () => done(1, 1, 2, 3, 4, 5) },
    { id: 'g_n6', tier: 'gold', name: { fr: 'Heures supplémentaires', en: 'Overtime' }, desc: { fr: 'Survivre à la Nuit 6 du Chapitre 1.', en: 'Survive Night 6 of Chapter 1.' }, check: () => done(1, 6) },
    { id: 'g_ch2', tier: 'gold', name: { fr: 'Maître de l’usine', en: 'Factory Master' }, desc: { fr: 'Terminer les cinq nuits principales du Chapitre 2.', en: 'Complete the five main nights of Chapter 2.' }, check: () => done(2, 1, 2, 3, 4, 5) },
    { id: 'g_ch2n6', tier: 'gold', name: { fr: 'Fermeture définitive', en: 'Final Closing' }, desc: { fr: 'Survivre à la Nuit 6 du Chapitre 2.', en: 'Survive Night 6 of Chapter 2.' }, check: () => done(2, 6) },
    { id: 'g_custom', tier: 'gold', name: { fr: 'Cauchemar maîtrisé', en: 'Nightmare Tamed' }, desc: { fr: 'Réussir une Custom Night à au moins 75 % de la difficulté maximale.', en: 'Clear a Custom Night at 75% or more of maximum difficulty.' }, check: () => S().customRecords[1] >= 60 || S().customRecords[2] >= 105 },
    { id: 'g_challenges', tier: 'gold', name: { fr: 'Tous les défis', en: 'Every Challenge' }, desc: { fr: 'Réussir les défis principaux : sans caméra, sans lumière, énergie limitée, sans erreur.', en: 'Clear the main challenges: no cameras, no lights, low power, flawless.' }, check: () => FN.MAIN_CHALLENGES.every((c) => S().challengesDone[c]) },
    { id: 'g_secrets', tier: 'gold', name: { fr: 'Chercheur de secrets', en: 'Secret Seeker' }, desc: { fr: 'Découvrir au moins 3 secrets.', en: 'Discover at least 3 secrets.' }, check: () => Object.keys(S().secrets).length >= 3 },
    { id: 'g_bestiary', tier: 'gold', name: { fr: 'Bestiaire complet', en: 'Full Bestiary' }, desc: { fr: 'Apercevoir tous les animatroniques des deux chapitres.', en: 'Spot every animatronic of both chapters.' }, check: () => seenAll(1) && seenAll(2) },
    { id: 'g_archives', tier: 'gold', name: { fr: 'Archiviste', en: 'Archivist' }, desc: { fr: 'Retrouver les 5 documents.', en: 'Find all 5 documents.' }, check: () => FN.DOCS.every((d) => S().docs[d.id]) },
    { id: 'g_hollow', tier: 'gold', name: { fr: 'Le Creux', en: 'The Hollow' }, desc: { fr: 'Croiser {@hollow} dans les deux chapitres.', en: 'Encounter {@hollow} in both chapters.' }, check: () => S().secrets.hollow1 && S().secrets.hollow2 },
    // ---------------- platinum
    { id: 'p_plat', tier: 'platinum', name: { fr: 'FAZNIGHT — Platine', en: 'FAZNIGHT — Platinum' }, desc: { fr: 'Obtenir tous les autres trophées : toutes les nuits des deux chapitres, les défis principaux et les secrets majeurs.', en: 'Earn every other trophy: all nights of both chapters, the main challenges and the major secrets.' }, check: () => T.filter((t) => t.tier !== 'platinum').every((t) => S().trophies[t.id]) },
  ];

  FN.SECRETS = [
    { id: 'hollow1', name: { fr: 'Le visiteur du bureau', en: 'The office visitor' } },
    { id: 'hollow2', name: { fr: 'Le visiteur du couloir', en: 'The hallway visitor' } },
    { id: 'nose', name: { fr: 'Le nez qui couine', en: 'The squeaky nose' } },
    { id: 'tape', name: { fr: 'La bande cachée', en: 'The hidden tape' } },
    { id: 'code2704', name: { fr: 'Les chiffres de la cuisine', en: 'The kitchen digits' } },
    { id: 'codefrog', name: { fr: 'Le mot chiffré', en: 'The ciphered word' } },
    { id: 'codehollow', name: { fr: 'Le nom interdit', en: 'The forbidden name' } },
    { id: 'minigame', name: { fr: 'Le Dernier Service', en: 'The Last Shift' } },
    { id: 'phantom', name: { fr: 'L’hallucination', en: 'The hallucination' } },
  ];

  FN.DOCS = [
    {
      id: 'd1', title: { fr: 'Coupure de presse — 1986', en: 'Newspaper clipping — 1986' },
      text: {
        fr: 'GRIMWOOD’S PIZZA PALACE OUVRE SES PORTES. Le fondateur, Harold Grimwood, promet « des amis mécaniques qui ne dorment jamais ». Interrogé sur le mystérieux mot peint dans l’atelier, il sourit : « César avait trois clés. Reculez de trois, vous comprendrez. »',
        en: 'GRIMWOOD’S PIZZA PALACE OPENS ITS DOORS. Founder Harold Grimwood promises “mechanical friends that never sleep”. Asked about the strange word painted in the workshop, he smiled: “Caesar had three keys. Step back three and you’ll understand.”',
      },
    },
    {
      id: 'd2', title: { fr: 'Rapport d’incident — 27/04', en: 'Incident report — 04/27' },
      text: {
        fr: 'Nuit du 27 avril. Le gardien signale une cinquième mascotte « sans visage » dans le bureau. Aucune cinquième mascotte n’a jamais été commandée. L’employé l’appelait par un nom que la direction a interdit de prononcer : HOLLOW.',
        en: 'Night of April 27. The guard reports a fifth, “faceless” mascot in the office. No fifth mascot was ever ordered. The employee called it by a name management has forbidden: HOLLOW.',
      },
    },
    {
      id: 'd3', title: { fr: 'Fiche d’entretien — {@oldkrok}', en: 'Maintenance sheet — {@oldkrok}' },
      text: {
        fr: 'Capteurs optiques hypersensibles. La lumière vive provoque un réflexe de recul. NE PAS réactiver. NE PAS laisser dans le couloir principal. Signé : service technique.',
        en: 'Optical sensors over-sensitive. Bright light triggers a recoil reflex. DO NOT reactivate. DO NOT leave in the main hallway. Signed: technical department.',
      },
    },
    {
      id: 'd4', title: { fr: 'Lettre de la direction', en: 'Letter from management' },
      text: {
        fr: 'Cher gardien, merci pour vos heures supplémentaires. Le restaurant fermera ses portes cette semaine. Les animatroniques seront transférés vers notre nouvel établissement, la Fun Factory. Votre poste vous y attend. — H. G.',
        en: 'Dear guard, thank you for your overtime. The restaurant will close this week. The animatronics will be moved to our new venue, the Fun Factory. Your position awaits you there. — H. G.',
      },
    },
    {
      id: 'd5', title: { fr: 'Note manuscrite', en: 'Handwritten note' },
      text: {
        fr: 'Si vous lisez ceci, vous avez tenu plus longtemps que moi. Ils ne sont pas méchants. Ils attendent quelqu’un qui n’est jamais revenu. Ne restez pas pour le découvrir. — Gérard',
        en: 'If you are reading this, you lasted longer than I did. They aren’t evil. They are waiting for someone who never came back. Don’t stay to find out. — Gérard',
      },
    },
  ];

  const ICON = { bronze: '✦', silver: '✧', gold: '★', platinum: '◆' };

  FN.Trophies = {
    list: T,
    icon: (tier) => ICON[tier],
    /** Award a trophy only if it isn't owned yet. Returns true when newly awarded. */
    award(id) {
      const d = S();
      if (d.trophies[id]) return false;
      const tr = T.find((t) => t.id === id);
      if (!tr) return false;
      d.trophies[id] = Date.now();
      FN.Save.flush();
      FN.UI && FN.UI.toastTrophy(tr);
      setTimeout(() => this.evaluate(), 50);
      return true;
    },
    /** Re-check every condition-based trophy against the current save. */
    evaluate() {
      for (const t of T) if (t.check && !S().trophies[t.id] && t.check()) this.award(t.id);
    },
    count() { return T.filter((t) => S().trophies[t.id]).length; },
    secret(id) {
      const d = S();
      if (d.secrets[id]) return false;
      d.secrets[id] = Date.now();
      FN.Save.flush();
      const s = FN.SECRETS.find((x) => x.id === id);
      FN.UI && FN.UI.toast('info', FN.t('secretFound'), s ? FN.L(s.name) : id, '?');
      this.evaluate();
      FN.UI && FN.UI.refreshHome && FN.UI.refreshHome();
      return true;
    },
    doc(id) {
      const d = S();
      if (d.docs[id]) return false;
      d.docs[id] = Date.now();
      FN.Save.flush();
      const doc = FN.DOCS.find((x) => x.id === id);
      FN.UI && FN.UI.toast('info', FN.t('docFound'), doc ? FN.L(doc.title) : id, '✉');
      this.evaluate();
      return true;
    },
    seen(id) {
      const d = S();
      if (d.seen[id]) return;
      d.seen[id] = Date.now();
      FN.Save.save();
      this.evaluate();
    },
  };
})(window.FN);
