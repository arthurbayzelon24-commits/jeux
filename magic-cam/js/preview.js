// Renders a real frame of each effect on a synthetic golden wireframe hand,
// used as the effect thumbnails (no image files needed).
import { Engine } from './engine.js';
import { makeCanvas } from './fx/util.js';

// Open right hand, palm towards the camera. Units: wrist -> middle knuckle = 1.
const HAND = [
  [0, 0],
  [-0.35, -0.15],
  [-0.62, -0.38],
  [-0.82, -0.58],
  [-0.98, -0.78],
  [-0.3, -0.95],
  [-0.38, -1.35],
  [-0.42, -1.6],
  [-0.45, -1.82],
  [-0.05, -1.0],
  [-0.06, -1.45],
  [-0.07, -1.72],
  [-0.08, -1.95],
  [0.18, -0.95],
  [0.24, -1.36],
  [0.28, -1.6],
  [0.31, -1.8],
  [0.38, -0.82],
  [0.5, -1.1],
  [0.57, -1.28],
  [0.63, -1.45],
];

function syntheticHand(cx, cy, len, W, H, tilt = 0.45, roll = 0) {
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const landmarks = [];
  const world = [];
  for (const [x0, y0] of HAND) {
    const x = x0 * c - y0 * s;
    const y = x0 * s + y0 * c;
    landmarks.push({ x: (cx + x * len) / W, y: (cy + y * len * Math.cos(tilt)) / H, z: 0 });
    world.push({ x: x * 0.09, y: y * 0.09 * Math.cos(tilt), z: -y * 0.09 * Math.sin(tilt) });
  }
  return { landmarks, world, handedness: 'Right' };
}

function backdrop(W, H, person) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H / 2, W * 0.8);
  grad.addColorStop(0, '#2a2433');
  grad.addColorStop(1, '#09080d');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,220,170,${Math.random() * 0.5})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  if (person) {
    g.fillStyle = '#3a3440';
    personShape(g, W, H);
    g.fill();
  }
  return c;
}

function personShape(g, W, H) {
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.36, W * 0.11, H * 0.14, 0, 0, Math.PI * 2);
  g.moveTo(W * 0.18, H);
  g.bezierCurveTo(W * 0.2, H * 0.62, W * 0.34, H * 0.56, W * 0.5, H * 0.55);
  g.bezierCurveTo(W * 0.66, H * 0.56, W * 0.8, H * 0.62, W * 0.82, H);
  g.closePath();
}

function syntheticMask(W, H) {
  const mw = 96;
  const mh = 96;
  const c = makeCanvas(mw, mh);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  personShape(g, mw, mh);
  g.fill();
  const d = g.getImageData(0, 0, mw, mh).data;
  const data = new Float32Array(mw * mh);
  for (let i = 0; i < data.length; i++) data[i] = d[i * 4 + 3] / 255;
  return { width: mw, height: mh, data };
}

// Returns a data URL with a rendered frame of the effect.
export function renderPreview(def, size = 360) {
  const W = size;
  const H = size;
  const canvas = makeCanvas(W, H);
  const effect = def.make();
  const engine = new Engine(canvas, { settings: { skeleton: true, cinema: true }, maxSide: size });
  const needsSeg = effect.needs?.seg;
  const source = backdrop(W, H, needsSeg);
  const mask = needsSeg ? syntheticMask(W, H) : null;
  engine.setEffect(effect);
  const pose = {
    lightning: [0.5, 0.82, 0.24, 0.2, 0],
    fireball: [0.5, 0.86, 0.22, 0.5, 0],
    aura: [0.78, 0.6, 0.12, 0.2, 0.2],
    telekinesis: [0.5, 0.88, 0.2, 0.3, 0],
    teleport: [0.78, 0.6, 0.12, 0.2, 0.2],
    floating: [0.5, 0.95, 0.2, 1.1, 0],
    circle: [0.5, 0.8, 0.17, 0.25, 0],
    plasma: [0.5, 0.9, 0.2, 0.7, 0],
    galaxy: [0.52, 0.85, 0.2, 0.9, -0.2],
    sakura: [0.62, 0.9, 0.2, 0.2, 0.3],
  }[def.id] || [0.5, 0.8, 0.22, 0.3, 0];
  const frames = def.id === 'sakura' ? 150 : 50;
  let now = 1000;
  for (let i = 0; i < frames; i++) {
    now += 33;
    const sway = Math.sin(i * 0.15) * 0.01;
    const raw = [syntheticHand(W * (pose[0] + sway), H * pose[1], H * pose[2], W, H, pose[3], pose[4])];
    if (def.id === 'teleport' && i === frames - 12) effect.trigger?.(engine);
    engine.frame({ source, sw: W, sh: H, mirror: false, raw, mask, now });
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}
