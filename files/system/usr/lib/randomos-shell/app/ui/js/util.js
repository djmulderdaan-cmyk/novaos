// Kleine hulpfuncties
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

function hashHue(str) {
  let x = 0;
  for (const c of str) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x % 360;
}

function relTime(ms) {
  if (!ms) return null;
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return 'Vandaag gespeeld';
  if (d === 1) return 'Gisteren gespeeld';
  if (d < 7) return `${d} dagen geleden`;
  if (d < 30) return `${Math.floor(d / 7)} ${Math.floor(d / 7) === 1 ? 'week' : 'weken'} geleden`;
  return new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function playtimeText(min) {
  if (!min) return null;
  if (min < 60) return `${min} min gespeeld`;
  const hrs = min / 60;
  return `${hrs < 10 ? hrs.toFixed(1).replace('.', ',') : Math.round(hrs)} uur gespeeld`;
}

const SOURCE_NAMES = { steam: 'Steam', epic: 'Epic', gog: 'GOG', amazon: 'Amazon', custom: 'Eigen' };

// Laadt het eerste plaatje dat werkt uit een lijst URLs
function loadArt(img, urls, onFail) {
  const list = (urls || []).slice();
  const next = () => {
    const u = list.shift();
    if (!u) { img.remove(); onFail && onFail(); return; }
    img.src = u;
  };
  img.onerror = next;
  img.onload = () => img.classList.add('loaded');
  next();
  return img;
}

function placeholder(game) {
  const hue = hashHue(game.title);
  return h('div', { class: 'placeholder', style: { background: `linear-gradient(160deg, hsl(${hue} 70% 46%), hsl(${(hue + 50) % 360} 70% 22%))` } },
    h('div', { class: 'src' }, SOURCE_NAMES[game.source] || ''), game.title);
}

function setAccent(hex) {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}

// Controllerknoppen als plaatje: Xbox (A B X Y) of PlayStation (✕ ○ □ △)
const GLYPHS = {
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', start: '☰', select: '⧉', guide: '⊙' },
  ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', start: 'OPT', select: 'SHR', guide: 'PS' },
};
function glyph(btn) {
  const style = document.body.dataset.pad === 'ps' ? 'ps' : 'xbox';
  const round = ['a', 'b', 'x', 'y'].includes(btn);
  return h('span', { class: `glyph g-${btn}${round ? ' round' : ''}` }, GLYPHS[style][btn]);
}
function refreshGlyphs() {
  const style = document.body.dataset.pad === 'ps' ? 'ps' : 'xbox';
  $$('.glyph').forEach((g) => {
    const b = [...g.classList].find((c) => c.startsWith('g-'));
    if (b) g.textContent = GLYPHS[style][b.slice(2)];
  });
}

function toast(text, { icon = 'check', bad = false, ms = 3200 } = {}) {
  const t = h('div', { class: `toast${bad ? ' bad' : ''}` }, h('span', { class: `ico ${icon}` }), h('span', {}, text));
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}

const ICONS = {
  wifi: (lvl) => `<svg width="20" height="16" viewBox="0 0 20 16"><path d="M10 15l2.2-2.7a3.4 3.4 0 0 0-4.4 0z" fill="currentColor" opacity="${lvl > 0 ? 1 : .3}"/><path d="M5.4 9.6a7 7 0 0 1 9.2 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" opacity="${lvl > 33 ? 1 : .3}"/><path d="M2.3 6.3a11.5 11.5 0 0 1 15.4 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" opacity="${lvl > 66 ? 1 : .3}"/></svg>`,
  bt: () => `<svg width="14" height="18" viewBox="0 0 14 18"><path d="M2 5l9 8-4.5 3.5v-15L11 5l-9 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  battery: (lvl, charging) => `<svg width="28" height="14" viewBox="0 0 28 14"><rect x="1" y="1" width="23" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/><rect x="25" y="4.5" width="2" height="5" rx="1" fill="currentColor" opacity=".7"/><rect x="3" y="3" width="${Math.max(1, 19 * lvl / 100)}" height="8" rx="1.5" fill="${lvl <= 15 && !charging ? '#ff7a8a' : charging ? '#6be3a4' : 'currentColor'}"/>${charging ? '<path d="M13.5 2.5l-3 5h3l-2 4.5 4.5-6h-3l1.5-3.5z" fill="#071028"/>' : ''}</svg>`,
};
