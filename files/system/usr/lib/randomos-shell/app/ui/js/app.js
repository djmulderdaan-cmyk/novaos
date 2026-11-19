// RandomOS Shell - interface
const nova = window.nova;

// Muis: alleen focus volgen als de muis echt beweegt (anders steelt een verborgen cursor de focus)
document.addEventListener('mouseover', (e) => {
  if (!document.body.classList.contains('mouse')) return;
  const el = e.target.closest('[data-focus]');
  const scope = (typeof UI !== 'undefined' && UI.top()) || document.getElementById('app');
  if (el && scope.contains(el)) Focus.set(el, { silent: true, scroll: false });
});

const S = {
  games: [],
  settings: {},
  tab: 'home',
  hero: null,
  filter: 'all',
  sort: 'recent',
  query: '',
  setCat: 'look',
  status: null,
  game: null,
  modals: [],
  introActive: false,
};

const ACCENTS = [
  ['#2aa8e8', 'Space-blauw'], ['#7fb8ff', 'IJsblauw'], ['#a78bfa', 'Paars'], ['#f472b6', 'Roze'], ['#fb7185', 'Rood'],
  ['#fb923c', 'Oranje'], ['#facc15', 'Geel'], ['#4ade80', 'Groen'], ['#2dd4bf', 'Turquoise'], ['#e2e8f0', 'Wit'],
];

// ================================================================ modals
const UI = {
  openModal(content, opts = {}) {
    const modal = h('div', { class: `modal ${opts.className || ''}` }, content);
    modal._opts = opts;
    modal._prevFocus = Focus.current;
    modal.addEventListener('click', (e) => { if (e.target === modal && !opts.sticky) { Sounds.back(); (opts.onBack || (() => UI.closeModal(modal)))(); } });
    $('#modals').append(modal);
    S.modals.push(modal);
    requestAnimationFrame(() => (opts.focus ? opts.focus() : Focus.first()));
    updateHints();
    return modal;
  },
  closeModal(modal) {
    const i = S.modals.indexOf(modal);
    if (i === -1) return;
    S.modals.splice(i, 1);
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 200);
    const prev = modal._prevFocus;
    if (prev && prev.isConnected && !prev.closest('.closing')) Focus.set(prev, { silent: true, scroll: false });
    else Focus.first();
    modal._opts.onClose && modal._opts.onClose();
    updateHints();
  },
  closeAll() { [...S.modals].reverse().forEach((m) => UI.closeModal(m)); },
  top() { return S.modals[S.modals.length - 1]; },
};
Focus.setScope(() => UI.top() || $('#app'));

// ================================================================ start
async function boot() {
  S.settings = await nova.settings.get();
  applySettings();
  refreshGlyphs();
  const introPromise = S.settings.intro ? playIntro() : Promise.resolve();
  await Promise.all([loadGames(), loadProfile(), refreshStatus()]);
  renderHome();
  renderLibrary();
  renderSettingsNav();
  switchTab('home', { silent: true });
  await introPromise;
  document.body.classList.add('ready');
  Focus.first('rail');
  updateHints();
  const st = await nova.games.state();
  if (st) onGameState(st);
  setInterval(refreshStatus, 10000);
  setInterval(updateClock, 5000);
  updateClock();
}

function applySettings() {
  setAccent(S.settings.accent);
  Ambient.color(S.settings.accent);
  Sounds.setEnabled(S.settings.sounds);
  document.body.classList.toggle('perf', !!S.settings.perf);
  if (S.settings.ambient && !S.settings.perf && !(S.game && S.game.phase === 'running')) Ambient.start(); else Ambient.stop();
}

// Slapen: zodra een game vooraan staat tekent de shell niks meer en pollt hij de controller zuinig
function setSleeping(on) {
  if (document.body.classList.contains('sleeping') === on) return;
  document.body.classList.toggle('sleeping', on);
  Input.lowPower = on;
  if (on) Ambient.stop(); else applySettings();
}
window.addEventListener('blur', () => { if (S.game && S.game.phase === 'running') setSleeping(true); });
window.addEventListener('focus', () => setSleeping(false));

async function saveSettings(patch) {
  S.settings = await nova.settings.set(patch);
  applySettings();
}

function playIntro() {
  return new Promise((resolve) => {
    S.introActive = true;
    const intro = $('#intro');
    const word = $('#introWord');
    word.innerHTML = '';
    'RandomOS'.split('').forEach((c, i) => word.append(h('span', { style: { animationDelay: `${900 + i * 60}ms` } }, c)));
    intro.classList.remove('done', 'play');
    void intro.offsetWidth;
    intro.classList.add('play');
    setTimeout(() => Sounds.boot(), 700);
    const finish = () => {
      if (!S.introActive) return;
      S.introActive = false;
      intro.classList.add('done');
      resolve();
    };
    S.skipIntro = finish;
    setTimeout(finish, 2900);
  });
}

async function loadGames() {
  const list = await nova.games.list();
  S.games = Array.isArray(list) ? list : [];
}

async function loadProfile() {
  const p = await nova.profile();
  if (!p || p.error) return;
  $('#profileName').textContent = p.name;
  const av = $('#avatar');
  if (p.avatar) { av.style.backgroundImage = `url("${p.avatar}")`; av.textContent = ''; }
  else { av.style.backgroundImage = ''; av.textContent = (p.name || '?').slice(0, 1).toUpperCase(); }
}

