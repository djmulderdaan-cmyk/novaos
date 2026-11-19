// Controller + toetsenbord -> acties: up/down/left/right, a, b, x, y, lb, rb, start, select, guide
const Input = (() => {
  const listeners = [];
  const emit = (action, extra) => listeners.forEach((fn) => fn(action, extra));

  // ---- toetsenbord ----
  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'a', ' ': 'a', Escape: 'b', Backspace: 'b',
    q: 'lb', e: 'rb', PageUp: 'lb', PageDown: 'rb',
    y: 'y', x: 'x', m: 'start', F1: 'start', Home: 'guide', Tab: 'select',
  };
  window.addEventListener('keydown', (ev) => {
    document.body.classList.remove('mouse');
    if (Input.textMode && ev.key.length === 1 && !ev.ctrlKey && !ev.altKey) { emit('char', ev.key); ev.preventDefault(); return; }
    if (Input.textMode && ev.key === 'Backspace') { emit('x'); ev.preventDefault(); return; }
    const k = KEYS[ev.key] || KEYS[ev.key.toLowerCase && ev.key.toLowerCase()];
    if (!k) return;
    ev.preventDefault();
    emit(k, { repeat: ev.repeat, source: 'keyboard' });
  });
  window.addEventListener('mousemove', (e) => { if (e.movementX || e.movementY) document.body.classList.add('mouse'); });

  // ---- gamepad ----
  const BTN = { 0: 'a', 1: 'b', 2: 'x', 3: 'y', 4: 'lb', 5: 'rb', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 16: 'guide' };
  const REPEAT_DELAY = 380, REPEAT_RATE = 95, DEAD = 0.5;
  const held = {}; // action -> {since, last}
  const prevPads = new Set();

  function padStyle(id) {
    return /054c|sony|dualsense|dualshock|wireless controller|playstation/i.test(id) ? 'ps' : 'xbox';
  }

  function press(action, now) {
    const s = held[action];
    if (!s) { held[action] = { since: now, last: now }; emit(action, { source: 'pad' }); return; }
    const dir = ['up', 'down', 'left', 'right'].includes(action);
    if (dir && now - s.since > REPEAT_DELAY && now - s.last > REPEAT_RATE) { s.last = now; emit(action, { repeat: true, source: 'pad' }); }
    if (action === 'guide' && !s.long && now - s.since > 900) { s.long = true; emit('guide-long', { source: 'pad' }); }
  }

  function poll() {
    const now = performance.now();
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const active = new Set();

    const seen = new Set(pads.map((p) => p.id + p.index));
    for (const p of pads) if (!prevPads.has(p.id + p.index)) { emit('connected', { id: p.id, style: padStyle(p.id) }); }
    for (const k of prevPads) if (!seen.has(k)) emit('disconnected', {});
    prevPads.clear(); seen.forEach((k) => prevPads.add(k));

    for (const p of pads) {
      p.buttons.forEach((b, i) => { if (b.pressed && BTN[i]) active.add(BTN[i]); });
      const [x = 0, y = 0] = p.axes;
      if (x < -DEAD) active.add('left'); if (x > DEAD) active.add('right');
      if (y < -DEAD) active.add('up'); if (y > DEAD) active.add('down');
      if (active.size) { document.body.classList.remove('mouse'); Input.lastStyle = padStyle(p.id); }
    }
    for (const a of active) press(a, now);
    for (const a of Object.keys(held)) if (!active.has(a)) delete held[a];
    schedule();
  }
  // Tijdens een game: 8x per seconde in plaats van elke frame
  const schedule = () => (Input.lowPower ? setTimeout(poll, 120) : requestAnimationFrame(poll));
  requestAnimationFrame(poll);

  const Input = { on: (fn) => listeners.push(fn), textMode: false, lastStyle: 'xbox', lowPower: false };
  return Input;
})();
