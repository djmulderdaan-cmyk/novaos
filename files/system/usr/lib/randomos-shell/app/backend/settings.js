// Instellingen in ~/.config/randomos/settings.json
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = path.join(os.homedir(), '.config', 'randomos');
const FILE = path.join(DIR, 'settings.json');

const DEFAULTS = {
  accent: '#2aa8e8',
  sounds: true,
  ambient: true,
  intro: true,
  perf: false, // prestatiemodus: minder effecten
  name: '',
  favorites: [],
  recent: {}, // gameId -> laatst gestart (ms), voor niet-Steam games
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

module.exports = { load, save, DIR };
