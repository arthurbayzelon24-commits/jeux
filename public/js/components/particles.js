import { prefersReducedMotion } from '../lib/dom.js';

const COLORS = ['69,229,245', '66,99,255', '139,92,246', '245,247,255'];

/**
 * Slow drifting light particles on a canvas. Pauses when off-screen or when
 * the tab is hidden; draws a single still frame under reduced motion.
 */
export function startParticles(canvas, { density = 0.00009, linkDistance = 110, speed = 0.18 } = {}) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let particles = [];
  let frame = 0;
  let running = true;
  let visible = true;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(140, Math.round(width * height * density));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r: Math.random() * 1.6 + 0.4,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: Math.random() * 0.6 + 0.25,
    }));
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      for (let j = i + 1; j < particles.length; j += 1) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.hypot(dx, dy);
        if (dist < linkDistance) {
          ctx.strokeStyle = `rgba(66,99,255,${0.12 * (1 - dist / linkDistance)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    if (!running) return;
    if (visible && !document.hidden) {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }
      draw();
    }
    frame = requestAnimationFrame(step);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  intersection.observe(canvas);
  resize();
  if (!prefersReducedMotion()) frame = requestAnimationFrame(step);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersection.disconnect();
  };
}
