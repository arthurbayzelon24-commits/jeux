// Double power: one power in each hand. The hand on the right of the screen
// drives the main power, the one on the left the second power. Built as a
// single effect that forwards every hook to both.
const HOOKS = ['drawBackground', 'drawBehind', 'draw', 'drawOver'];

export function makeDual(main, second) {
  const split = (hands, e) => {
    if (hands.length >= 2) {
      const sorted = [...hands].sort((a, b) => b.palm.x - a.palm.x);
      return [[sorted[0]], sorted.slice(1)];
    }
    // One hand: it belongs to the side of the screen it is on.
    return hands[0] && hands[0].palm.x < e.W / 2 ? [[], hands] : [hands, []];
  };
  const dual = {
    id: `${main.id}+${second.id}`,
    name: `${main.name} + ${second.name}`,
    dual: [main, second],
    colors: main.colors,
    needs: {
      seg: !!(main.needs?.seg || second.needs?.seg),
      pose: !!(main.needs?.pose || second.needs?.pose),
      plate: !!(main.needs?.plate || second.needs?.plate),
    },
    occlude: main.occlude || second.occlude,
    noBlur: main.noBlur && second.noBlur,
    chargeMode: main.chargeMode,
    action: main.action || second.action,
    setColor(i) {
      main.setColor?.(i);
    },
    start(e) {
      main.start?.(e);
      second.start?.(e);
    },
    stop(e) {
      main.stop?.(e);
      second.stop?.(e);
    },
    update(dt, hands, e) {
      const [a, b] = split(hands, e);
      main.update?.(dt, a, e);
      second.update?.(dt, b, e);
    },
    trigger(e) {
      main.trigger?.(e);
      second.trigger?.(e);
    },
    ultimate(e, a) {
      main.ultimate?.(e, a);
      second.ultimate?.(e, a);
    },
  };
  for (const name of HOOKS)
    if (main[name] || second[name])
      dual[name] = (ctx, e) => {
        // Each power draws with its own hands in e.hands (some read it there).
        const all = e.hands;
        const [a, b] = split(all, e);
        let handled = false;
        try {
          e.hands = b;
          if (second[name]) handled = second[name](ctx, e) || handled;
          e.hands = a;
          if (main[name]) handled = main[name](ctx, e) || handled;
        } finally {
          e.hands = all;
        }
        return handled;
      };
  return dual;
}
