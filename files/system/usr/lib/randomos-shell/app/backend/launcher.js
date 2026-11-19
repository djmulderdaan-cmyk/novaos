// Games starten en bijhouden of er een game draait.
//
// Hoe het werkt in gamescope: windows van processen met een SteamGameId/SteamAppId
// krijgen voorrang op de shell. Start een game -> gamescope toont de game.
// Sluit de game -> de shell is weer het enige window en komt terug.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const settings = require('./settings');
const gamescope = require('./gamescope');

const HOME = os.homedir();
let emit = () => {};
let current = null; // { game, phase: 'launching'|'running', startedAt, child }
let pollTimer = null;

function setEmitter(fn) { emit = fn; }
function publicState() {
  return current ? { id: current.game.id, title: current.game.title, phase: current.phase } : null;
}
function update(patch) {
  current = patch === null ? null : { ...current, ...patch };
  emit(publicState());
}

function hasCommand(cmd) {
  try { execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }); return true; } catch { return false; }
}

function steamRunning() {
  try { execFileSync('pgrep', ['-x', 'steam'], { stdio: 'ignore' }); return true; } catch { return false; }
}

// Steam ziet XDG_CURRENT_DESKTOP=gamescope en gaat dan zelf Big Picture spelen en de focus van
// gamescope sturen. RandomOS is de interface, dus Steam draait als gewone achtergrond-client.
const STEAM_ENV = { ...process.env, XDG_CURRENT_DESKTOP: 'KDE', XDG_SESSION_DESKTOP: 'KDE', DESKTOP_SESSION: 'plasma' };

function steamPids() {
  try { return execFileSync('pgrep', ['-x', 'steam']).toString().split('\n').filter(Boolean).map(Number); } catch { return []; }
}

// Draait Steam in "gamescope-modus"? Dan wil hij de interface overnemen.
function steamInGamescopeMode() {
  for (const pid of steamPids()) {
    try {
      if (/\0XDG_CURRENT_DESKTOP=gamescope\0/.test('\0' + fs.readFileSync(`/proc/${pid}/environ`, 'latin1'))) return true;
    } catch {}
  }
  return false;
}

function startSteam() {
  const child = spawn('steam', ['-silent'], { detached: true, stdio: 'ignore', env: STEAM_ENV });
  child.unref();
}

let restartingSteam = false;
function ensureSteam() {
  if (!hasCommand('steam') || restartingSteam) return;
  if (!steamRunning()) { startSteam(); return; }
  if (steamInGamescopeMode()) {
    // netjes afsluiten en als achtergrond-client opnieuw starten
    console.log('[steam] draait in gamescope-modus, herstarten als achtergrond-client');
    restartingSteam = true;
    spawn('steam', ['-shutdown'], { detached: true, stdio: 'ignore', env: STEAM_ENV }).unref();
    let tries = 0;
    const wait = setInterval(() => {
      if (!steamRunning() || ++tries > 40) {
        clearInterval(wait);
        for (const pid of steamPids()) { try { process.kill(pid, 'SIGTERM'); } catch {} }
        setTimeout(() => { restartingSteam = false; startSteam(); gamescope.focusShell(); }, 1500);
      }
    }, 500);
  }
}

function runningSteamAppId() {
  const candidates = [path.join(HOME, '.steam/registry.vdf')];
  for (const f of candidates) {
    try {
      const m = fs.readFileSync(f, 'utf8').match(/"RunningAppID"\s+"(\d+)"/i);
      if (m) return m[1];
    } catch {}
  }
  return null;
}

// Stabiel nep-appid voor niet-Steam games, zodat gamescope ze als game ziet
function fakeAppId(id) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return String(2000000000 + (h % 100000000));
}

function rememberPlayed(id) {
  const s = settings.load();
  settings.save({ recent: { ...s.recent, [id]: Date.now() } });
}

