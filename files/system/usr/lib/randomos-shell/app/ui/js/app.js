// RandomOS Shell - interface
// "nova" is de systeemkoppeling (Electron: via preload, demo: via mock.js)

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
  // Intro meteen starten (niet eerst op de instellingen wachten); staat hij uit, dan slaan we hem direct over
  let introPromise = playIntro();
  S.settings = await nova.settings.get();
  if (!S.settings.intro && S.skipIntro) { S.skipIntro(); introPromise = Promise.resolve(); }
  applySettings();
  applyStaticI18n();
  refreshGlyphs();
  loadCustomSounds();
  await Promise.all([loadGames(), loadProfile(), refreshStatus()]);
  renderHome();
  renderLibrary();
  renderSettingsNav();
  S.booted = true;
  const startTab = S.settings.startTab === 'library' ? 'library' : 'home';
  switchTab(startTab, { silent: true });
  updateGreeting();
  await introPromise;
  document.body.classList.add('ready');
  Focus.first(startTab === 'library' ? 'grid' : 'rail');
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
  applyLook();
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

async function loadCustomSounds() {
  const r = await nova.customSounds();
  S.customSoundDir = (r && r.dir) || '~/.config/randomos/sounds';
  S.customSoundCount = r && r.sounds ? await Sounds.loadCustom(r.sounds) : 0;
  return S.customSoundCount;
}

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
  const d = new Date();
  const time = d.toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit', hour12: !!S.settings.clock12 });
  const date = S.settings.showDate ? d.toLocaleDateString(I18N.locale, { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' : '';
  $('#clock').textContent = date + time;
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
    batt.innerHTML = `${ICONS.battery(s.battery.level, s.battery.status === 'Charging' || s.battery.status === 'Full')}${S.settings.battPct !== false ? `<span>${s.battery.level}%</span>` : ''}`;
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
  if (name === 'home') updateGreeting();
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
const isHidden = (g) => (S.settings.hidden || []).includes(g.id);
function homeGames() {
  const favFirst = S.settings.homeRow === 'favorites';
  return S.games.filter((g) => !isHidden(g))
    .sort((a, b) => (favFirst ? b.favorite - a.favorite : 0) || (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.favorite - a.favorite) || a.title.localeCompare(b.title))
    .slice(0, 12);
}

function renderHome() {
  const rail = $('#homeRail');
  rail.innerHTML = '';
  const list = homeGames();
  $('#railTitle').textContent = S.settings.homeRow === 'favorites' && list.some((g) => g.favorite) ? t('Favorieten') : list.some((g) => g.lastPlayed) ? t('Verder spelen') : t('Je games');
  if (!list.length) {
    $('#hero').style.visibility = 'hidden';
    rail.append(h('div', { class: 'empty' },
      h('img', { class: 'empty-mascot', src: 'img/mascot.png', alt: '' }),
      h('h3', {}, S.steamLoggedIn === false ? t('Log in bij Steam') : t('Nog geen games')),
      h('p', {}, S.steamLoggedIn === false
        ? t('Log één keer in bij Steam om je games te zien. Na het inloggen kom je vanzelf terug in RandomOS.')
        : t('Installeer games via Steam, of voeg Epic- en GOG-games toe met Heroic in de bureaubladmodus. Ze verschijnen hier vanzelf.')),
      S.steamLoggedIn === false
        ? h('button', { class: 'btn primary', 'data-focus': true, 'data-group': 'rail', onclick: () => steamLogin() }, h('span', { class: 'ico steam' }), t('Inloggen bij Steam'))
        : h('button', { class: 'btn primary', 'data-focus': true, 'data-group': 'rail', onclick: () => openSteamFront() }, h('span', { class: 'ico steam' }), t('Steam openen'))));
    return;
  }
  $('#hero').style.visibility = '';
  for (const g of list) {
    const t = tile(g, { group: 'rail', onPress: (game) => launch(game) });
    t.addEventListener('focusin-nova', () => setHeroDebounced(game(t)));
    rail.append(t);
  }
  const more = h('button', { class: 'tile wide', 'data-focus': true, 'data-group': 'rail', onclick: () => switchTab('library') },
    h('div', { class: 'more' }, h('span', { class: 'ico apps' }), h('span', {}, t('Alle games')), h('span', { style: { color: 'var(--text-3)', fontSize: '.85rem' } }, t('{n} geïnstalleerd', { n: S.games.length }))));
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
  $('span:last-child', fav).textContent = t('Favoriet');
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
  let list = S.games.filter((g) => !isHidden(g)).filter((g) => S.filter === 'all' || (S.filter === 'fav' ? g.favorite : g.source === S.filter));
  if (S.query) { const q = S.query.toLowerCase(); list = list.filter((g) => g.title.toLowerCase().includes(q)); }
  return list.sort(S.sort === 'az' ? (a, b) => a.title.localeCompare(b.title) : (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || a.title.localeCompare(b.title));
}

function renderLibrary() {
  const chips = $('#chips');
  chips.innerHTML = '';
  const sources = ['steam', 'epic', 'gog', 'amazon', 'custom'].filter((s) => S.games.some((g) => g.source === s));
  const defs = [['all', t('Alle')], ['fav', t('Favorieten')], ...sources.map((s) => [s, SOURCE_NAMES[s]])];
  for (const [id, label] of defs) {
    const c = h('button', { class: `chip${S.filter === id ? ' on' : ''}`, 'data-focus': true, 'data-group': 'chips', 'data-id': `chip-${id}` }, label);
    c.addEventListener('click', () => { S.filter = id; Sounds.select(); keepFocus(chips, renderLibrary); });
    chips.append(c);
  }
  $('#sortLabel').textContent = S.sort === 'az' ? 'A–Z' : t('Recent');
  $('#searchLabel').textContent = S.query ? `“${S.query}”` : t('Zoeken');

  const grid = $('#libGrid');
  grid.innerHTML = '';
  const list = libraryGames();
  $('#libCount').textContent = list.length;
  if (!list.length) {
    grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1', margin: 0 } },
      h('h3', {}, S.query ? t('Niets gevonden') : t('Geen games in deze lijst')),
      h('p', {}, S.query ? t('Geen game met “{q}” in de naam.', { q: S.query }) : S.filter === 'fav' ? t('Druk op X bij een game om hem favoriet te maken.') : t('Probeer een ander filter.'))));
    return;
  }
  for (const g of list) grid.append(tile(g, { group: 'grid', onPress: openDetail }));
}

$('#sortBtn').addEventListener('click', () => { S.sort = S.sort === 'az' ? 'recent' : 'az'; Sounds.select(); keepFocus($('#screen-library'), renderLibrary); });
$('#searchBtn').addEventListener('click', async () => {
  Sounds.select();
  const q = await OSK.open({ title: t('Zoek in je bibliotheek'), value: S.query, placeholder: t('Naam van de game') });
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
  toast(favs.has(g.id) ? t('{title} is nu favoriet', { title: g.title }) : t('{title} is geen favoriet meer', { title: g.title }), { icon: 'star' });
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
  const favBtn = h('button', { class: 'btn ghost', 'data-focus': true }, h('span', { class: `ico star${g.favorite ? ' on' : ''}` }), g.favorite ? t('Favoriet') : t('Favoriet maken'));
  const stat = (k, v) => v ? h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v)) : null;
  const size = g.sizeBytes ? `${(g.sizeBytes / 1024 ** 3).toLocaleString(I18N.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB` : null;
  let modal;
  const sheet = h('div', { class: 'sheet detail' }, banner,
    h('div', { class: 'd-body' }, cover,
      h('div', { class: 'd-info' },
        h('span', { class: `badge ${g.source}` }, SOURCE_NAMES[g.source]),
        h('h2', { style: { marginTop: '10px' } }, g.title),
        h('div', { class: 'stats' }, stat(t('Laatst gespeeld'), relTime(g.lastPlayed) || t('Nog nooit')), stat(t('Speeltijd'), playtimeText(g.playtime) || '—'), stat(t('Grootte'), size)),
        h('div', { class: 'd-actions' },
          h('button', { class: 'btn primary', 'data-focus': true, 'data-autofocus': true, onclick: () => { UI.closeModal(modal); launch(g); } }, h('span', { class: 'ico play' }), t('Spelen')),
          favBtn,
          h('button', { class: 'btn ghost', 'data-focus': true, onclick: async () => { UI.closeModal(modal); await toggleHidden(g); } }, isHidden(g) ? t('Weer tonen') : t('Verbergen')),
          h('button', { class: 'btn ghost', 'data-focus': true, onclick: () => { Sounds.back(); UI.closeModal(modal); } }, t('Sluiten'))))));
  favBtn.addEventListener('click', async () => { await toggleFavorite(g); const now = S.games.find((x) => x.id === g.id); $('.ico', favBtn).classList.toggle('on', now.favorite); favBtn.lastChild.textContent = now.favorite ? t('Favoriet') : t('Favoriet maken'); });
  modal = UI.openModal(sheet);
}

