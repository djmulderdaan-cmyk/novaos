// Interface-geluiden, live gegenereerd (geen geluidsbestanden nodig)
const Sounds = (() => {
  let ctx = null, master = null, enabled = true, last = 0;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.32;
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

  function noise({ dur = 0.25, from = 400, to = 3000, vol = 0.15 } = {}) {
    const c = ac();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(from, c.currentTime);
    bp.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(); src.stop(c.currentTime + dur);
  }

  const play = {
    move() {
      const now = performance.now();
      if (now - last < 45) return; last = now;
      tone(1320 + Math.random() * 60, { dur: 0.045, vol: 0.18, type: 'triangle' });
    },
    select() { tone(740, { dur: 0.09, vol: 0.32 }); tone(1110, { t: 0.06, dur: 0.14, vol: 0.28 }); },
    back() { tone(880, { dur: 0.07, vol: 0.25 }); tone(587, { t: 0.05, dur: 0.12, vol: 0.22 }); },
    tab() { noise({ dur: 0.18, from: 900, to: 4200, vol: 0.08 }); tone(990, { dur: 0.06, vol: 0.14, type: 'triangle' }); },
    toggle(on) { tone(on ? 880 : 660, { dur: 0.06, vol: 0.25 }); tone(on ? 1320 : 440, { t: 0.05, dur: 0.08, vol: 0.2 }); },
    tick() { tone(1800, { dur: 0.025, vol: 0.12, type: 'triangle' }); },
    error() { tone(220, { dur: 0.16, vol: 0.3, type: 'square' }); tone(196, { t: 0.12, dur: 0.2, vol: 0.25, type: 'square' }); },
    open() { noise({ dur: 0.3, from: 300, to: 2400, vol: 0.08 }); tone(523, { dur: 0.12, vol: 0.18 }); tone(784, { t: 0.06, dur: 0.18, vol: 0.18 }); },
    launch() {
      noise({ dur: 0.9, from: 200, to: 5000, vol: 0.12 });
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, { t: i * 0.07, dur: 0.6, vol: 0.18, attack: 0.02 }));
    },
    boot() {
      // zacht akkoord dat opbouwt, met glinstering erbovenop
      [220, 277.2, 329.6, 415.3].forEach((f, i) => tone(f, { t: 0.05 * i, dur: 2.6, vol: 0.12, attack: 0.5, type: 'sine' }));
      [440, 554.4].forEach((f) => tone(f, { t: 0.2, dur: 2.2, vol: 0.06, attack: 0.6, type: 'triangle' }));
      [1318.5, 1661.2, 1975.5, 2637].forEach((f, i) => tone(f, { t: 0.55 + i * 0.09, dur: 0.9, vol: 0.05 }));
    },
  };

  return new Proxy(play, {
    get(target, name) {
      if (name === 'setEnabled') return (v) => { enabled = v; };
      if (name === 'unlock') return () => { try { ac(); } catch {} };
      const fn = target[name];
      return (...args) => { if (!enabled || !fn) return; try { fn(...args); } catch {} };
    },
  });
})();