function launch(game) {
  if (!game) return { error: 'Game niet gevonden' };
  if (current) return { error: `${current.game.title} draait al` };
  rememberPlayed(game.id);
  const l = game.launch;
  current = { game, phase: 'launching', startedAt: Date.now(), sawRunning: false, child: null };
  emit(publicState());

  if (l.type === 'steamshortcut') {
    // niet-Steam-game uit Steam (bv. een .exe met Proton): via Steam starten
    ensureSteam();
    spawn('steam', [`steam://rungameid/${l.gameid}`], { detached: true, stdio: 'ignore', env: STEAM_ENV }).unref();
    gamescope.focusGame(l.appid, () => [...processesWithEnv('SteamGameId', l.gameid), ...processesWithEnv('SteamAppId', l.appid)], { withSteam: true });
  } else if (l.type === 'steam') {
    ensureSteam();
    spawn('steam', [`steam://rungameid/${l.appid}`], { detached: true, stdio: 'ignore', env: STEAM_ENV }).unref();
    // game-vensters herkennen aan SteamAppId en vooraan zetten
    gamescope.focusGame(l.appid, () => processesWithEnv('SteamAppId', l.appid), { withSteam: true });
  } else {
    const env = { ...process.env, SteamGameId: fakeAppId(game.id), SteamAppId: fakeAppId(game.id), RANDOMOS_GAME: game.id };
    let child;
    if (l.type === 'heroic') {
      const url = `heroic://launch/${l.runner}/${encodeURIComponent(l.app)}`;
      child = l.flatpak
        ? spawn('flatpak', ['run', 'com.heroicgameslauncher.hgl', '--no-gui', url], { env, detached: true, stdio: 'ignore' })
        : spawn('heroic', ['--no-gui', url], { env, detached: true, stdio: 'ignore' });
    } else {
      child = spawn('bash', ['-lc', l.cmd], { env, detached: true, stdio: 'ignore' });
      child.on('exit', () => setTimeout(() => { if (current && current.child === child && !gamePids(current.game.id).length) finish(); }, 4000));
    }
    child.on('error', () => finish('Kon de game niet starten'));
    child.unref();
    current.child = child;
    gamescope.focusGame(fakeAppId(game.id), () => gamePids(game.id));
  }
  startPolling();
  return { ok: true };
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!current) return clearInterval(pollTimer);
    const age = Date.now() - current.startedAt;
    if (current.game.launch.type === 'steamshortcut') {
      const l = current.game.launch;
      const alive = processesWithEnv('SteamGameId', l.gameid).length > 0 || runningSteamAppId() === l.appid;
      if (alive) {
        if (current.phase !== 'running' || !current.sawRunning) update({ phase: 'running', sawRunning: true });
      } else if (current.sawRunning) {
        finish();
      } else if (age > 120000) {
        finish('De game is niet gestart (Steam reageerde niet)');
      }
    } else if (current.game.launch.type === 'steam') {
      const running = runningSteamAppId();
      if (running === current.game.launch.appid) {
        if (current.phase !== 'running') update({ phase: 'running', sawRunning: true });
      } else if (current.sawRunning) {
        finish();
      } else if (age > 120000) {
        finish('De game is niet gestart (Steam reageerde niet)');
      }
    } else if (!current.sawPids && gamePids(current.game.id).length) {
      // we zien de game-processen zelf: vanaf nu volgen we die
      update({ phase: 'running', sawRunning: true, sawPids: true });
    } else if (current.sawPids && !gamePids(current.game.id).length) {
      // alle game-processen zijn weg -> klaar
      finish();
    } else if (!current.sawRunning && age > 120000) {
      finish('De game is niet gestart');
    }
  }, 2000);
}

function finish(error) {
  clearInterval(pollTimer);
  gamescope.focusShell();
  const ended = current && current.game;
  current = null;
  emit(error ? { ended: ended && ended.id, error } : null);
}

// Processen van launchers/wrappers zelf tellen niet als de game
const WRAPPERS = /^(heroic.*|electron|zypak.*|bwrap|flatpak.*|xdg-dbus-proxy|bash|sh|steam|steamwebhelper|reaper|pressure-vessel.*|srt-bwrap)$/i;
function isWrapper(pid) {
  try { return WRAPPERS.test(fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim()); } catch { return true; }
}
function gamePids(id) { return processesWithEnv('RANDOMOS_GAME', id).filter((pid) => !isWrapper(pid)); }

