// Instellingen in ~/.config/randomos/settings.json
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = path.join(os.homedir(), '.config', 'randomos');
const FILE = path.join(DIR, 'settings.json');

const DEFAULTS = {
  accent: '#2aa8e8',
  lang: 'auto',
  perfOverlay: 'off',
  fpsLimit: 0, // 0 = geen limiet
  night: 'off', // nachtlicht: 'off' | 'on' | 'auto' (20:00-07:00)
  nightStrength: 50,
  fpsGame: {}, // gameId -> eigen FPS-limiet voor die game
  padKeys: {}, // gameId -> eigen knoppenindeling voor controller-als-toetsenbord
  sounds: true,
  ambient: true,
  intro: true,
  perf: false, // prestatiemodus: minder effecten
  theme: 'space', bgStyle: 'art', tiles: 'normal', titles: false, text: 'normal',
  clock12: false, showDate: false, battPct: true, greeting: true, reduceMotion: false,
  soundStyle: 'soft', uiVolume: 70, pad: 'auto', swapAB: false, navSpeed: 'normal', rumble: true,
  startTab: 'home', homeRow: 'recent', hidden: [], screensaver: 5, autoSleep: 0, lowBattery: true,
  name: '',
  favorites: [],
  recent: {}, // gameId -> laatst gestart (ms), voor niet-Steam games
  playtime: {}, // gameId -> minuten gespeeld, voor niet-Steam games (Steam houdt het zelf bij)
};

// ---- spelers (profielen): elke speler heeft een eigen instellingenbestand.
// De eerste speler ("main") gebruikt het oude settings.json, zodat er niks verloren gaat.
const PROFILES = path.join(DIR, 'profiles.json');
const COLORS = ['#2aa8e8', '#ff6b8a', '#7ad66b', '#f5a524', '#a77bff', '#2fd6c3'];

function profilesData() {
  try {
    const d = JSON.parse(fs.readFileSync(PROFILES, 'utf8'));
    if (d && Array.isArray(d.list) && d.list.length) return d;
  } catch {}
  return { current: 'main', list: [{ id: 'main', color: COLORS[0] }] };
}
function writeProfiles(d) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(PROFILES + '.tmp', JSON.stringify(d, null, 2));
  fs.renameSync(PROFILES + '.tmp', PROFILES);
}
const fileFor = (id) => (id === 'main' ? FILE : path.join(DIR, `settings-${id}.json`));
function currentId() { const d = profilesData(); return d.list.some((p) => p.id === d.current) ? d.current : 'main'; }

function readFile(f) {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(f, 'utf8')) }; } catch { return { ...DEFAULTS }; }
}
function writeFile(f, obj) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, f);
}

function load() { return readFile(fileFor(currentId())); }

function save(patch) {
  const f = fileFor(currentId());
  const next = { ...readFile(f), ...patch };
  writeFile(f, next);
  return next;
}

function listProfiles() {
  const d = profilesData();
  const cur = currentId();
  return d.list.map((p, i) => ({ id: p.id, color: p.color || COLORS[i % COLORS.length], name: readFile(fileFor(p.id)).name || '', current: p.id === cur, main: p.id === 'main' }));
}

function createProfile(name) {
  const d = profilesData();
  if (d.list.length >= 8) return { error: 'Maximaal 8 spelers' };
  const id = 'p' + Date.now().toString(36);
  const color = COLORS[d.list.length % COLORS.length];
  // nieuwe speler begint met de standaardinstellingen, alleen de taal van de huidige speler gaat mee
  writeFile(fileFor(id), { ...DEFAULTS, name: String(name || '').slice(0, 24), lang: load().lang, accent: color });
  d.list.push({ id, color });
  writeProfiles(d);
  return { ok: true, id };
}

function switchProfile(id) {
  const d = profilesData();
  if (!d.list.some((p) => p.id === id)) return { error: 'Niet gevonden' };
  d.current = id;
  writeProfiles(d);
  return { ok: true };
}

function removeProfile(id) {
  if (id === 'main') return { error: 'De eerste speler kan niet weg' };
  const d = profilesData();
  if (!d.list.some((p) => p.id === id)) return { error: 'Niet gevonden' };
  d.list = d.list.filter((p) => p.id !== id);
  if (d.current === id) d.current = 'main';
  writeProfiles(d);
  try { fs.rmSync(fileFor(id), { force: true }); } catch {}
  return { ok: true };
}

// Eigen geluiden: ~/.config/randomos/sounds/move.wav, select.ogg, back.mp3, ...
const SOUND_NAMES = ['move', 'select', 'back', 'tab', 'toggle', 'tick', 'error', 'open', 'launch', 'boot'];
const MIME = { '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.opus': 'audio/ogg' };
function customSounds() {
  const dir = path.join(DIR, 'sounds');
  const out = {};
  let files = [];
  try { files = fs.readdirSync(dir); } catch { return { dir, sounds: out }; }
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const name = path.basename(f, ext).toLowerCase();
    if (!MIME[ext] || !SOUND_NAMES.includes(name) || out[name]) continue;
    const full = path.join(dir, f);
    try {
      if (fs.statSync(full).size > 3 * 1024 * 1024) continue; // max 3 MB per geluid
      out[name] = { mime: MIME[ext], b64: fs.readFileSync(full).toString('base64') };
    } catch {}
  }
  return { dir, sounds: out };
}

module.exports = { load, save, DIR, customSounds, listProfiles, createProfile, switchProfile, removeProfile, currentProfileId: currentId };