// ================================================================ status
function updateClock() {
  $('#clock').textContent = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

async function refreshStatus() {
  const s = await nova.sys.status();
  if (!s || s.error) return;
  S.status = s;
  const wifi = $('#stWifi');
  wifi.innerHTML = ICONS.wifi(s.wifi.enabled && s.wifi.ssid ? s.wifi.signal : 0);
  wifi.classList.toggle('off', !s.wifi.enabled || !s.wifi.ssid);
  wifi.style.display = s.wifi.available ? '' : 'none';
  const bt = $('#stBt');
  bt.innerHTML = ICONS.bt();
  bt.classList.toggle('off', !s.bluetooth.enabled);
  bt.style.display = s.bluetooth.available ? '' : 'none';
  const batt = $('#stBatt');
  if (s.battery) {
    batt.style.display = '';
    batt.innerHTML = `${ICONS.battery(s.battery.level, s.battery.status === 'Charging' || s.battery.status === 'Full')}<span>${s.battery.level}%</span>`;
  } else batt.style.display = 'none';
}

// ================================================================ tabs
const TABS = ['home', 'library', 'settings'];
function switchTab(name, { silent = false } = {}) {
  S.tab = name;
  document.body.dataset.tab = name;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  if (!silent) Sounds.tab();
  const group = { home: 'rail', library: 'grid', settings: 'setnav' }[name];
  requestAnimationFrame(() => Focus.first(group));
  if (name === 'home' && S.hero) setBackground(S.hero.art.hero);
  updateHints();
}
$$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// ================================================================ tegels
function tile(game, { group, onPress }) {
  const art = h('div', { class: 'art' });
  const img = h('img', { alt: '', loading: 'lazy', decoding: 'async' });
  art.append(img);
  loadArt(img, game.art.cover, () => art.append(placeholder(game)));
  const el = h('button', { class: 'tile', 'data-focus': true, 'data-group': group, 'data-id': game.id },
    art, h('div', { class: 'shine' }),
    game.favorite ? h('div', { class: 'fav' }, '★') : null,
    h('div', { class: 'label' }, game.title));
  el._game = game;
  el.addEventListener('click', () => onPress(game));
  return el;
}

function keepFocus(container, render) {
  const id = Focus.current && Focus.current.dataset.id;
  render();
  if (id) {
    const el = $(`[data-id="${CSS.escape(id)}"]`, container);
    if (el) Focus.set(el, { silent: true, scroll: false });
  }
}

// ================================================================ home
function homeGames() {
  return [...S.games]
    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.favorite - a.favorite) || a.title.localeCompare(b.title))
    .slice(0, 12);
}

function renderHome() {
  const rail = $('#homeRail');
  rail.innerHTML = '';
  const list = homeGames();
  $('#railTitle').textContent = list.some((g) => g.lastPlayed) ? 'Verder spelen' : 'Je games';
  if (!list.length) {
    $('#hero').style.visibility = 'hidden';
    rail.append(h('div', { class: 'empty' },
      h('img', { class: 'empty-mascot', src: 'img/mascot.png', alt: '' }),
      h('h3', {}, 'Nog geen games'),
      h('p', {}, 'Installeer games via Steam, of voeg Epic- en GOG-games toe met Heroic in de bureaubladmodus. Ze verschijnen hier vanzelf.'),
      h('button', { class: 'btn primary', 'data-focus': true, 'data-group': 'rail', onclick: () => nova.sys.openSteam() }, h('span', { class: 'ico steam' }), 'Steam openen')));
    return;
  }
  $('#hero').style.visibility = '';
  for (const g of list) {
    const t = tile(g, { group: 'rail', onPress: (game) => launch(game) });
    t.addEventListener('focusin-nova', () => setHeroDebounced(game(t)));
    rail.append(t);
  }
  const more = h('button', { class: 'tile wide', 'data-focus': true, 'data-group': 'rail', onclick: () => switchTab('library') },
    h('div', { class: 'more' }, h('span', { class: 'ico apps' }), h('span', {}, `Alle games`), h('span', { style: { color: 'var(--text-3)', fontSize: '.85rem' } }, `${S.games.length} geïnstalleerd`)));
  rail.append(more);
  if (!S.hero || !list.find((g) => g.id === S.hero.id)) setHero(list[0]);
}
const game = (el) => el._game;

let heroTimer = null;
function setHeroDebounced(g) { clearTimeout(heroTimer); heroTimer = setTimeout(() => setHero(g), 110); }

function setHero(g) {
  if (!g) return;
  const changed = !S.hero || S.hero.id !== g.id;
  S.hero = g;
  const logo = $('#heroLogo');
  if (changed) {
    logo.innerHTML = '';
    const img = h('img', { alt: g.title });
    const title = () => { logo.innerHTML = ''; logo.append(h('h1', {}, g.title)); };
    if (g.art.logo && g.art.logo.length) { logo.append(img); loadArt(img, g.art.logo, title); } else title();
    if (S.tab === 'home') setBackground(g.art.hero);
  }
  const meta = $('#heroMeta');
  meta.innerHTML = '';
  const bits = [h('span', { class: `badge ${g.source}` }, SOURCE_NAMES[g.source]), relTime(g.lastPlayed), playtimeText(g.playtime)].filter(Boolean);
  bits.forEach((b, i) => { if (i) meta.append(h('span', { class: 'sep' })); meta.append(b.nodeType ? b : h('span', {}, b)); });
  if (changed) { meta.style.animation = 'none'; void meta.offsetWidth; meta.style.animation = ''; }
  const fav = $('#favBtn');
  $('.ico', fav).classList.toggle('on', !!g.favorite);
  $('span:last-child', fav).textContent = g.favorite ? 'Favoriet' : 'Favoriet';
}

