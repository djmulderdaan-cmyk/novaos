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
  if (d <= 0) return t('Vandaag gespeeld');
  if (d === 1) return t('Gisteren gespeeld');
  if (d < 7) return t('{n} dagen geleden', { n: d });
  if (d < 30) return Math.floor(d / 7) === 1 ? t('1 week geleden') : t('{n} weken geleden', { n: Math.floor(d / 7) });
  return new Date(ms).toLocaleDateString(I18N.locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function playtimeText(min) {
  if (!min) return null;
  if (min < 60) return t('{n} min gespeeld', { n: min });
  const hrs = min / 60;
  const n = hrs < 10 ? hrs.toLocaleString(I18N.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(hrs);
  return t('{n} uur gespeeld', { n });
}

const SOURCE_NAMES = { steam: 'Steam', epic: 'Epic', gog: 'GOG', amazon: 'Amazon', modrinth: 'Modrinth', get custom() { return t('Eigen'); } };

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

// Minecraft-instance (Modrinth): grasblok + naam van de instance (+ eigen icoon als dat er is)
function minecraftCover(game) {
  const icon = game.art && game.art.icon && game.art.icon[0];
  return h('div', { class: 'mc-cover' },
    h('div', { class: 'mc-sky' }),
    h('img', { class: 'mc-block', src: 'img/grass-block.png', alt: '' }),
    icon ? h('img', { class: 'mc-icon', src: icon, alt: '' }) : null,
    h('div', { class: 'mc-text' }, h('div', { class: 'mc-sub' }, 'Minecraft'), h('div', { class: 'mc-name' }, game.title)));
}

function placeholder(game) {
  if (game.minecraft) return minecraftCover(game);
  const hue = hashHue(game.title);
  const icon = game.art && game.art.icon && game.art.icon[0];
  return h('div', { class: 'placeholder', style: { background: `linear-gradient(160deg, hsl(${hue} 70% 46%), hsl(${(hue + 50) % 360} 70% 22%))` } },
    icon ? h('img', { class: 'ph-icon', src: icon, alt: '' }) : null,
    h('div', { class: 'src' }, SOURCE_NAMES[game.source] || ''), game.title);
}

function setAccent(hex) {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}

// Controllerknoppen als plaatje. Toont het label van de FYSIEKE knop die je moet indrukken,
// dus klopt ook met Nintendo-layout en "A/B wisselen".
const FACE = {
  xbox: ['A', 'B', 'X', 'Y'],
  ps: ['✕', '○', '□', '△'],
  nintendo: ['B', 'A', 'Y', 'X'],
};
const OTHER = {
  xbox: { lb: 'LB', rb: 'RB', start: '☰', select: '⧉', guide: '⊙' },
  ps: { lb: 'L1', rb: 'R1', start: 'OPT', select: 'SHR', guide: 'PS' },
  nintendo: { lb: 'L', rb: 'R', start: '+', select: '−', guide: '⌂' },
};
const KEYCAPS = { a: 'Enter', b: 'Esc', x: 'F', y: 'Y', lb: 'Q', rb: 'E', start: 'M', select: 'Tab', guide: 'Home' };
function padStyleNow() { return ['ps', 'nintendo'].includes(document.body.dataset.pad) ? document.body.dataset.pad : 'xbox'; }
function paintGlyph(el) {
  const btn = el.dataset.btn;
  const style = padStyleNow();
  const faceIdx = { a: 0, b: 1, x: 2, y: 3 }[btn];
  el.className = 'glyph';
  if (document.body.dataset.input === 'kb' && KEYCAPS[btn]) {
    el.textContent = KEYCAPS[btn];
    el.classList.add('kc');
    return;
  }
  if (faceIdx !== undefined) {
    let idx = faceIdx;
    if (typeof Input !== 'undefined' && Input.swapAB && idx < 2) idx = 1 - idx;
    el.textContent = FACE[style][idx];
    el.classList.add('round', `g-p${idx}`);
  } else {
    el.textContent = OTHER[style][btn] || btn;
  }
}
function glyph(btn) {
  const el = h('span', { 'data-btn': btn });
  paintGlyph(el);
  return el;
}
function refreshGlyphs() { $$('[data-btn]').forEach(paintGlyph); }

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