// ================================================================ starten
let launchModal = null;
async function launch(g) {
  if (S.game) { Sounds.error(); toast(t('{title} draait nog', { title: S.game.title }), { icon: 'info', bad: true }); return; }
  Sounds.launch();
  Input.rumble(0.5, 0.7, 220);
  showLaunch(g, 'launching');
  const r = await nova.games.launch(g);
  if (r && r.error) { closeLaunch(); Sounds.error(); toast(tErr(r.error), { bad: true, icon: 'info' }); }
}

function showLaunch(g, phase) {
  if (launchModal) closeLaunch();
  const cover = h('div', { class: 'launch-cover' });
  const img = h('img', { alt: '' });
  cover.append(img);
  loadArt(img, g.art.cover, () => cover.append(placeholder(g)));
  const status = h('p', { id: 'launchStatus' }, t('Wordt gestart…'));
  const box = h('div', { class: 'launch-box' }, cover, h('h2', {}, g.title), status, h('div', { class: 'spinner', id: 'launchSpin' }),
    h('div', { class: 'launch-actions' },
      h('button', { class: 'btn ghost', 'data-focus': true, onclick: stopGame }, h('span', { class: 'ico stop' }), t('Stoppen'))));
  launchModal = UI.openModal(box, { className: 'launch', sticky: true, onBack: () => {} });
  setBackground(g.art.hero);
  updateLaunch(phase);
}