$('#playBtn').addEventListener('click', () => S.hero && launch(S.hero));
$('#favBtn').addEventListener('click', () => S.hero && toggleFavorite(S.hero));
$('#infoBtn').addEventListener('click', () => S.hero && openDetail(S.hero));

// achtergrond met overvloeien
let bgFront = 'bgA', bgToken = 0;
function firstLoadable(urls) {
  return new Promise((resolve) => {
    const list = [...(urls || [])];
    const next = () => {
      const u = list.shift();
      if (!u) return resolve(null);
      const i = new Image();
      i.onload = () => resolve(u);
      i.onerror = next;
      i.src = u;
    };
    next();
  });
}
async function setBackground(urls) {
  const token = ++bgToken;
  const url = await firstLoadable(urls);
  if (token !== bgToken) return;
  const front = $('#' + bgFront);
  const back = $('#' + (bgFront === 'bgA' ? 'bgB' : 'bgA'));
  back.style.backgroundImage = url ? `url("${url}")` : 'none';
  back.classList.remove('on'); void back.offsetWidth;
  if (url) back.classList.add('on');
  front.classList.remove('on');
  bgFront = back.id;
}

// ================================================================ bibliotheek
function libraryGames() {
  let list = S.games.filter((g) => S.filter === 'all' || (S.filter === 'fav' ? g.favorite : g.source === S.filter));
  if (S.query) { const q = S.query.toLowerCase(); list = list.filter((g) => g.title.toLowerCase().includes(q)); }
  return list.sort(S.sort === 'az' ? (a, b) => a.title.localeCompare(b.title) : (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || a.title.localeCompare(b.title));
}

function renderLibrary() {
  const chips = $('#chips');
  chips.innerHTML = '';
  const sources = ['steam', 'epic', 'gog', 'amazon', 'custom'].filter((s) => S.games.some((g) => g.source === s));
  const defs = [['all', 'Alle'], ['fav', 'Favorieten'], ...sources.map((s) => [s, SOURCE_NAMES[s]])];
  for (const [id, label] of defs) {
    const c = h('button', { class: `chip${S.filter === id ? ' on' : ''}`, 'data-focus': true, 'data-group': 'chips', 'data-id': `chip-${id}` }, label);
    c.addEventListener('click', () => { S.filter = id; Sounds.select(); keepFocus(chips, renderLibrary); });
    chips.append(c);
  }
  $('#sortLabel').textContent = S.sort === 'az' ? 'A–Z' : 'Recent';
  $('#searchLabel').textContent = S.query ? `“${S.query}”` : 'Zoeken';

  const grid = $('#libGrid');
  grid.innerHTML = '';
  const list = libraryGames();
  $('#libCount').textContent = list.length;
  if (!list.length) {
    grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1', margin: 0 } },
      h('h3', {}, S.query ? 'Niets gevonden' : 'Geen games in deze lijst'),
      h('p', {}, S.query ? `Geen game met “${S.query}” in de naam.` : S.filter === 'fav' ? 'Druk op X bij een game om hem favoriet te maken.' : 'Probeer een ander filter.')));
    return;
  }
  for (const g of list) grid.append(tile(g, { group: 'grid', onPress: openDetail }));
}

$('#sortBtn').addEventListener('click', () => { S.sort = S.sort === 'az' ? 'recent' : 'az'; Sounds.select(); keepFocus($('#screen-library'), renderLibrary); });
$('#searchBtn').addEventListener('click', async () => {
  Sounds.select();
  const q = await OSK.open({ title: 'Zoek in je bibliotheek', value: S.query, placeholder: 'Naam van de game' });
  if (q === null) return;
  S.query = q.trim();
  renderLibrary();
  Focus.first(S.query ? 'grid' : 'libtools');
});

async function toggleFavorite(g) {
  const favs = new Set(S.settings.favorites || []);
  favs.has(g.id) ? favs.delete(g.id) : favs.add(g.id);
  await saveSettings({ favorites: [...favs] });
  S.games.forEach((x) => { x.favorite = favs.has(x.id); });
  Sounds.toggle(favs.has(g.id));
  toast(favs.has(g.id) ? `${g.title} is nu favoriet` : `${g.title} is geen favoriet meer`, { icon: 'star' });
  rerenderAll();
}

function rerenderAll() {
  keepFocus($('#screen-home'), renderHome);
  if (S.hero) setHero(S.games.find((g) => g.id === S.hero.id) || S.hero);
  keepFocus($('#screen-library'), renderLibrary);
}

