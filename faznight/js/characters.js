/* FAZNIGHT — original animatronic cast. Looks drive the procedural rig in art.js. */
(function (FN) {
  FN.CHARS = {
    // ------------------------------------------------ Chapter 1 — Grimwood's Pizza Palace
    bruno: {
      type: { fr: 'Animatronique de scène', en: 'Stage animatronic' }, variant: { fr: 'Original', en: 'Original' },
      chapter: 1, order: 1, scream: 300, laugh: 100,
      name: { fr: 'Bruno le Blaireau', en: 'Bruno the Badger' },
      role: { fr: 'Chanteur vedette', en: 'Lead singer' },
      desc: {
        fr: 'La star de la scène. Il ne bouge presque jamais… tant qu’on le regarde. Son rire grave annonce chacun de ses pas. Il préfère le côté droit et se cache dans l’ombre de la porte.',
        en: 'The star of the stage. He barely moves… as long as you watch him. His deep laugh announces every step. He favours the right side and hides in the doorway’s shadow.',
      },
      hint: { fr: 'Gardez un œil sur lui avec les caméras : il ne bouge que lorsqu’il n’est pas observé. Fermez la porte droite quand il atteint l’angle Est.', en: 'Keep him on camera: he only moves when unobserved. Close the right door when he reaches the East corner.' },
      look: { kind: 'badger', fur: '#6e6a64', belly: '#d9d1bf', stripe: '#ece5d5', eye: '#ffb000', head: { rx: 80, ry: 70 }, hat: true, accent: '#7a1010', bow: '#7a1010', prop: 'mic', rust: 0.6, wires: 2, seed: 11 },
    },
    gus: {
      type: { fr: 'Animatronique de scène', en: 'Stage animatronic' }, variant: { fr: 'Original', en: 'Original' },
      chapter: 1, order: 2, scream: 460,
      name: { fr: 'Gus le Bouc', en: 'Gus the Goat' },
      role: { fr: 'Bassiste', en: 'Bassist' },
      desc: {
        fr: 'Nerveux et imprévisible. Gus saute parfois des pièces entières et fait du bruit dans le couloir Ouest pour vous tromper.',
        en: 'Jittery and unpredictable. Gus sometimes skips whole rooms and makes noise in the West hall to fool you.',
      },
      hint: { fr: 'Utilisez la lumière gauche : si sa silhouette apparaît dans l’embrasure, fermez la porte jusqu’à ce qu’il reparte.', en: 'Use the left light: if his silhouette is in the doorway, shut the door until he leaves.' },
      look: { claws: true, kind: 'goat', fur: '#8d6f4c', belly: '#d6c7a8', horn: '#bfb196', eye: '#ff2d2d', head: { rx: 66, ry: 74 }, prop: 'bass', accent: '#6b1a1a', rust: 0.7, wires: 3, seed: 22 },
    },
    nora: {
      type: { fr: 'Animatronique d’accueil', en: 'Greeter animatronic' }, variant: { fr: 'Original', en: 'Original' },
      chapter: 1, order: 3, scream: 620,
      name: { fr: 'Nora la Chouette', en: 'Nora the Owl' },
      role: { fr: 'Hôtesse', en: 'Hostess' },
      desc: {
        fr: 'Patiente. Nora reste immobile très longtemps, puis disparaît des caméras pour réapparaître beaucoup plus près. Elle approche par la droite.',
        en: 'Patient. Nora stays still for a long time, then vanishes from the cameras to reappear much closer. She comes from the right.',
      },
      hint: { fr: 'Si elle disparaît de la Grande salle, vérifiez tout de suite la lumière droite.', en: 'If she vanishes from the Main hall, check the right light at once.' },
      look: { kind: 'owl', fur: '#2f5a55', belly: '#cfd8cf', accent: '#d98c1c', eye: '#bfe9ff', head: { rx: 84, ry: 76 }, bib: 'MIAM!', rust: 0.4, wires: 1, seed: 33 },
    },
    krok: {
      type: { fr: 'Animatronique d’attraction', en: 'Attraction animatronic' }, variant: { fr: 'Original', en: 'Original' },
      chapter: 1, order: 4, scream: 220,
      name: { fr: 'Krok le Crocodile', en: 'Krok the Crocodile' },
      role: { fr: 'Conteur du Marais', en: 'Swamp storyteller' },
      desc: {
        fr: 'Il vit derrière le rideau du Marais. Plus vous l’oubliez, plus il s’impatiente. Quand il sort, il court dans le couloir Ouest et frappe la porte.',
        en: 'He lives behind the Swamp curtain. The longer you forget him, the more restless he gets. Once out, he sprints down the West hall and slams the door.',
      },
      hint: { fr: 'Regardez la caméra du Marais régulièrement, sans la fixer. S’il est sorti, fermez la porte gauche immédiatement.', en: 'Check the Swamp camera regularly, without staring. If he is out, close the left door immediately.' },
      look: { kind: 'croc', fur: '#3f6a2c', belly: '#bfc48e', eye: '#ffe14a', head: { rx: 74, ry: 62 }, vest: '#5a2b16', prop: 'lantern', cap: '#2b2f4a', tail: 'croc', rust: 0.5, wires: 2, seed: 44 },
    },
    hollow: {
      type: { fr: 'Mascotte inconnue', en: 'Unknown mascot' }, variant: { fr: 'Secret', en: 'Secret' },
      chapter: 0, order: 9, secret: true, scream: 160,
      name: { fr: 'Hank le Creux', en: 'Hollow Hank' },
      role: { fr: 'Apparition', en: 'Apparition' },
      desc: {
        fr: 'Une mascotte vide qu’aucun registre ne mentionne. On raconte qu’elle n’apparaît qu’aux gardiens trop fatigués.',
        en: 'An empty mascot that no record mentions. They say it only appears to guards who are far too tired.',
      },
      hint: { fr: 'Ne le fixez pas. Levez ou baissez le moniteur aussitôt.', en: 'Don’t stare at it. Raise or lower the monitor at once.' },
      look: { kind: 'hollow', fur: '#9c9783', eye: '#ffffff', head: { rx: 76, ry: 82 }, torso: 'thin', bodyW: 0.9, bodyH: 1.15, scale: 1.08, rust: 1, seed: 99, loseEye: false },
    },

    // ------------------------------------------------ Chapter 2 — Grimwood's Fun Factory
    pepper: {
      type: { fr: 'Animatronique de scène', en: 'Stage animatronic' }, variant: { fr: 'Nouvelle génération', en: 'New generation' },
      chapter: 2, order: 1, scream: 520,
      name: { fr: 'Pepper la Panda', en: 'Pepper the Panda' },
      role: { fr: 'Nouvelle vedette', en: 'New star' },
      desc: { fr: 'Brillante, neuve, toujours souriante. Elle descend le grand couloir et entre dans le bureau.', en: 'Shiny, brand new, always smiling. She walks down the main hallway and into the office.' },
      hint: { fr: 'Dès qu’elle est dans le bureau, mettez le masque et gardez-le jusqu’à ce qu’elle reparte.', en: 'As soon as she is in the office, put on the mask and keep it on until she leaves.' },
      look: { finish: 'plastic', kind: 'panda', fur: '#f2efea', belly: '#ffffff', eye: '#7dd3ff', head: { rx: 82, ry: 72 }, bow: '#d8336b', rust: 0.05, seed: 55, hand: '#1a1a1a', foot: '#1a1a1a', loseEye: false },
    },
    rico: {
      type: { fr: 'Animatronique d’animation', en: 'Entertainer animatronic' }, variant: { fr: 'Nouvelle génération', en: 'New generation' },
      chapter: 2, order: 2, scream: 700,
      name: { fr: 'Rico le Raton', en: 'Rico the Raccoon' },
      role: { fr: 'Farceur', en: 'Prankster' },
      desc: { fr: 'Il rampe dans le conduit gauche. Les bruits l’attirent : la lampe, le remontage de la boîte à musique…', en: 'He crawls through the left vent. Noise draws him in: the flashlight, winding the music box…' },
      hint: { fr: 'Limitez les bruits. Quand il entre, mettez le masque.', en: 'Keep noise down. When he enters, put on the mask.' },
      look: { finish: 'plastic', kind: 'raccoon', fur: '#7d7f86', belly: '#e1d9cf', eye: '#ffd166', head: { rx: 70, ry: 62 }, tail: 'ringed', bow: '#3b7dd8', rust: 0.1, seed: 66, scale: 0.9, loseEye: false },
    },
    lumi: {
      type: { fr: 'Attraction lumineuse', en: 'Glow attraction' }, variant: { fr: 'Nouvelle génération', en: 'New generation' },
      chapter: 2, order: 3, scream: 880,
      name: { fr: 'Lumi la Méduse', en: 'Lumi the Jellyfish' },
      role: { fr: 'Attraction lumineuse', en: 'Glow attraction' },
      desc: { fr: 'Elle flotte dans le conduit droit et la lumière l’attire. Plus vous éclairez, plus elle approche vite.', en: 'She drifts through the right vent and light draws her in. The more you shine, the faster she comes.' },
      hint: { fr: 'N’éclairez le conduit droit que brièvement. Masque quand elle entre.', en: 'Only flash the right vent briefly. Mask when she gets in.' },
      look: { finish: 'plastic', kind: 'jelly', fur: '#ff7fb8', belly: '#ffd6ea', accent: '#ff9fd0', eye: '#9ffcff', head: { rx: 78, ry: 66 }, torso: 'thin', legs: 'tentacles', rust: 0, seed: 77, eyeWhite: false, loseEye: false },
    },
    oldkrok: {
      type: { fr: 'Animatronique d’attraction', en: 'Attraction animatronic' }, variant: { fr: 'Abîmé', en: 'Withered' },
      chapter: 2, order: 4, scream: 190,
      name: { fr: 'Vieux Krok', en: 'Old Krok' },
      role: { fr: 'Ancienne attraction', en: 'Retired attraction' },
      desc: { fr: 'Le Krok d’origine, abîmé et rangé dans l’atelier. Le masque ne le trompe pas : seule la lumière le fait reculer.', en: 'The original Krok, broken and stored in the workshop. The mask doesn’t fool him: only light drives him back.' },
      hint: { fr: 'Quand il est dans le couloir, flashez-le plusieurs fois avec la lampe.', en: 'When he is in the hallway, flash him several times with the light.' },
      look: { kind: 'croc', fur: '#34502a', belly: '#9a9a70', eye: '#ffe14a', head: { rx: 74, ry: 62 }, vest: '#3a1d10', cap: '#20223a', tail: 'croc', rust: 1, wires: 5, damage: 1, seed: 45 },
    },
    oldbruno: {
      type: { fr: 'Animatronique de scène', en: 'Stage animatronic' }, variant: { fr: 'Abîmé', en: 'Withered' },
      chapter: 2, order: 5, scream: 280,
      name: { fr: 'Vieux Bruno', en: 'Old Bruno' },
      role: { fr: 'Ancienne vedette', en: 'Retired star' },
      desc: { fr: 'Ce qu’il reste du premier Bruno. Il traîne dans le couloir puis entre dans le bureau, comme Pepper.', en: 'What is left of the first Bruno. He drags himself down the hallway, then into the office, like Pepper.' },
      hint: { fr: 'Masque dès qu’il entre. Il reste plus longtemps que Pepper.', en: 'Mask as soon as he enters. He stays longer than Pepper.' },
      look: { kind: 'badger', fur: '#5a5650', belly: '#a9a191', stripe: '#cfc8b8', eye: '#ffb000', head: { rx: 80, ry: 70 }, hat: true, accent: '#4a0a0a', bow: '#4a0a0a', rust: 1, wires: 6, damage: 1, seed: 12 },
    },
    chime: {
      type: { fr: 'Automate musical', en: 'Musical automaton' }, variant: { fr: 'Nouvelle génération', en: 'New generation' },
      chapter: 2, order: 6, scream: 980,
      name: { fr: 'Madame Chime', en: 'Madame Chime' },
      role: { fr: 'Danseuse de la Salle des prix', en: 'Prize Room dancer' },
      desc: { fr: 'Une ballerine de porcelaine qui dort tant que sa boîte à musique joue. Si la mélodie s’arrête, rien ne l’arrête plus.', en: 'A porcelain ballerina who sleeps while her music box plays. If the melody stops, nothing stops her.' },
      hint: { fr: 'Remontez la boîte à musique sur la caméra 11 avant qu’elle ne soit vide.', en: 'Wind the music box on camera 11 before it runs out.' },
      look: { finish: 'plastic', kind: 'doll', fur: '#d9c7cf', belly: '#f3e6ea', eye: '#ffffff', head: { rx: 56, ry: 64 }, torso: 'thin', legs: 'ballet', tutu: '#e7a6c0', bodyW: 0.7, rust: 0.15, seed: 88, hand: '#efe8df', loseEye: false },
    },
    static: {
      type: { fr: 'Animatronique télévisé', en: 'TV animatronic' }, variant: { fr: 'Nouvelle génération', en: 'New generation' },
      chapter: 2, order: 7, scream: 1200,
      name: { fr: 'Static', en: 'Static' },
      role: { fr: 'Animateur télé', en: 'TV host' },
      desc: { fr: 'Il vit dans les signaux. Il apparaît sur une caméra et vous regarde à travers l’écran.', en: 'He lives in the signal. He shows up on a camera and stares back through the screen.' },
      hint: { fr: 'Si son visage remplit une caméra, baissez le moniteur immédiatement.', en: 'If his face fills a camera, lower the monitor immediately.' },
      look: { finish: 'plastic', kind: 'tv', fur: '#2a2c34', eye: '#7dffb0', head: { rx: 74, ry: 62 }, torso: 'suit', accent: '#1f8a5a', rust: 0.3, seed: 101, loseEye: false },
    },
    // ------------------------------------------------ secret endoskeleton & the player
    endo: {
      type: { fr: 'Endosquelette', en: 'Endoskeleton' }, variant: { fr: 'Secret', en: 'Secret' },
      chapter: 0, order: 8, secret: true, scream: 340,
      name: { fr: 'Endo-7', en: 'Endo-7' },
      role: { fr: 'Squelette de maintenance', en: 'Maintenance skeleton' },
      desc: {
        fr: 'Le squelette mécanique que l’on glisse dans chaque costume. Celui-ci n’a jamais reçu de revêtement. Il attend dans les coulisses, et il n’est pas toujours au même endroit.',
        en: 'The mechanical skeleton that goes inside every suit. This one never got a shell. It waits backstage, and it is not always in the same spot.',
      },
      hint: { fr: 'Regardez la caméra des Coulisses : il est rangé au fond.', en: 'Check the Backstage camera: it is stored at the back.' },
      look: { kind: 'endo', bare: true, fur: '#8a8f96', eye: '#ff3a2a', head: { rx: 74, ry: 66 }, rust: 0.7, seed: 202, loseEye: false },
    },
    guard: {
      type: { fr: 'Humain', en: 'Human' }, variant: { fr: 'Vous', en: 'You' },
      chapter: -1, order: 0, player: true, scream: 300,
      name: { fr: 'Le gardien', en: 'The guard' },
      role: { fr: 'Gardien de nuit', en: 'Night guard' },
      desc: { fr: 'Vous. Uniforme, badge, lampe torche, et un contrat de cinq nuits.', en: 'You. Uniform, badge, flashlight, and a five-night contract.' },
      hint: { fr: 'Personnalisez votre tenue dans Paramètres › Profil.', en: 'Customise your outfit in Settings › Profile.' },
      look: { kind: 'guard', fur: '#1f2a44', eye: '#4a6a8a', head: { rx: 66, ry: 74 }, rust: 0.1, seed: 303, loseEye: false, bodyW: 0.95 },
    },
  };

  FN.charsOf = (ch) => Object.keys(FN.CHARS).filter((k) => FN.CHARS[k].chapter === ch).sort((a, b) => FN.CHARS[a].order - FN.CHARS[b].order);
})(window.FN);