function updateLaunch(phase) {
  const st = $('#launchStatus'), sp = $('#launchSpin');
  if (!st) return;
  st.textContent = phase === 'running' ? t('Speelt nu. Houd de Home-knop ingedrukt om te stoppen.') : t('Wordt gestart…');
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
  if (st && st.error) { Sounds.error(); toast(tErr(st.error), { bad: true, icon: 'info' }); }
  else if (had) { Sounds.open(); toast(t('Welkom terug'), { icon: 'gamepad' }); }
  loadGames().then(rerenderAll);
}
nova.onGameState(onGameState);

// ================================================================ snelmenu
async function openQuickMenu() {
  Sounds.open();
  const s = S.status || (await nova.sys.status());
  const now = new Date();
  const items = [
    h('div', { class: 'qm-time' }, now.toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit', hour12: !!S.settings.clock12 })),
    h('div', { class: 'qm-date' }, now.toLocaleDateString(I18N.locale, { weekday: 'long', day: 'numeric', month: 'long' })),
    h('div', { class: 'qm-cards' },
      h('div', { class: 'qm-card' }, h('div', { class: 'k' }, t('Batterij')), h('div', { class: 'v' }, s.battery ? (s.battery.status === 'Charging' ? t('{n}% · laadt', { n: s.battery.level }) : `${s.battery.level}%`) : t('Netstroom'))),
      h('div', { class: 'qm-card' }, h('div', { class: 'k' }, t('Wifi')), h('div', { class: 'v' }, s.wifi.enabled ? (s.wifi.ssid || t('Niet verbonden')) : t('Uit')))),
  ];
  if (s.volume.available) items.push(sliderRow(t('Volume'), s.volume.level, (v) => nova.sys.volume(v)));
  if (s.brightness.available) items.push(sliderRow(t('Helderheid'), s.brightness.level, (v) => nova.sys.brightness(v), { min: 5 }));
  if (S.game) items.push(actionRow(t('{title} stoppen', { title: S.game.title }), t('Sluit de game die nu draait'), 'stop', () => { UI.closeModal(modal); stopGame(); }, 'qm'));
  items.push(actionRow(t('Instellingen'), null, 'apps', () => { UI.closeModal(modal); switchTab('settings'); }, 'qm'));
  items.push(actionRow(t('Aan/uit'), null, 'power', () => { UI.closeModal(modal); openPower(); }, 'qm'));
  let modal;
  modal = UI.openModal(h('div', { class: 'sheet' }, ...items), { className: 'drawer', onAction: (a) => { if (a === 'y') { Sounds.back(); UI.closeModal(modal); return true; } return false; } });
}

// ================================================================ aan/uit
function openPower() {
  Sounds.open();
  let modal;
  const act = (a, msg) => () => { UI.closeModal(modal); if (msg) toast(msg, { icon: 'power' }); setTimeout(() => nova.sys.power(a), 400); };
  const list = h('div', { class: 'power-list' },
    actionRow(t('Slaapstand'), null, 'moon', act('suspend'), 'power'),
    actionRow(t('Opnieuw opstarten'), null, 'restart', act('reboot', t('Opnieuw opstarten…')), 'power'),
    actionRow(t('Uitzetten'), null, 'power', act('poweroff', t('Uitzetten…')), 'power'),
    actionRow(t('Bureaubladmodus'), t('Gewoon bureaublad met muis en toetsenbord'), 'desktop', act('desktop', t('Naar bureaublad…')), 'power'),
    actionRow(t('Annuleren'), null, null, () => { Sounds.back(); UI.closeModal(modal); }, 'power'));
  modal = UI.openModal(h('div', { class: 'sheet power-sheet' }, h('h2', {}, t('Aan/uit')), list), { focus: () => Focus.first('power') });
}

// ================================================================ hints
function updateHints() {
  const el = $('#hints');
  el.innerHTML = '';
  const add = (b, label, action) => el.append(h('button', { class: 'hint', onclick: () => handleAction(action || (Array.isArray(b) ? b[0] : b), { source: 'mouse' }) }, ...(Array.isArray(b) ? b.map(glyph) : [glyph(b)]), label));
  const top = UI.top();
  const cur = Focus.current;
  if (top && top._opts.className === 'launch') { add('a', t('Kiezen')); add('guide', t('Ingedrukt: game stoppen'), 'guide-long'); return; }
  if (top) {
    if (cur && cur.dataset.slider !== undefined) el.append(h('span', { class: 'hint' }, h('span', { class: 'glyph' }, '◀ ▶'), t('Aanpassen')));
    add('a', t('Kiezen')); add('b', t('Terug')); return;
  }
  if (cur && cur.dataset.slider !== undefined) el.append(h('span', { class: 'hint' }, h('span', { class: 'glyph' }, '◀ ▶'), t('Aanpassen')));
  const onTile = cur && cur.classList.contains('tile') && cur._game;
  if (S.tab === 'home' && onTile) add('a', t('Spelen'));
  else if (S.tab === 'library' && onTile) add('a', t('Openen'));
  else add('a', t('Kiezen'));
  if (onTile) add('x', t('Favoriet'));
  if (S.tab !== 'home') add('b', t('Terug'));
  add('y', t('Snelmenu'));
  add('start', t('Aan/uit'));
}
document.addEventListener('focusin-nova', () => updateHints());

// ================================================================ invoer
function setInputMode(mode) {
  if (document.body.dataset.input === mode) return;
  document.body.dataset.input = mode;
  refreshGlyphs();
  updateHints();
}

Input.on((a, extra) => handleAction(a, extra));
function handleAction(a, extra = {}) {
  if (extra.source === 'keyboard' || extra.source === 'mouse') setInputMode('kb');
  else if (extra.source === 'pad') setInputMode('pad');
  if (a === 'any') return;
  if (a === 'connected') { applyPadStyle(extra.style); updateHints(); toast(t('Controller verbonden'), { icon: 'gamepad' }); return; }
  if (a === 'disconnected') { toast(t('Controller losgekoppeld'), { icon: 'gamepad', bad: true }); return; }
  Sounds.unlock();
  if (extra.source === 'pad' && (!S.settings.pad || S.settings.pad === 'auto') && document.body.dataset.pad !== Input.lastStyle) applyPadStyle(Input.lastStyle);

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
      if (Focus.current) { Input.rumble(); Focus.current.click(); }
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
      if (S.steamFront) { S.steamFront = false; nova.sys.focusShell(); return; }
      UI.closeAll();
      if (S.tab !== 'home') switchTab('home'); else Focus.first('rail');
      return;
    case 'tab1': case 'tab2': case 'tab3':
      if (!top) switchTab(TABS[Number(a.slice(3)) - 1]);
      return;
    case 'search':
      if (top) return;
      if (S.tab !== 'library') switchTab('library');
      setTimeout(() => $('#searchBtn').click(), 80);
      return;
    case 'help':
      if (!top) openShortcuts();
      return;
  }
}