// ================================================================ game-details
function openDetail(g) {
  Sounds.open();
  const banner = h('div', { class: 'banner' });
  firstLoadable(g.art.hero.length ? g.art.hero : g.art.header).then((u) => { if (u) banner.style.backgroundImage = `url("${u}")`; });
  const cover = h('div', { class: 'd-cover' });
  const img = h('img', { alt: '' });
  cover.append(img);
  loadArt(img, g.art.cover, () => cover.append(placeholder(g)));
  const favBtn = h('button', { class: 'btn ghost', 'data-focus': true }, h('span', { class: `ico star${g.favorite ? ' on' : ''}` }), g.favorite ? 'Favoriet' : 'Favoriet maken');
  const stat = (k, v) => v ? h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v)) : null;
  const size = g.sizeBytes ? `${(g.sizeBytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB` : null;
  let modal;
  const sheet = h('div', { class: 'sheet detail' }, banner,
    h('div', { class: 'd-body' }, cover,
      h('div', { class: 'd-info' },
        h('span', { class: `badge ${g.source}` }, SOURCE_NAMES[g.source]),
        h('h2', { style: { marginTop: '10px' } }, g.title),
        h('div', { class: 'stats' }, stat('Laatst gespeeld', relTime(g.lastPlayed) || 'Nog nooit'), stat('Speeltijd', playtimeText(g.playtime) || '—'), stat('Grootte', size)),
        h('div', { class: 'd-actions' },
          h('button', { class: 'btn primary', 'data-focus': true, 'data-autofocus': true, onclick: () => { UI.closeModal(modal); launch(g); } }, h('span', { class: 'ico play' }), 'Spelen'),
          favBtn,
          h('button', { class: 'btn ghost', 'data-focus': true, onclick: () => { Sounds.back(); UI.closeModal(modal); } }, 'Sluiten')))));
  favBtn.addEventListener('click', async () => { await toggleFavorite(g); const now = S.games.find((x) => x.id === g.id); $('.ico', favBtn).classList.toggle('on', now.favorite); favBtn.lastChild.textContent = now.favorite ? 'Favoriet' : 'Favoriet maken'; });
  modal = UI.openModal(sheet);
}

// ================================================================ starten
let launchModal = null;
async function launch(g) {
  if (S.game) { Sounds.error(); toast(`${S.game.title} draait nog`, { icon: 'info', bad: true }); return; }
  Sounds.launch();
  showLaunch(g, 'launching');
  const r = await nova.games.launch(g);
  if (r && r.error) { closeLaunch(); Sounds.error(); toast(r.error, { bad: true, icon: 'info' }); }
}

function showLaunch(g, phase) {
  if (launchModal) closeLaunch();
  const cover = h('div', { class: 'launch-cover' });
  const img = h('img', { alt: '' });
  cover.append(img);
  loadArt(img, g.art.cover, () => cover.append(placeholder(g)));
  const status = h('p', { id: 'launchStatus' }, 'Wordt gestart…');
  const box = h('div', { class: 'launch-box' }, cover, h('h2', {}, g.title), status, h('div', { class: 'spinner', id: 'launchSpin' }),
    h('div', { class: 'launch-actions' },
      h('button', { class: 'btn ghost', 'data-focus': true, onclick: stopGame }, h('span', { class: 'ico stop' }), 'Stoppen')));
  launchModal = UI.openModal(box, { className: 'launch', sticky: true, onBack: () => {} });
  setBackground(g.art.hero);
  updateLaunch(phase);
}

function updateLaunch(phase) {
  const st = $('#launchStatus'), sp = $('#launchSpin');
  if (!st) return;
  st.textContent = phase === 'running' ? 'Speelt nu. Houd de Home-knop ingedrukt om te stoppen.' : 'Wordt gestart…';
  sp.style.display = phase === 'running' ? 'none' : '';
}

function closeLaunch() { if (launchModal) { UI.closeModal(launchModal); launchModal = null; } }

async function stopGame() {
  if (!S.game) return closeLaunch();
  Sounds.back();
  await nova.games.stop();
}

function onGameState(st) {
  if (st && st.phase) {
    const prev = S.game;
    S.game = st;
    const g = S.games.find((x) => x.id === st.id);
    if (!launchModal && g) showLaunch(g, st.phase); else updateLaunch(st.phase);
    if (st.phase === 'running') { Ambient.stop(); if (!document.hasFocus()) setSleeping(true); }
    if (!prev || prev.phase !== st.phase) updateHints();
    return;
  }
  const had = S.game;
  S.game = null;
  setSleeping(false);
  closeLaunch();
  applySettings();
  if (st && st.error) { Sounds.error(); toast(st.error, { bad: true, icon: 'info' }); }
  else if (had) { Sounds.open(); toast('Welkom terug', { icon: 'gamepad' }); }
  loadGames().then(rerenderAll);
}
nova.onGameState(onGameState);

// ================================================================ snelmenu
function sliderRow(title, value, onChange, { step = 5, min = 0, max = 100, group = 'qm' } = {}) {
  let v = value;
  const fill = h('div', { class: 'fill' }), knob = h('div', { class: 'knob' }), num = h('span', { class: 'num' });
  const track = h('div', { class: 'track' }, fill, knob);
  const paint = () => { const p = ((v - min) / (max - min)) * 100; fill.style.width = p + '%'; knob.style.left = p + '%'; num.textContent = `${v}%`; };
  let t = null;
  const commit = () => { clearTimeout(t); t = setTimeout(() => onChange(v), 90); };
  const row = h('div', { class: 'row', 'data-focus': true, 'data-slider': '', 'data-group': group },
    h('div', { class: 'r-main', style: { flex: '0 0 auto', minWidth: '7.5em' } }, h('div', { class: 'r-title' }, title)),
    h('div', { class: 'slider' }, track, num));
  row.addEventListener('adjust', (e) => { const nv = Math.max(min, Math.min(max, v + e.detail * step)); if (nv !== v) { v = nv; paint(); Sounds.tick(); commit(); } });
  track.addEventListener('click', (e) => { const r = track.getBoundingClientRect(); v = Math.round(((e.clientX - r.left) / r.width) * (max - min) / step) * step + min; v = Math.max(min, Math.min(max, v)); paint(); commit(); });
  paint();
  return row;
}

