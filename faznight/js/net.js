/* FAZNIGHT — network layer for team nights.
   Online: the claude.ai "room" capability (everyone who has the published page open).
   Fallback: a BroadcastChannel between tabs of the same browser (local play / tests).
   Everything travels as each player's *presence* object (absolute state, ~2 updates/s),
   so no message ordering or replay is needed. */
(function (FN) {
  const Net = {};

  Net.open = async function (code) {
    const name = 'fnight-' + String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
    let room = null;
    try { if (window.claude && typeof window.claude.use === 'function') room = await window.claude.use('room'); } catch (e) { room = null; }
    if (room) {
      try { return wrapRoom(await room.join(name)); } catch (e) { console.warn('FAZNIGHT: room join failed, using local mode', e); }
    }
    return localRoom(name);
  };

  function wrapRoom(r) {
    const subs = new Set();
    const conv = () => r.peers().map((p) => ({ peer: p.peer, isMe: !!p.sameTab, presence: p.presence || {} }));
    const un = r.onPeers(() => { const ps = conv(); subs.forEach((f) => f(ps)); });
    return {
      kind: 'online',
      me: () => { const m = r.peers().find((p) => p.sameTab); return m ? m.peer : null; },
      peers: conv,
      presence: (patch) => r.presence(patch).catch(() => {}),
      connected: () => r.connected(),
      onPeers(f) { subs.add(f); return () => subs.delete(f); },
      leave() { un(); subs.clear(); return r.leave().catch(() => {}); },
    };
  }

  function localRoom(name) {
    const me = 'l' + Math.random().toString(36).slice(2, 10);
    let bc = null;
    try { bc = new BroadcastChannel(name); } catch (e) { bc = null; }
    let mine = {};
    const others = new Map();
    const subs = new Set();
    const list = () => [{ peer: me, isMe: true, presence: mine }, ...[...others].map(([peer, o]) => ({ peer, isMe: false, presence: o.p }))];
    const notify = () => { const l = list(); subs.forEach((f) => f(l)); };
    const send = () => bc && bc.postMessage({ peer: me, p: mine });
    if (bc) bc.onmessage = (e) => {
      const m = e.data;
      if (!m || !m.peer || m.peer === me) return;
      if (m.bye) { others.delete(m.peer); notify(); return; }
      const had = others.has(m.peer);
      others.set(m.peer, { p: m.p || {}, at: Date.now() });
      if (!had) send(); // introduce ourselves to the newcomer
      notify();
    };
    const hb = setInterval(() => {
      send();
      let changed = false;
      for (const [k, o] of others) if (Date.now() - o.at > 4500) { others.delete(k); changed = true; }
      if (changed) notify();
    }, 1000);
    let pend = 0;
    return {
      kind: 'local',
      me: () => me,
      peers: list,
      connected: () => !!bc,
      presence(patch) {
        const next = Object.assign({}, mine);
        for (const k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
        mine = next;
        if (!pend) pend = setTimeout(() => { pend = 0; send(); }, 50);
        notify();
        return Promise.resolve();
      },
      onPeers(f) { subs.add(f); setTimeout(() => f(list()), 0); return () => subs.delete(f); },
      leave() { clearInterval(hb); if (bc) { bc.postMessage({ peer: me, bye: true }); bc.close(); } subs.clear(); return Promise.resolve(); },
    };
  }

  FN.Net = Net;
})(window.FN);
