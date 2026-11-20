// Controller + toetsenbord -> acties: up/down/left/right, a, b, x, y, lb, rb, start, select, guide
const Input = (() => {
  const listeners = [];
  const interceptors = []; // krijgen invoer als eerste (bv. screensaver); true = opgegeten
  const emit = (action, extra = {}) => {
    for (const fn of interceptors) if (fn(action, extra)) return;
    listeners.forEach((fn) => fn(action, extra));
  };

  // ---- toetsenbord ----
  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'a', ' ': 'a', Escape: 'b', Backspace: 'b',
    q: 'lb', e: 'rb', PageUp: 'lb', PageDown: 'rb',
    y: 'y', x: 'x', f: 'x', m: 'start', Home: 'guide', Tab: 'select',
    '1': 'tab1', '2': 'tab2', '3': 'tab3', '/': 'search', h: 'help', '?': 'help', F1: 'help',
  };
  window.addEventListener('keydown', (ev) => {
    document.body.classList.remove('mouse');
    if (api.textMode && ev.key.length === 1 && !ev.ctrlKey && !ev.altKey) { emit('char', ev.key); ev.preventDefault(); return; }
    if (api.textMode && ev.key === 'Backspace') { emit('x'); ev.preventDefault(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') { ev.preventDefault(); emit('search', { source: 'keyboard' }); return; }
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    const k = KEYS[ev.key] || KEYS[ev.key.toLowerCase && ev.key.toLowerCase()];
    if (!k) { emit('any', { source: 'keyboard' }); return; }
    ev.preventDefault();
    emit(k, { repeat: ev.repeat, source: 'keyboard' });
  });
  window.addEventListener('mousemove', (e) => {
    if (e.movementX || e.movementY) { document.body.classList.add('mouse'); emit('any', { source: 'mouse' }); }
  });
  // rechtermuisknop en de "terug"-knop op de muis = terug
  window.addEventListener('contextmenu', (e) => { e.preventDefault(); emit('b', { source: 'mouse' }); });
  window.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); emit('b', { source: 'mouse' }); } });
  window.addEventListener('mousedown', () => { document.body.classList.add('mouse'); emit('any', { source: 'mouse' }); });

  // ---- gamepad ----
  const BTN = { 0: 'a', 1: 'b', 2: 'x', 3: 'y', 4: 'lb', 5: 'rb', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 16: 'guide' };
  const SPEEDS = { slow: [460, 150], normal: [380, 95], fast: [280, 60] };
  const DEAD = 0.5;
  const held = {};
  const prevPads = new Set();

  function padStyle(id) {
    if (/057e|nintendo|pro controller|joy-con/i.test(id)) return 'nintendo';
    return /054c|sony|dualsense|dualshock|wireless controller|playstation/i.test(id) ? 'ps' : 'xbox';
  }

  function press(action, now) {
    const s = held[action];
    // Home ingedrukt + andere knop = sneltoets (Home doet dan zelf niks bij loslaten)
    if (!s && action !== 'guide' && held.guide) {
      held.guide.used = true;
      held[action] = { since: now, last: now, combo: true };
      emit('combo', { btn: action, source: 'pad' });
      return;
    }
    if (!s) { held[action] = { since: now, last: now }; emit(action, { source: 'pad' }); return; }
    if (s.combo) return;
    const [delay, rate] = SPEEDS[api.speed] || SPEEDS.normal;
    const dir = ['up', 'down', 'left', 'right'].includes(action);
    if (dir && now - s.since > delay && now - s.last > rate) { s.last = now; emit(action, { repeat: true, source: 'pad' }); }
    if (action === 'guide' && !s.long && !s.used && now - s.since > 900) { s.long = true; emit('guide-long', { source: 'pad' }); }
  }

  function poll() {
    const now = performance.now();
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const active = new Set();

    const seen = new Set(pads.map((p) => p.id + p.index));
    for (const p of pads) if (!prevPads.has(p.id + p.index)) emit('connected', { id: p.id, style: padStyle(p.id) });
    for (const k of prevPads) if (!seen.has(k)) emit('disconnected', {});
    prevPads.clear(); seen.forEach((k) => prevPads.add(k));

    for (const p of pads) {
      p.buttons.forEach((b, i) => {
        if (!b.pressed) return;
        let idx = i;
        // sysSwap: de controller wisselt zelf al (InputPlumber), dan niet nog eens
        if (api.swapAB && !api.sysSwap && (i === 0 || i === 1)) idx = 1 - i;
        if (BTN[idx]) active.add(BTN[idx]);
      });
      const [x = 0, y = 0] = p.axes;
      if (x < -DEAD) active.add('left'); if (x > DEAD) active.add('right');
      if (y < -DEAD) active.add('up'); if (y > DEAD) active.add('down');
      if (active.size) { document.body.classList.remove('mouse'); api.lastStyle = padStyle(p.id); }
    }
    for (const a of active) press(a, now);
    for (const a of Object.keys(held)) {
      if (active.has(a)) continue;
      // Home kort ingedrukt (niet lang): apart signaal bij loslaten
      if (a === 'guide' && !held[a].long && !held[a].used) emit('guide-up', { source: 'pad' });
      delete held[a];
    }
    schedule();
  }
  // Tijdens een game: 8x per seconde in plaats van elke frame
  const schedule = () => (api.lowPower ? setTimeout(poll, 120) : requestAnimationFrame(poll));
  requestAnimationFrame(poll);

  function rumble(strong = 0.12, weak = 0.3, ms = 30) {
    if (!api.rumbleOn || !navigator.getGamepads) return;
    for (const p of navigator.getGamepads()) {
      if (p && p.vibrationActuator && p.vibrationActuator.playEffect) {
        p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
      }
    }
  }

  const api = {
    on: (fn) => listeners.push(fn),
    intercept: (fn) => interceptors.push(fn),
    rumble,
    padStyle,
    textMode: false,
    lastStyle: 'xbox',
    lowPower: false,
    swapAB: false,
    sysSwap: false,
    speed: 'normal',
    rumbleOn: true,
  };
  return api;
})();