// ---------------------------------------------------------------- muis
// Scrollwiel op de game-rij scrolt horizontaal
$('#homeRail').addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.preventDefault();
  $('#homeRail').scrollBy({ left: e.deltaY * 1.4, behavior: 'auto' });
}, { passive: false });
// Pijlknoppen naast de rij (alleen zichtbaar met de muis)
for (const dir of [-1, 1]) {
  const btn = h('button', { class: `rail-arrow ${dir < 0 ? 'left' : 'right'}`, 'aria-label': dir < 0 ? t('Naar links') : t('Naar rechts') }, dir < 0 ? '‹' : '›');
  btn.addEventListener('click', () => { const r = $('#homeRail'); r.scrollBy({ left: dir * r.clientWidth * 0.7, behavior: 'smooth' }); Sounds.tick(); });
  $('.rail-wrap').append(btn);
}
// Statusbalk is klikbaar
$('#stWifi').addEventListener('click', () => { switchTab('settings'); openCat('wifi', true); });
$('#stBt').addEventListener('click', () => { switchTab('settings'); openCat('bt', true); });
$('#stBatt').addEventListener('click', () => !UI.top() && openQuickMenu());
$('#clock').addEventListener('click', () => !UI.top() && openQuickMenu());
$('#profile').addEventListener('click', () => { switchTab('settings'); openCat('look', true); });