function toggleRow(title, desc, on, onChange, group) {
  let state = !!on;
  const tg = h('div', { class: `toggle${state ? ' on' : ''}` });
  const row = h('button', { class: 'row', 'data-focus': true, 'data-group': group },
    h('div', { class: 'r-main' }, h('div', { class: 'r-title' }, title), desc ? h('div', { class: 'r-desc' }, desc) : null), tg);
  row.addEventListener('click', async () => { state = !state; tg.classList.toggle('on', state); Sounds.toggle(state); await onChange(state); });
  return row;
}

function actionRow(title, desc, icon, onClick, group, value) {
  const row = h('button', { class: 'row', 'data-focus': true, 'data-group': group },
    icon ? h('span', { class: `ico ${icon}` }) : null,
    h('div', { class: 'r-main' }, h('div', { class: 'r-title' }, title), desc ? h('div', { class: 'r-desc' }, desc) : null),
    value != null ? (value.nodeType ? value : h('span', { class: 'r-val' }, value)) : null);
  row.addEventListener('click', () => { Sounds.select(); onClick(row); });
  return row;
}

async function openQuickMenu() {
  Sounds.open();
  const s = S.status || (await nova.sys.status());
  const now = new Date();
  const items = [
    h('div', { class: 'qm-time' }, now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })),
    h('div', { class: 'qm-date' }, now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })),
    h('div', { class: 'qm-cards' },
      h('div', { class: 'qm-card' }, h('div', { class: 'k' }, 'Batterij'), h('div', { class: 'v' }, s.battery ? `${s.battery.level}%${s.battery.status === 'Charging' ? ' · laadt' : ''}` : 'Netstroom')),
      h('div', { class: 'qm-card' }, h('div', { class: 'k' }, 'Wifi'), h('div', { class: 'v' }, s.wifi.enabled ? (s.wifi.ssid || 'Niet verbonden') : 'Uit'))),
  ];
  if (s.volume.available) items.push(sliderRow('Volume', s.volume.level, (v) => nova.sys.volume(v)));
  if (s.brightness.available) items.push(sliderRow('Helderheid', s.brightness.level, (v) => nova.sys.brightness(v), { min: 5 }));
  if (S.game) items.push(actionRow(`${S.game.title} stoppen`, 'Sluit de game die nu draait', 'stop', () => { UI.closeModal(modal); stopGame(); }, 'qm'));
  items.push(actionRow('Instellingen', null, 'apps', () => { UI.closeModal(modal); switchTab('settings'); }, 'qm'));
  items.push(actionRow('Aan/uit', null, 'power', () => { UI.closeModal(modal); openPower(); }, 'qm'));
  let modal;
  modal = UI.openModal(h('div', { class: 'sheet' }, ...items), { className: 'drawer', onAction: (a) => { if (a === 'y') { Sounds.back(); UI.closeModal(modal); return true; } return false; } });
}

// ================================================================ aan/uit
function openPower() {
  Sounds.open();
  let modal;
  const act = (a, msg) => () => { UI.closeModal(modal); if (msg) toast(msg, { icon: 'power' }); setTimeout(() => nova.sys.power(a), 400); };
  const list = h('div', { class: 'power-list' },
    actionRow('Slaapstand', null, 'moon', act('suspend'), 'power'),
    actionRow('Opnieuw opstarten', null, 'restart', act('reboot', 'Opnieuw opstarten…'), 'power'),
    actionRow('Uitzetten', null, 'power', act('poweroff', 'Uitzetten…'), 'power'),
    actionRow('Bureaubladmodus', 'Gewoon bureaublad met muis en toetsenbord', 'desktop', act('desktop', 'Naar bureaublad…'), 'power'),
    actionRow('Annuleren', null, null, () => { Sounds.back(); UI.closeModal(modal); }, 'power'));
  modal = UI.openModal(h('div', { class: 'sheet power-sheet' }, h('h2', {}, 'Aan/uit'), list), { focus: () => Focus.first('power') });
}

// ================================================================ instellingen
const CATS = [
  { id: 'look', name: 'Uiterlijk', icon: 'palette' },
  { id: 'wifi', name: 'Wifi', icon: 'wifi' },
  { id: 'bt', name: 'Bluetooth', icon: 'bt' },
  { id: 'sound', name: 'Geluid & scherm', icon: 'sound' },
  { id: 'games', name: 'Games', icon: 'gamepad' },
  { id: 'system', name: 'Systeem', icon: 'cpu' },
  { id: 'about', name: 'Over RandomOS', icon: 'sparkle' },
];

function renderSettingsNav() {
  const nav = $('#setNav');
  nav.innerHTML = '';
  for (const c of CATS) {
    const b = h('button', { class: `nav-item${S.setCat === c.id ? ' on' : ''}`, 'data-focus': true, 'data-group': 'setnav', 'data-id': `cat-${c.id}` }, h('span', { class: `ico ${c.icon}` }), c.name);
    let t;
    b.addEventListener('focusin-nova', () => { clearTimeout(t); t = setTimeout(() => openCat(c.id), 120); });
    b.addEventListener('click', () => { openCat(c.id); Focus.first('setpanel'); });
    nav.append(b);
  }
  renderCat();
}

function openCat(id) {
  if (S.setCat === id && $('#setPanel').childElementCount) return;
  S.setCat = id;
  $$('#setNav .nav-item').forEach((b) => b.classList.toggle('on', b.dataset.id === `cat-${id}`));
  Focus.forget('setpanel');
  renderCat();
}

function group(title, ...children) { return h('div', { class: 'set-group' }, title ? h('h3', {}, title) : null, ...children); }

