// Zwevende lichtdeeltjes op de achtergrond (zuinig: max 30 fps, pauzeert tijdens gamen)
const Ambient = (() => {
  const canvas = document.getElementById('ambient');
  const ctx = canvas.getContext('2d');
  let parts = [], running = false, rgb = [42, 168, 232], last = 0, w = 0, hgt = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.width = Math.floor(innerWidth * dpr);
    hgt = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    const count = Math.round((innerWidth * innerHeight) / 32000);
    parts = Array.from({ length: Math.min(70, count) }, () => spawn(true));
  }

  function spawn(anywhere) {
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * hgt : hgt + 10,
      r: (Math.random() ** 2) * 2.4 + 0.6,
      vy: -(Math.random() * 0.25 + 0.08),
      vx: (Math.random() - 0.5) * 0.12,
      a: Math.random() * 0.5 + 0.15,
      tw: Math.random() * Math.PI * 2,
    };
  }

  function frame(t) {
    if (!running) return;
    requestAnimationFrame(frame);
    // niks gedaan in de laatste 20 s? dan rustiger tekenen (scheelt veel CPU/GPU en batterij)
    const idle = typeof Idle !== 'undefined' && Date.now() - Idle.last > 20000;
    if (t - last < (idle ? 80 : 33)) return;
    const step = Math.min(3, (t - last) / 33) || 1; // zelfde snelheid, minder beelden
    last = t;
    ctx.clearRect(0, 0, w, hgt);
    for (const p of parts) {
      p.x += p.vx * 2 * step; p.y += p.vy * 2 * step; p.tw += 0.03 * step;
      if (p.y < -10) Object.assign(p, spawn(false));
      const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.r > 2) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.12})`;
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    start() { if (!running) { running = true; canvas.style.display = ''; requestAnimationFrame(frame); } },
    stop() { running = false; ctx.clearRect(0, 0, w, hgt); canvas.style.display = 'none'; },
    color(hex) { const m = hex.replace('#', '').match(/.{2}/g); if (m) rgb = m.map((x) => parseInt(x, 16)); },
  };
})();