// ---------------------------------------------------------------- sneltoetsen
function openShortcuts() {
  Sounds.open();
  const k = (...keys) => h('span', { class: 'keys' }, ...keys.map((x) => h('span', { class: 'glyph kc' }, x)));
  const rows = [
    [k('←', '↑', '→', '↓'), t('Bewegen')],
    [k('Enter'), t('Kiezen / spelen')],
    [k('Esc'), t('Terug (of rechtermuisknop)')],
    [k('1', '2', '3'), t('Home, Bibliotheek, Instellingen')],
    [k('Q', 'E'), t('Vorig / volgend tabblad')],
    [k('/'), t('Zoeken in je bibliotheek (ook Ctrl+F)')],
    [k('F'), t('Favoriet maken')],
    [k('Y'), t('Snelmenu')],
    [k('M'), t('Aan/uit-menu')],
    [k('Home'), t('Terug naar Home')],
    [k('H'), t('Dit overzicht')],
  ];
  let modal;
  modal = UI.openModal(h('div', { class: 'sheet power-sheet shortcuts' },
    h('h2', {}, t('Toetsenbord & muis')),
    h('div', { class: 'sc-grid' }, ...rows.flatMap(([keys, label]) => [keys, h('span', {}, label)])),
    h('p', { class: 'sc-mouse' }, t('Met de muis: wijs aan en klik. Scroll met het wiel door je games. Klik op de knoppen onderin, op de klok of op het wifi-icoon.')),
    h('button', { class: 'btn primary', 'data-focus': true, 'data-autofocus': true, onclick: () => UI.closeModal(modal) }, t('Begrepen'))));
}

// ---------------------------------------------------------------- Steam vooraan / inloggen
async function checkSteam() {
  const st = await nova.sys.steamStatus();
  const before = S.steamLoggedIn;
  S.steamLoggedIn = st && !st.error ? !!st.loggedIn : null;
  if (before !== S.steamLoggedIn) keepFocus($('#screen-home'), renderHome);
}
function steamLogin() {
  S.steamFront = true;
  nova.sys.steamLogin();
  toast(t('Steam-inlogscherm geopend. Druk op de Home-knop om terug te gaan.'), { icon: 'steam', ms: 6000 });
}
function openSteamFront() {
  S.steamFront = true;
  nova.sys.openSteam();
  toast(t('Steam geopend. Druk op de Home-knop om terug te gaan.'), { icon: 'steam', ms: 6000 });
}
nova.onSteamState && nova.onSteamState(async (st) => {
  S.steamFront = false;
  if (st && st.loggedIn) { toast(t('Ingelogd bij Steam'), { icon: 'check' }); await loadGames(); }
  await checkSteam();
  rerenderAll();
});
window.addEventListener('DOMContentLoaded', () => { setTimeout(checkSteam, 1500); setInterval(checkSteam, 60000); });

function goBack() {
  const cur = Focus.current;
  if (S.tab === 'settings' && cur && cur.dataset.group === 'setpanel') { Sounds.back(); Focus.set($(`#setNav [data-id="cat-${S.setCat}"]`), { silent: true }); return; }
  if (S.tab !== 'home') { Sounds.back(); switchTab('home'); return; }
  if (cur && cur.dataset.group !== 'rail') { Sounds.back(); Focus.first('rail'); }
}

window.addEventListener('DOMContentLoaded', () => {
  boot().catch((e) => { console.error('Opstarten mislukt:', e && e.stack ? e.stack : e); forceReady(); });
  // Vangnet: na 12 s altijd het menu tonen, ook als iets bleef hangen
  setTimeout(() => { if (!document.body.classList.contains('ready')) { console.error('Opstarten duurde te lang, menu toch geopend'); forceReady(); } }, 12000);
});

function forceReady() {
  try { if (S.skipIntro) S.skipIntro(); } catch {}
  $('#intro').classList.add('done');
  document.body.classList.add('ready');
  try { if (!S.games.length) renderHome(); } catch {}
  try { Focus.first('rail'); updateHints(); } catch {}
}
