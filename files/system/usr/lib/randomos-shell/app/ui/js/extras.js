// Extra's: begroeting, screensaver, automatisch slapen, batterijwaarschuwing, controllertest

// ---------------------------------------------------------------- begroeting
function updateGreeting() {
  const el = $('#greeting');
  if (!el) return;
  const hr = new Date().getHours();
  const part = hr < 6 ? 'Goedenacht' : hr < 12 ? 'Goedemorgen' : hr < 18 ? 'Goedemiddag' : 'Goedenavond';
  const name = (S.settings.name || $('#profileName').textContent || '').trim();
  el.textContent = name ? `${part}, ${name}` : part;
}
setInterval(updateGreeting, 60000);

// ---------------------------------------------------------------- niks-doen bijhouden
const Idle = { last: Date.now(), saver: null, slept: false };

Input.intercept((a) => {
  if (a === 'connected' || a === 'disconnected') return false;
  Idle.last = Date.now();
  Idle.slept = false;
  if (Idle.saver) { stopScreensaver(); return true; } // eerste knop maakt alleen wakker
  return false;
});

setInterval(() => {
  const s = S.settings;
  if (!document.body.classList.contains('ready')) return;
  if (S.game || Input.textMode) { Idle.last = Date.now(); return; }
  const idleMin = (Date.now() - Idle.last) / 60000;
  if (s.screensaver && !Idle.saver && idleMin >= s.screensaver) startScreensaver();
  if (s.autoSleep && !Idle.slept && idleMin >= s.autoSleep) {
    Idle.slept = true;
    stopScreensaver();
    nova.sys.power('suspend');
  }
}, 15000);

// ---------------------------------------------------------------- screensaver
function startScreensaver() {
  if (Idle.saver) return;
  const clock = h('div', { class: 'ss-clock' });
  const date = h('div', { class: 'ss-date' });
  const astro = h('img', { class: 'ss-astro', src: 'img/mascot.png', alt: '' });
  const canvas = h('canvas', { class: 'ss-stars' });
  const el = h('div', { id: 'screensaver' }, canvas, astro, h('div', { class: 'ss-time' }, clock, date), h('div', { class: 'ss-hint' }, 'Druk op een knop'));
  document.body.append(el);
  Idle.saver = el;
  Ambient.stop();

  const ctx = canvas.getContext('2d');
  const W = (canvas.width = innerWidth), H = (canvas.height = innerHeight);
  const stars = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2 }));
  let t0 = performance.now(), last = 0;
  const tick = (now) => {
    if (Idle.saver !== el) return;
    requestAnimationFrame(tick);
    if (now - last < 33) return; // 30 fps is genoeg
    last = now;
    const t = (now - t0) / 1000;
    ctx.fillStyle = 'rgba(0, 2, 10, 0.35)';
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      s.x -= s.z * 0.6;
      if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
      ctx.fillStyle = `rgba(255,255,255,${0.25 + s.z * 0.6})`;
      ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2);
    }
    // astronaut drijft langzaam rond (lissajous) en draait zachtjes
    const x = Math.sin(t * 0.11) * W * 0.32;
    const y = Math.sin(t * 0.17 + 1) * H * 0.22;
    astro.style.transform = `translate(${x}px, ${y}px) rotate(${Math.sin(t * 0.3) * 12}deg)`;
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: !!S.settings.clock12 });
    date.textContent = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  requestAnimationFrame(tick);
}

function stopScreensaver() {
  const el = Idle.saver;
  if (!el) return;
  Idle.saver = null;
  el.classList.add('out');
  setTimeout(() => el.remove(), 500);
  applySettings();
}

// ---------------------------------------------------------------- lage batterij
const Battery = { warned15: false, warned5: false };
setInterval(() => {
  const b = S.status && S.status.battery;
  if (!b || S.settings.lowBattery === false) return;
  if (b.status !== 'Discharging') { Battery.warned15 = Battery.warned5 = false; return; }
  if (b.level <= 5 && !Battery.warned5) { Battery.warned5 = true; Sounds.error(); toast(`Batterij bijna leeg (${b.level}%). Sluit je oplader aan!`, { bad: true, icon: 'power', ms: 8000 }); }
  else if (b.level <= 15 && !Battery.warned15) { Battery.warned15 = true; Sounds.open(); toast(`Batterij laag: ${b.level}%`, { bad: true, icon: 'power', ms: 6000 }); }
}, 20000);

// ---------------------------------------------------------------- controllertest
function openPadTest() {
  Sounds.open();
  const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];
  const btns = NAMES.map((n) => h('div', { class: 'pt-btn' }, n));
  const stick = () => { const dot = h('div', { class: 'pt-dot' }); return { el: h('div', { class: 'pt-stick' }, dot), dot }; };
  const ls = stick(), rs = stick();
  const trig = () => { const f = h('div', { class: 'pt-fill' }); return { el: h('div', { class: 'pt-trig' }, f), f }; };
  const lt = trig(), rt = trig();
  const name = h('div', { class: 'pt-name' }, 'Geen controller gevonden – druk op een knop');
  let lastB = 0, modal, running = true;

  const sheet = h('div', { class: 'sheet padtest' },
    h('h2', {}, 'Controller testen'), name,
    h('div', { class: 'pt-grid' },
      h('div', { class: 'pt-col' }, h('div', { class: 'pt-label' }, 'Linkerstick'), ls.el, h('div', { class: 'pt-label' }, 'LT'), lt.el),
      h('div', { class: 'pt-btns' }, ...btns),
      h('div', { class: 'pt-col' }, h('div', { class: 'pt-label' }, 'Rechterstick'), rs.el, h('div', { class: 'pt-label' }, 'RT'), rt.el)),
    h('div', { class: 'osk-help' }, h('span', { class: 'hint' }, glyph('b'), glyph('b'), '2× snel drukken om te sluiten')));

  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    const p = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean);
    if (!p) return;
    name.textContent = p.id.replace(/\(.*?\)/g, '').trim() || 'Controller';
    btns.forEach((b, i) => b.classList.toggle('on', !!(p.buttons[i] && p.buttons[i].pressed)));
    const place = (s, x, y) => { s.dot.style.transform = `translate(${x * 38}px, ${y * 38}px)`; };
    place(ls, p.axes[0] || 0, p.axes[1] || 0);
    place(rs, p.axes[2] || 0, p.axes[3] || 0);
    lt.f.style.width = `${Math.round(((p.buttons[6] && p.buttons[6].value) || 0) * 100)}%`;
    rt.f.style.width = `${Math.round(((p.buttons[7] && p.buttons[7].value) || 0) * 100)}%`;
  };

  modal = UI.openModal(sheet, {
    onClose: () => { running = false; },
    onAction: (a) => {
      if (a === 'b') {
        const now = Date.now();
        if (now - lastB < 500) { Sounds.back(); UI.closeModal(modal); }
        lastB = now;
        return true;
      }
      if (a === 'a') Input.rumble(0.6, 0.8, 200);
      return true; // alle andere knoppen alleen tonen
    },
    focus: () => Focus.clear(),
  });
  requestAnimationFrame(loop);
}