function processesWithEnv(key, value) {
  const hits = [];
  let pids;
  try { pids = fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p)); } catch { return hits; }
  const needle = `${key}=${value}\0`;
  for (const pid of pids) {
    if (Number(pid) === process.pid) continue;
    try {
      const env = fs.readFileSync(`/proc/${pid}/environ`, 'latin1');
      if (env.includes(needle)) hits.push(Number(pid));
    } catch {}
  }
  return hits;
}

function stop() {
  if (!current) return { ok: true };
  const l = current.game.launch;
  const pids = l.type === 'steam' ? processesWithEnv('SteamAppId', l.appid)
    : l.type === 'steamshortcut' ? processesWithEnv('SteamGameId', l.gameid)
    : gamePids(current.game.id);
  for (const pid of pids) { try { process.kill(pid, 'SIGTERM'); } catch {} }
  setTimeout(() => { for (const pid of pids) { try { process.kill(pid, 'SIGKILL'); } catch {} } }, 5000);
  if (current.child && current.child.pid) { try { process.kill(-current.child.pid, 'SIGTERM'); } catch {} }
  finish();
  return { ok: true };
}

// Extra signaal uit gamescope: shell verliest focus = game staat vooraan
function onShellBlur() {
  if (!current || current.phase !== 'launching') return;
  // Steam: alleen registry.vdf bepaalt of de game echt draait (een "Voorbereiden"-venster telt niet)
  const viaSteam = ['steam', 'steamshortcut'].includes(current.game.launch.type);
  update(viaSteam ? { phase: 'running' } : { phase: 'running', sawRunning: true, blurredAt: Date.now() });
}
function onShellFocus() {
  // Steam-games worden betrouwbaar via RunningAppID gevolgd; voor andere games is focus-terug een goed teken
  if (current && current.sawRunning && !['steam', 'steamshortcut'].includes(current.game.launch.type) && Date.now() - current.startedAt > 5000) {
    if (!gamePids(current.game.id).length) finish();
  }
}

function openSteamBigPicture() {
  ensureSteam();
  spawn('steam', ['steam://open/bigpicture'], { detached: true, stdio: 'ignore', env: STEAM_ENV }).unref();
  gamescope.focusSteam();
  watchSteamFront();
  return { ok: true };
}

// ---------------------------------------------------------------- Steam-login
let steamEmit = () => {};
let loginTimer = null;
function setSteamEmitter(fn) { steamEmit = fn; }

function windowTitles() {
  try { return execFileSync('xwininfo', ['-root', '-children'], { env: process.env, timeout: 3000 }).toString(); } catch { return ''; }
}

// Ingelogd = er is geen "Sign in to Steam"-venster en Steam kent een account
function steamStatus() {
  const signInOpen = /"Sign in to Steam"|"Inloggen bij Steam"|"Steam Login"/i.test(windowTitles());
  let hasUser = false;
  try {
    const t = fs.readFileSync(path.join(HOME, '.local/share/Steam/config/loginusers.vdf'), 'utf8');
    hasUser = /"AccountName"/.test(t);
  } catch {}
  return { running: steamRunning(), loggedIn: hasUser && !signInOpen, signInOpen };
}

// Haal het Steam-inlogscherm naar voren; zodra je bent ingelogd komt de shell vanzelf terug
function steamLogin() {
  ensureSteam();
  gamescope.focusSteam();
  watchSteamFront();
  clearInterval(loginTimer);
  const started = Date.now();
  loginTimer = setInterval(() => {
    const st = steamStatus();
    if (st.loggedIn || Date.now() - started > 15 * 60000) {
      clearInterval(loginTimer);
      gamescope.focusShell();
      steamEmit(st);
    }
  }, 3000);
  return { ok: true };
}

