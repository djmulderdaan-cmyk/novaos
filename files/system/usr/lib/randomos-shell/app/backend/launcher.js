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
const { steamRoot } = require('./games');

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

function ensureSteam() {
  if (!hasCommand('steam') || steamRunning()) return;
  const child = spawn('steam', ['-silent'], { detached: true, stdio: 'ignore' });
  child.unref();
}

function runningSteamAppId() {
  const candidates = [path.join(HOME, '.steam/registry.vdf'), steamRoot() && path.join(steamRoot(), '..', 'registry.vdf')].filter(Boolean);
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
  if (current) return { error: `${current.game.title} draait al` };
  rememberPlayed(game.id);
  const l = game.launch;
  current = { game, phase: 'launching', startedAt: Date.now(), sawRunning: false, child: null };
  emit(publicState());

  if (l.type === 'steam') {
    ensureSteam();
    spawn('steam', [`steam://rungameid/${l.appid}`], { detached: true, stdio: 'ignore' }).unref();
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
      child.on('exit', () => { if (current && current.child === child) finish(); });
    }
    child.on('error', () => finish('Kon de game niet starten'));
    child.unref();
    current.child = child;
  }
  startPolling();
  return { ok: true };
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!current) return clearInterval(pollTimer);
    const age = Date.now() - current.startedAt;
    if (current.game.launch.type === 'steam') {
      const running = runningSteamAppId();
      if (running === current.game.launch.appid) {
        if (current.phase !== 'running') update({ phase: 'running', sawRunning: true });
      } else if (current.sawRunning) {
        finish();
      } else if (age > 120000) {
        finish('De game is niet gestart (Steam reageerde niet)');
      }
    } else if (current.phase === 'launching' && age > 4000 && processesWithEnv('RANDOMOS_GAME', current.game.id).length) {
      update({ phase: 'running', sawRunning: true });
    } else if (current.sawRunning && current.game.launch.type === 'heroic' && !processesWithEnv('RANDOMOS_GAME', current.game.id).length) {
      finish();
    } else if (!current.sawRunning && age > 120000) {
      finish('De game is niet gestart');
    }
  }, 2000);
}

function finish(error) {
  clearInterval(pollTimer);
  const ended = current && current.game;
  current = null;
  emit(error ? { ended: ended && ended.id, error } : null);
}

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
  const pids = l.type === 'steam' ? processesWithEnv('SteamAppId', l.appid) : processesWithEnv('RANDOMOS_GAME', current.game.id);
  for (const pid of pids) { try { process.kill(pid, 'SIGTERM'); } catch {} }
  setTimeout(() => { for (const pid of pids) { try { process.kill(pid, 'SIGKILL'); } catch {} } }, 5000);
  if (current.child && current.child.pid) { try { process.kill(-current.child.pid, 'SIGTERM'); } catch {} }
  finish();
  return { ok: true };
}

// Extra signaal uit gamescope: shell verliest focus = game staat vooraan
function onShellBlur() {
  if (current && current.phase === 'launching') update({ phase: 'running', sawRunning: true });
}
function onShellFocus() {
  // Steam-games worden betrouwbaar via RunningAppID gevolgd; voor andere games is focus-terug een goed teken
  if (current && current.sawRunning && current.game.launch.type !== 'steam' && Date.now() - current.startedAt > 5000) {
    if (!processesWithEnv('RANDOMOS_GAME', current.game.id).length) finish();
  }
}

function openSteamBigPicture() {
  ensureSteam();
  spawn('steam', ['steam://open/bigpicture'], { detached: true, stdio: 'ignore' }).unref();
  return { ok: true };
}

module.exports = { setEmitter, ensureSteam, launch, stop, state: publicState, onShellBlur, onShellFocus, openSteamBigPicture };