async function renderCat() {
  const panel = $('#setPanel');
  const id = S.setCat;
  const P = 'setpanel';
  const out = [];
  const head = (t, sub) => { out.push(h('h2', {}, t)); if (sub) out.push(h('p', { class: 'sub' }, sub)); };

  if (id === 'look') {
    head('Uiterlijk', 'Maak RandomOS helemaal van jou.');
    const sw = h('div', { class: 'swatches' });
    for (const [hex, name] of ACCENTS) {
      const b = h('button', { class: `swatch${S.settings.accent === hex ? ' on' : ''}`, style: { '--c': hex }, title: name, 'data-focus': true, 'data-group': P });
      b.addEventListener('click', async () => { await saveSettings({ accent: hex }); Sounds.select(); $$('.swatch', sw).forEach((x) => x.classList.toggle('on', x === b)); toast(`Accentkleur: ${name}`, { icon: 'check' }); });
      sw.append(b);
    }
    out.push(group('Accentkleur', sw));
    out.push(group('Profiel', actionRow('Naam', 'Wordt rechtsboven getoond', null, async () => {
      const n = await OSK.open({ title: 'Hoe heet je?', value: S.settings.name || $('#profileName').textContent });
      if (n === null) return;
      await saveSettings({ name: n.trim() });
      await loadProfile();
      renderCat();
    }, P, S.settings.name || $('#profileName').textContent)));
    out.push(group('Effecten',
      toggleRow('Zwevende lichtjes', 'Rustige deeltjes op de achtergrond', S.settings.ambient, (v) => saveSettings({ ambient: v }), P),
      toggleRow('Opstartanimatie', 'Het RandomOS-logo bij het opstarten', S.settings.intro, (v) => saveSettings({ intro: v }), P),
      toggleRow('Geluidseffecten', 'Klikjes en tonen in de menu\'s', S.settings.sounds, (v) => saveSettings({ sounds: v }), P),
      toggleRow('Prestatiemodus', 'Minder effecten (geen vervaging, gloed of lichtjes). Handig op zwakkere laptops.', S.settings.perf, (v) => saveSettings({ perf: v }), P),
      actionRow('Opstartanimatie bekijken', null, 'sparkle', async () => { document.body.classList.remove('ready'); await playIntro(); document.body.classList.add('ready'); }, P)));
  }

  if (id === 'wifi') {
    head('Wifi');
    const s = S.status || (await nova.sys.status());
    const list = h('div', {}, h('div', { class: 'row static' }, h('div', { class: 'spinner', style: { width: '22px', height: '22px', borderWidth: '3px' } }), h('div', { class: 'r-main' }, 'Netwerken zoeken…')));
    out.push(group(null, toggleRow('Wifi', s.wifi.ssid ? `Verbonden met ${s.wifi.ssid}` : 'Niet verbonden', s.wifi.enabled, async (v) => { await nova.sys.wifiRadio(v); await refreshStatus(); renderCat(); }, P)));
    if (s.wifi.enabled) {
      out.push(group('Netwerken', list));
      nova.sys.wifiList().then((nets) => {
        if (S.setCat !== 'wifi') return;
        list.innerHTML = '';
        if (!Array.isArray(nets) || !nets.length) { list.append(h('div', { class: 'row static' }, 'Geen netwerken gevonden')); return; }
        for (const n of nets) {
          const bars = h('span', { class: 'bars' }, ...[25, 50, 75].map((t, i) => h('i', { class: n.signal > t - 10 ? 'on' : '', style: { height: `${6 + i * 5}px` } })));
          const val = h('span', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, n.active ? h('span', { class: 'ok' }, 'Verbonden') : null, n.secure ? h('span', { class: 'ico lock', style: { width: '16px', height: '16px' } }) : null, bars);
          list.append(actionRow(n.ssid, n.known && !n.active ? 'Opgeslagen' : null, null, async () => {
            if (n.active) return;
            let pw = null;
            if (n.secure && !n.known) { pw = await OSK.open({ title: `Wachtwoord voor ${n.ssid}`, password: true }); if (pw === null) return; }
            toast(`Verbinden met ${n.ssid}…`, { icon: 'refresh' });
            const r = await nova.sys.wifiConnect(n.ssid, pw);
            if (r && r.ok) { toast(`Verbonden met ${n.ssid}`); await refreshStatus(); renderCat(); } else { Sounds.error(); toast((r && r.error) || 'Verbinden mislukt', { bad: true, icon: 'info' }); }
          }, P, val));
        }
      });
      out.push(actionRow('Opnieuw zoeken', null, 'refresh', () => renderCat(), P));
    }
  }

  if (id === 'bt') {
    head('Bluetooth', 'Koppel draadloze controllers, koptelefoons en speakers.');
    const s = S.status || (await nova.sys.status());
    out.push(group(null, toggleRow('Bluetooth', null, s.bluetooth.enabled, async (v) => { await nova.sys.btPower(v); await refreshStatus(); renderCat(); }, P)));
    if (s.bluetooth.enabled) {
      const list = h('div', {});
      const fill = (devs) => {
        list.innerHTML = '';
        if (!Array.isArray(devs) || !devs.length) { list.append(h('div', { class: 'row static' }, 'Nog geen apparaten. Zet je apparaat in koppelmodus en kies "Zoeken".')); return; }
        for (const d of devs) {
          list.append(actionRow(d.name, d.connected ? 'Verbonden' : d.paired ? 'Gekoppeld' : 'Nieuw apparaat', 'bt', async () => {
            if (d.connected) { await nova.sys.btDisconnect(d.mac); toast(`${d.name} losgekoppeld`); }
            else { toast(`Verbinden met ${d.name}…`, { icon: 'refresh' }); const r = await nova.sys.btConnect(d.mac); r && r.ok ? toast(`${d.name} verbonden`) : toast((r && r.error) || 'Mislukt', { bad: true, icon: 'info' }); }
            fill(await nova.sys.btDevices());
          }, P, d.connected ? h('span', { class: 'ok' }, 'Verbonden') : null));
        }
      };
      out.push(group('Apparaten', list));
      out.push(actionRow('Zoeken naar apparaten', 'Duurt ongeveer 8 seconden', 'refresh', async (row) => {
        $('.r-title', row).textContent = 'Zoeken…';
        fill(await nova.sys.btScan());
        $('.r-title', row).textContent = 'Zoeken naar apparaten';
      }, P));
      nova.sys.btDevices().then((d) => S.setCat === 'bt' && fill(d));
    }
  }

  if (id === 'sound') {
    head('Geluid & scherm');
    const s = await nova.sys.status();
    if (s.volume.available) out.push(group('Geluid',
      sliderRow('Volume', s.volume.level, (v) => nova.sys.volume(v), { group: P }),
      toggleRow('Dempen', null, s.volume.muted, () => nova.sys.mute(), P)));
    if (s.brightness.available) out.push(group('Scherm', sliderRow('Helderheid', s.brightness.level, (v) => nova.sys.brightness(v), { min: 5, group: P })));
    if (!s.volume.available && !s.brightness.available) out.push(h('p', { class: 'sub' }, 'Geen geluid of scherm gevonden om te regelen.'));
  }

  if (id === 'games') {
    head('Games', `${S.games.length} games gevonden.`);
    const counts = ['steam', 'epic', 'gog', 'amazon', 'custom'].map((s) => [s, S.games.filter((g) => g.source === s).length]).filter(([, n]) => n);
    out.push(group('Bronnen', ...counts.map(([s, n]) => h('div', { class: 'row static' }, h('span', { class: `badge ${s}` }, SOURCE_NAMES[s]), h('div', { class: 'r-main' }), h('span', { class: 'r-val' }, `${n} ${n === 1 ? 'game' : 'games'}`)))));
    out.push(group('Acties',
      actionRow('Bibliotheek vernieuwen', 'Zoek opnieuw naar geïnstalleerde games', 'refresh', async () => { await loadGames(); rerenderAll(); renderCat(); toast(`${S.games.length} games gevonden`); }, P),
      actionRow('Steam Big Picture openen', 'Winkel, downloads en Steam-instellingen', 'steam', () => nova.sys.openSteam(), P)));
    out.push(group('Eigen games toevoegen', h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.6, color: 'var(--text-2)' } },
      'Ga naar de bureaubladmodus en zet je games in ', h('b', { style: { color: 'var(--text)' } }, '~/.config/randomos/games.json'), '. Epic-, GOG- en Amazon-games uit Heroic verschijnen vanzelf.')));
  }

  if (id === 'system') {
    head('Systeem');
    const i = await nova.sys.info();
    const dl = h('dl', { class: 'info-grid' });
    for (const [k, v] of [['Systeem', i.os], ['Processor', i.cpu], ['Graphics', (i.gpu || []).join(', ')], ['Geheugen', i.ram], ['Opslag', i.disk], ['Kernel', i.kernel], ['Image', i.image]]) {
      if (v) dl.append(h('dt', {}, k), h('dd', {}, v));
    }
    out.push(group('Over dit apparaat', dl));
    out.push(group('Geavanceerd',
      actionRow('Bureaubladmodus', 'Schakel naar het gewone bureaublad', 'desktop', () => nova.sys.power('desktop'), P),
      actionRow('Gewone Steam-interface gebruiken', 'Start Game Mode voortaan zonder RandomOS Shell. Terug via het bureaublad.', 'steam', async () => {
        const ok = await confirmBox('Steam-interface gebruiken?', 'Game Mode start dan met de gewone Steam-interface. Je kunt terug via "RandomOS Shell weer gebruiken" in de bureaubladmodus.', 'Overschakelen');
        if (ok) nova.sys.power('steam-ui');
      }, P),
      actionRow('RandomOS Shell herstarten', null, 'restart', () => nova.sys.power('restart-shell'), P)));
  }

  if (id === 'about') {
    head('Over RandomOS');
    out.push(h('div', { class: 'row static', style: { display: 'flex', gap: '24px', alignItems: 'center', padding: '10px 4px 26px' } },
      h('img', { class: 'about-mascot', src: 'img/mascot.png', alt: '' }),
      h('div', {}, h('div', { class: 'display', style: { fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em' } }, 'RandomOS'), h('div', { style: { color: 'var(--text-2)', marginTop: '4px' } }, 'RandomOS Shell 1.0'))));
    out.push(group(null, h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.7, color: 'var(--text-2)' } },
      'Een eigen console-OS, gebouwd op Bazzite en Fedora Linux. Games draaien via Steam en Proton; updates komen elke dag automatisch binnen.')));
    out.push(group('Bediening', h('div', { class: 'row static', style: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '12px 18px', alignItems: 'center' } },
      glyph('a'), 'Kiezen / spelen', glyph('b'), 'Terug', glyph('x'), 'Favoriet maken', glyph('y'), 'Snelmenu',
      h('span', { style: { display: 'flex', gap: '4px' } }, glyph('lb'), glyph('rb')), 'Tabblad wisselen',
      glyph('start'), 'Aan/uit-menu', glyph('guide'), 'Naar Home (ingedrukt houden tijdens een game: game stoppen)')));
  }

  if (S.setCat !== id) return;
  panel.innerHTML = '';
  panel.append(...out);
  panel.scrollTop = 0;
  if (Focus.current && Focus.current.dataset.group === P && !Focus.current.isConnected) Focus.first(P);
  updateHints();
}

function confirmBox(title, text, okLabel) {
  return new Promise((resolve) => {
    let modal;
    const done = (v) => { UI.closeModal(modal); resolve(v); };
    modal = UI.openModal(h('div', { class: 'sheet power-sheet', style: { maxWidth: '560px' } },
      h('h2', {}, title), h('p', { style: { color: 'var(--text-2)', lineHeight: 1.6, margin: '0 6px 24px' } }, text),
      h('div', { style: { display: 'flex', gap: '12px' } },
        h('button', { class: 'btn primary', 'data-focus': true, onclick: () => done(true) }, okLabel),
        h('button', { class: 'btn ghost', 'data-focus': true, 'data-autofocus': true, onclick: () => done(false) }, 'Annuleren'))),
    { onBack: () => done(false) });
  });
}

// ================================================================ hints
function updateHints() {
  const el = $('#hints');
  el.innerHTML = '';
  const add = (b, t) => el.append(h('span', { class: 'hint' }, ...(Array.isArray(b) ? b.map(glyph) : [glyph(b)]), t));
  const top = UI.top();
  const cur = Focus.current;
  if (top && top._opts.className === 'launch') { add('a', 'Kiezen'); add('guide', 'Ingedrukt: game stoppen'); return; }
  if (top) {
    if (cur && cur.dataset.slider !== undefined) el.append(h('span', { class: 'hint' }, h('span', { class: 'glyph' }, '◀ ▶'), 'Aanpassen'));
    add('a', 'Kiezen'); add('b', 'Terug'); return;
  }
  if (cur && cur.dataset.slider !== undefined) el.append(h('span', { class: 'hint' }, h('span', { class: 'glyph' }, '◀ ▶'), 'Aanpassen'));
  const onTile = cur && cur.classList.contains('tile') && cur._game;
  if (S.tab === 'home' && onTile) add('a', 'Spelen');
  else if (S.tab === 'library' && onTile) add('a', 'Openen');
  else add('a', 'Kiezen');
  if (onTile) add('x', 'Favoriet');
  if (S.tab !== 'home') add('b', 'Terug');
  add('y', 'Snelmenu');
  add('start', 'Aan/uit');
}
document.addEventListener('focusin-nova', () => updateHints());

// ================================================================ invoer
Input.on((a, extra = {}) => {
  if (a === 'connected') { document.body.dataset.pad = extra.style; refreshGlyphs(); updateHints(); toast(`Controller verbonden`, { icon: 'gamepad' }); return; }
  if (a === 'disconnected') { toast('Controller losgekoppeld', { icon: 'gamepad', bad: true }); return; }
  Sounds.unlock();
  if (Input.lastStyle && extra.source === 'pad' && document.body.dataset.pad !== Input.lastStyle) { document.body.dataset.pad = Input.lastStyle; refreshGlyphs(); }

  // Tijdens een game staat de shell op de achtergrond: alleen "Home ingedrukt houden" doet iets
  if (S.game && S.game.phase === 'running' && !document.hasFocus()) {
    if (a === 'guide-long') stopGame();
    return;
  }
  if (S.introActive) { if (S.skipIntro) S.skipIntro(); return; }
  if (a === 'guide-long') { if (S.game) stopGame(); return; }

  const top = UI.top();
  if (top && top._opts.onAction && top._opts.onAction(a, extra)) return;

  switch (a) {
    case 'up': case 'down': case 'left': case 'right':
      if (!Focus.move(a) && (a === 'up') && !top && Focus.current && Focus.current.dataset.group !== 'tabs') {
        Focus.set($(`.tab[data-tab="${S.tab}"]`));
      }
      return;
    case 'a':
      if (Focus.current) Focus.current.click();
      return;
    case 'b':
      if (top) { Sounds.back(); (top._opts.onBack || (() => UI.closeModal(top)))(); return; }
      goBack();
      return;
    case 'lb': case 'rb': {
      if (top) return;
      const i = TABS.indexOf(S.tab);
      const next = TABS[(i + (a === 'rb' ? 1 : -1) + TABS.length) % TABS.length];
      switchTab(next);
      return;
    }
    case 'x': {
      const cur = Focus.current;
      if (!top && cur && cur._game) toggleFavorite(cur._game);
      return;
    }
    case 'y':
      if (!top) openQuickMenu();
      return;
    case 'start':
      if (!top) openPower();
      return;
    case 'guide':
      UI.closeAll();
      if (S.tab !== 'home') switchTab('home'); else Focus.first('rail');
      return;
  }
});

function goBack() {
  const cur = Focus.current;
  if (S.tab === 'settings' && cur && cur.dataset.group === 'setpanel') { Sounds.back(); Focus.set($(`#setNav [data-id="cat-${S.setCat}"]`), { silent: true }); return; }
  if (S.tab !== 'home') { Sounds.back(); switchTab('home'); return; }
  if (cur && cur.dataset.group !== 'rail') { Sounds.back(); Focus.first('rail'); }
}

boot();