// Elke 15 s: Steam moet draaien (wordt gestopt als je het inlogvenster sluit) en de focus moet kloppen
let steamDownSince = 0;
function watchdog() {
  if (!steamRunning()) {
    if (!steamDownSince) steamDownSince = Date.now();
    // even wachten: Steam herstart zichzelf soms bij updates
    if (Date.now() - steamDownSince > 20000) {
      console.log('[watchdog] Steam draait niet, opnieuw starten');
      steamDownSince = 0;
      ensureSteam();
      if (gamescope.mode === 'steam') gamescope.focusShell();
    }
  } else {
    steamDownSince = 0;
    // Steam mag niet zelf de interface gaan spelen (Big Picture + focus overnemen)
    if (!current && steamInGamescopeMode()) ensureSteam();
  }
  if (!current) gamescope.ensure();
  // Steam vooraan maar geen groot Steam-venster meer open (Big Picture/inlogscherm gesloten)? Terug naar de shell.
  if (!current && gamescope.mode === 'steam' && !steamWindowOpen()) {
    console.log('[watchdog] Steam-venster gesloten, terug naar RandomOS');
    gamescope.focusShell();
    steamEmit(steamStatus());
  }
}

// Is er een groot, zichtbaar Steam-venster (Big Picture, inlogscherm of bibliotheek)?
function steamWindowOpen() {
  // Gamescope weet zelf of Steam (app 769) een venster heeft dat getoond kan worden:
  // dat blijft zo bij wisselen tussen Bibliotheek, Store, enz.
  try {
    const out = execFileSync('xprop', ['-root', 'GAMESCOPE_FOCUSABLE_APPS'], { env: process.env, timeout: 2000 }).toString();
    const apps = (out.split('=')[1] || '').split(',').map((x) => Number(x.trim()));
    if (apps.includes(769)) return true;
  } catch {}
  // terugval: een groot, zichtbaar Steam-venster
  const lines = windowTitles().split('\n').filter((l) => /"steamwebhelper"|"steam"/.test(l) && /\b(1[0-9]\d\d|[2-9]\d\d\d)x(\d{3,4})\+/.test(l));
  for (const l of lines) {
    const id = (l.match(/^\s*(0x[0-9a-f]+)/i) || [])[1];
    if (!id) continue;
    try {
      const info = execFileSync('xwininfo', ['-id', id], { env: process.env, timeout: 2000 }).toString();
      if (/Map State:\s*IsViewable/.test(info)) return true;
    } catch {}
  }
  return false;
}

// Zolang Steam vooraan staat: snel controleren, en terug naar RandomOS zodra Steam weg/geminimaliseerd is
let steamFrontTimer = null;
function watchSteamFront() {
  clearInterval(steamFrontTimer);
  let seen = false;
  let misses = 0;
  const started = Date.now();
  steamFrontTimer = setInterval(() => {
    if (gamescope.mode !== 'steam') { clearInterval(steamFrontTimer); return; }
    const open = steamWindowOpen();
    if (open) { seen = true; misses = 0; } else misses++;
    // even tijd geven om te openen (Big Picture kan een paar seconden duren), en
    // pas na 2 keer achter elkaar "dicht" terug (wisselen naar de Store duurt even)
    if (!open && misses >= 2 && (seen || Date.now() - started > 20000)) {
      clearInterval(steamFrontTimer);
      console.log('[steam] venster dicht/geminimaliseerd, terug naar RandomOS');
      gamescope.focusShell();
      steamEmit(steamStatus());
    }
  }, 1500);
}

// Tijdens een game: naar RandomOS (game blijft draaien) en weer terug
function showShellOverGame() {
  if (!current) return { error: 'Er draait geen game' };
  gamescope.showShellOverGame();
  return { ok: true };
}
function resumeGame() {
  if (!current) return { error: 'Er draait geen game' };
  gamescope.resumeGame();
  return { ok: true };
}

function focusShell() {
  clearInterval(loginTimer);
  gamescope.focusShell();
  return { ok: true };
}

module.exports = { showShellOverGame, resumeGame, watchdog, setEmitter, setSteamEmitter, ensureSteam, launch, stop, state: publicState, onShellBlur, onShellFocus, openSteamBigPicture, steamStatus, steamLogin, focusShell };
