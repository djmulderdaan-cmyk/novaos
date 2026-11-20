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

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(patch) {
  const next = { ...load(), ...patch };
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, FILE);
  return next;
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

module.exports = { load, save, DIR, customSounds };
