// Colour trails: the tips of your fingers leave a short rainbow trail, with
// any power. Turned on in Paramètres ("Traînées de couleur").
export class Trails {
  constructor() {
    this.on = false;
    this.pts = new Map(); // hand id -> [{ x, y, t }] per fingertip
  }

  update(dt, hands, e) {
    if (!this.on) return;
    const seen = new Set();
    for (const h of hands) {
      if (h.presence < 0.5) continue;
      seen.add(h.id);
      let tr = this.pts.get(h.id);
      if (!tr) this.pts.set(h.id, (tr = [[], [], [], [], []]));
      h.tips.forEach((p, i) => {
        tr[i].push({ x: p.x, y: p.y, t: e.t });
        while (tr[i].length && e.t - tr[i][0].t > 0.35) tr[i].shift();
      });
    }
    for (const id of this.pts.keys()) if (!seen.has(id)) this.pts.delete(id);
  }

  draw(ctx, e) {
    if (!this.on) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const tr of this.pts.values())
      tr.forEach((pts, f) => {
        if (pts.length < 2) return;
        // Each finger its own colour, moving through the rainbow.
        const hue = (f * 72 + e.t * 120) % 360;
        for (let i = 1; i < pts.length; i++) {
          const k = i / pts.length;
          ctx.strokeStyle = `hsla(${hue},100%,65%,${0.7 * k})`;
          ctx.lineWidth = (2 + 7 * k) * e.unit;
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      });
    ctx.restore();
  }
}
