// Interface-geluiden. Meerdere "geluidspakketten", live gegenereerd (geen bestanden nodig),
// plus een pakket met je eigen geluidsbestanden.
const Sounds = (() => {
  let ctx = null, master = null, enabled = true, last = 0, volume = 0.7, style = 'soft';
  const custom = {}; // naam -> AudioBuffer

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.45 * volume;
      // zachte "ruimte" met een feedback-delay
      const delay = ctx.createDelay(); delay.delayTime.value = 0.13;
      const fb = ctx.createGain(); fb.gain.value = 0.22;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      master.connect(ctx.destination);
      master.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, { t = 0, dur = 0.08, type = 'sine', vol = 0.5, attack = 0.004, glide = 0 } = {}) {
    const c = ac();
    const start = c.currentTime + t;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(master);
    o.start(start); o.stop(start + dur + 0.05);
  }

  function noise({ t = 0, dur = 0.25, from = 400, to = 3000, vol = 0.15, type = 'bandpass', q = 1.4 } = {}) {
    const c = ac();
    const start = c.currentTime + t;
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, start);
    f.frequency.exponentialRampToValueAtTime(to, start + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.01, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(start); src.stop(start + dur);
  }

  function bell(freq, { t = 0, dur = 0.5, vol = 0.2 } = {}) {
    tone(freq, { t, dur, vol, attack: 0.002 });
    tone(freq * 2.76, { t, dur: dur * 0.5, vol: vol * 0.35, attack: 0.002 });
    tone(freq * 5.4, { t, dur: dur * 0.25, vol: vol * 0.12, attack: 0.002 });
  }

  const jitter = (f, amt = 0.04) => f * (1 + (Math.random() - 0.5) * amt);

  // ---------------------------------------------------------------- pakketten
  const PACKS = {
    soft: {
      move() { tone(jitter(1320), { dur: 0.045, vol: 0.18, type: 'triangle' }); },
      select() { tone(740, { dur: 0.09, vol: 0.32 }); tone(1110, { t: 0.06, dur: 0.14, vol: 0.28 }); },
      back() { tone(880, { dur: 0.07, vol: 0.25 }); tone(587, { t: 0.05, dur: 0.12, vol: 0.22 }); },
      tab() { noise({ dur: 0.18, from: 900, to: 4200, vol: 0.08 }); tone(990, { dur: 0.06, vol: 0.14, type: 'triangle' }); },
      tick() { tone(1800, { dur: 0.025, vol: 0.12, type: 'triangle' }); },
    },
    retro: {
      move() { tone(jitter(880, 0.02), { dur: 0.04, vol: 0.12, type: 'square' }); },
      select() { [523, 659, 784].forEach((f, i) => tone(f, { t: i * 0.045, dur: 0.06, vol: 0.12, type: 'square' })); },
      back() { [659, 523, 392].forEach((f, i) => tone(f, { t: i * 0.045, dur: 0.06, vol: 0.11, type: 'square' })); },
      tab() { tone(392, { dur: 0.05, vol: 0.1, type: 'square' }); tone(784, { t: 0.05, dur: 0.07, vol: 0.1, type: 'square' }); },
      tick() { tone(1568, { dur: 0.03, vol: 0.08, type: 'square' }); },
      toggle(on) { tone(on ? 784 : 392, { dur: 0.06, vol: 0.1, type: 'square' }); tone(on ? 1046 : 262, { t: 0.06, dur: 0.07, vol: 0.1, type: 'square' }); },
    },
    space: {
      move() { tone(jitter(1900), { dur: 0.07, vol: 0.13, glide: 0.62 }); },
      select() { tone(420, { dur: 0.22, vol: 0.2, glide: 3.6, type: 'triangle' }); tone(2400, { t: 0.14, dur: 0.18, vol: 0.06 }); },
      back() { tone(1500, { dur: 0.2, vol: 0.18, glide: 0.3, type: 'triangle' }); },
      tab() { noise({ dur: 0.35, from: 300, to: 6000, vol: 0.1, q: 4 }); tone(160, { dur: 0.3, vol: 0.15, glide: 1.6 }); },
      tick() { tone(2600, { dur: 0.03, vol: 0.07, glide: 0.8 }); },
    },
    bubble: {
      move() { tone(jitter(380, 0.1), { dur: 0.06, vol: 0.3, glide: 2.6 }); },
      select() { tone(420, { dur: 0.07, vol: 0.32, glide: 2.4 }); tone(640, { t: 0.07, dur: 0.08, vol: 0.3, glide: 2.4 }); },
      back() { tone(900, { dur: 0.09, vol: 0.28, glide: 0.4 }); },
      tab() { [300, 450, 620].forEach((f, i) => tone(f, { t: i * 0.05, dur: 0.06, vol: 0.22, glide: 2.2 })); },
      tick() { tone(jitter(700, 0.1), { dur: 0.04, vol: 0.18, glide: 2 }); },
    },
    crystal: {
      move() { bell(jitter(2093, 0.01), { dur: 0.35, vol: 0.09 }); },
      select() { bell(1568, { dur: 0.7, vol: 0.14 }); bell(2349, { t: 0.08, dur: 0.7, vol: 0.11 }); },
      back() { bell(1175, { dur: 0.5, vol: 0.12 }); },
      tab() { bell(1760, { dur: 0.5, vol: 0.08 }); bell(2637, { t: 0.06, dur: 0.5, vol: 0.06 }); },
      tick() { bell(3136, { dur: 0.15, vol: 0.05 }); },
    },
    click: {
      move() { noise({ dur: 0.025, from: 3500, to: 3000, vol: 0.35, type: 'highpass', q: 0.7 }); },
      select() { noise({ dur: 0.03, from: 2500, to: 2000, vol: 0.4, type: 'highpass', q: 0.7 }); tone(140, { dur: 0.08, vol: 0.35 }); },
      back() { noise({ dur: 0.03, from: 1800, to: 1500, vol: 0.3, type: 'highpass', q: 0.7 }); tone(110, { dur: 0.07, vol: 0.25 }); },
      tab() { noise({ dur: 0.04, from: 3000, to: 2500, vol: 0.3, type: 'highpass' }); noise({ t: 0.06, dur: 0.03, from: 3000, to: 2500, vol: 0.25, type: 'highpass' }); },
      tick() { noise({ dur: 0.015, from: 4500, to: 4000, vol: 0.25, type: 'highpass' }); },
    },
  };

  // Geluiden die voor elk pakket hetzelfde zijn (tenzij een pakket ze zelf heeft)
  const COMMON = {
    toggle(on) { tone(on ? 880 : 660, { dur: 0.06, vol: 0.25 }); tone(on ? 1320 : 440, { t: 0.05, dur: 0.08, vol: 0.2 }); },
    error() { tone(220, { dur: 0.16, vol: 0.3, type: 'square' }); tone(196, { t: 0.12, dur: 0.2, vol: 0.25, type: 'square' }); },
    open() { noise({ dur: 0.3, from: 300, to: 2400, vol: 0.08 }); tone(523, { dur: 0.12, vol: 0.18 }); tone(784, { t: 0.06, dur: 0.18, vol: 0.18 }); },
    launch() {
      noise({ dur: 0.9, from: 200, to: 5000, vol: 0.12 });
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, { t: i * 0.07, dur: 0.6, vol: 0.18, attack: 0.02 }));
    },
    boot() {
      [220, 277.2, 329.6, 415.3].forEach((f, i) => tone(f, { t: 0.05 * i, dur: 2.6, vol: 0.12, attack: 0.5 }));
      [440, 554.4].forEach((f) => tone(f, { t: 0.2, dur: 2.2, vol: 0.06, attack: 0.6, type: 'triangle' }));
      [1318.5, 1661.2, 1975.5, 2637].forEach((f, i) => tone(f, { t: 0.55 + i * 0.09, dur: 0.9, vol: 0.05 }));
    },
  };

  function playCustom(name) {
    const buf = custom[name];
    if (!buf) return false;
    const c = ac();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(master);
    src.start();
    return true;
  }

  function run(name, args, packName = style) {
    if (name === 'move') { const now = performance.now(); if (now - last < 45) return; last = now; }
    if (packName === 'custom' && playCustom(name)) return;
    const pack = PACKS[packName] || PACKS.soft;
    const fn = pack[name] || COMMON[name] || PACKS.soft[name];
    if (fn) fn(...args);
  }

  const api = {
    PACKS: Object.keys(PACKS),
    setEnabled(v) { enabled = v; },
    unlock() { try { ac(); } catch {} },
    setVolume(v) { volume = v; if (master) master.gain.value = 0.45 * v; },
    setStyle(v) { style = v; },
    // Laat een pakket horen, ook als geluiden uit staan (voor het kiezen)
    preview(packName, name = 'move') { try { last = 0; run(name, [], packName); } catch {} },
    // Eigen geluiden: { move: {mime, b64}, select: ..., ... }
    async loadCustom(files) {
      const c = ac();
      for (const k of Object.keys(custom)) delete custom[k];
      let n = 0;
      for (const [name, f] of Object.entries(files || {})) {
        try {
          const bytes = Uint8Array.from(atob(f.b64), (ch) => ch.charCodeAt(0));
          custom[name] = await c.decodeAudioData(bytes.buffer);
          n++;
        } catch {}
      }
      return n;
    },
    customNames: () => Object.keys(custom),
  };
  for (const name of ['move', 'select', 'back', 'tab', 'toggle', 'tick', 'error', 'open', 'launch', 'boot']) {
    api[name] = (...args) => { if (!enabled) return; try { run(name, args); } catch {} };
  }
  return api;
})();
