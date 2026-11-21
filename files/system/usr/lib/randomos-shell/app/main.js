// RandomOS Shell - Electron hoofdproces
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const games = require('./backend/games');
const system = require('./backend/system');
const launcher = require('./backend/launcher');
const settings = require('./backend/settings');
const gamescope = require('./backend/gamescope');
const updates = require('./backend/updates');
const overlay = require('./backend/overlay');
const padswap = require('./backend/padswap');
const album = require('./backend/album');
const achievements = require('./backend/achievements');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,SpareRendererForSitePerProcess');
// Zuinig met geheugen op laptops met 8 GB of minder (games hebben het harder nodig)
if (require('os').totalmem() <= 9 * 1024 ** 3) {
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
  app.commandLine.appendSwitch('disk-cache-size', String(64 * 1024 * 1024));
  app.commandLine.appendSwitch('renderer-process-limit', '1');
}

let win = null;
let rendererCrashes = [];

// Nooit stilletjes omvallen: fouten in het hoofdproces alleen loggen
process.on('uncaughtException', (e) => console.error('[main] onverwachte fout:', e && e.stack ? e.stack : e));
process.on('unhandledRejection', (e) => console.error('[main] onafgehandelde belofte:', e && e.stack ? e.stack : e));

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    show: false,
    backgroundColor: '#05081a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // blijf de controller uitlezen, ook als er een game bovenop draait
      backgroundThrottling: false,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    // In Game Mode: gamescope vertellen dat dit het hoofdscherm is
    try {
      const handle = win.getNativeWindowHandle();
      const xid = handle.length >= 4 ? handle.readUInt32LE(0) : 0;
      if (xid) gamescope.init(xid).then((ok) => console.log('gamescope:', ok ? `actief, venster ${xid}` : 'niet gevonden'));
    } catch (e) { console.error('gamescope init', e); }
  });

  // Fouten uit de interface in het logboek zetten (~/.local/state/randomos/shell.log)
  win.webContents.on('console-message', (e) => {
    const level = e.level != null ? e.level : '';
    if (level === 'warning' || level === 'error' || level === 2 || level === 3) console.log(`[ui ${level}] ${e.message} (${e.sourceId || ''}:${e.lineNumber || ''})`);
  });
  // Interface gecrasht? Herladen. Te vaak achter elkaar -> shell stoppen zodat het startscript hem opnieuw start
  win.webContents.on('render-process-gone', (_e, d) => {
    console.log('[ui] renderer weg:', d && d.reason);
    if (d && d.reason === 'clean-exit') return;
    const now = Date.now();
    rendererCrashes = rendererCrashes.filter((t) => now - t < 60000).concat(now);
    if (rendererCrashes.length > 3) { console.log('[ui] te vaak gecrasht, shell herstarten'); app.exit(1); return; }
    setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.reload(); }, 800);
  });
  let hangTimer = null;
  win.webContents.on('unresponsive', () => {
    console.log('[ui] reageert niet, herladen over 8 s als dat zo blijft');
    clearTimeout(hangTimer);
    hangTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.forcefullyCrashRenderer(); }, 8000);
  });
  win.webContents.on('responsive', () => clearTimeout(hangTimer));

  // Externe links nooit in de shell openen
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // Focus wisselt als gamescope een game naar voren haalt of de game stopt
  win.on('blur', () => launcher.onShellBlur());
  win.on('focus', () => launcher.onShellFocus());
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

launcher.setEmitter((state) => send('game:state', state));
launcher.setSteamEmitter((st) => send('steam:state', st));

const handle = (channel, fn) =>
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(`[${channel}]`, err);
      return { error: String(err && err.message ? err.message : err) };
    }
  });

handle('games:list', () => games.listAll());
// De interface stuurt alleen een id; het commando komt altijd uit onze eigen gamelijst
handle('games:launch', (id) => launcher.launch(games.listAll().find((g) => g.id === (id && id.id ? id.id : id))));
handle('games:stop', () => launcher.stop());
handle('games:show-shell', () => launcher.showShellOverGame());
handle('games:resume', () => launcher.resumeGame());
handle('games:apps', () => games.listApps());
handle('games:catalog', () => games.catalog());
handle('games:install', (appid) => launcher.installSteam(String(appid || '')));
const achLang = () => (settings.load().lang === 'en' ? 'english' : 'dutch'); // Nederlands bestaat zelden: dan Engels
handle('games:achievements', (appid) => { const r = games.steamRoot(); return r && /^\d+$/.test(String(appid)) ? achievements.forGame(r, String(appid), achLang()) : null; });
handle('games:ach-summary', () => { const r = games.steamRoot(); return r ? achievements.summary(r) : {}; });
handle('sys:steam-friends', () => launcher.openSteamFriends());
handle('games:downloads', () => games.listDownloads());
handle('album:take', (title) => album.take(String(title || '')));
handle('album:list', () => album.list());
handle('album:pictures', () => album.pictures());
handle('album:remove', (p) => album.remove(String(p || '')));
handle('games:add-app', (id) => games.addApp(String(id || '')));
handle('games:remove', (id) => games.removeCustom(String(id || '')));
handle('games:state', () => launcher.state());
handle('profile:get', () => games.profile());

handle('settings:get', () => settings.load());
// Spelers: wisselen = instellingen van die speler toepassen en het menu opnieuw laden
handle('profiles:list', () => settings.listProfiles());
handle('profiles:create', (name) => settings.createProfile(String(name || '')));
handle('profiles:remove', (id) => settings.removeProfile(String(id || '')));
handle('profiles:switch', (id) => {
  const r = settings.switchProfile(String(id || ''));
  if (r.ok) {
    const s = settings.load();
    try { overlay.setLevel(s.perfOverlay || 'off'); } catch {}
    try { launcher.applyFps(launcher.currentGameId()); } catch {}
    try { padswap.apply(!!s.swapAB); } catch {}
    applyNight();
    setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.reload(); }, 150);
  }
  return r;
});
handle('settings:set', (patch) => {
  const r = settings.save(patch);
  if (patch && 'swapAB' in patch) padswap.apply(!!patch.swapAB);
  return r;
});
handle('pad:sysswap', () => padswap.isActive());
handle('sounds:custom', () => settings.customSounds());

handle('sys:status', () => system.status());
handle('sys:info', () => system.info());
handle('sys:volume', (v) => system.setVolume(v));
handle('sys:mute', () => system.toggleMute());
handle('sys:brightness', (v) => system.setBrightness(v));
handle('sys:wifi-list', () => system.wifiList());
handle('sys:wifi-connect', (ssid, pw) => system.wifiConnect(ssid, pw));
handle('sys:wifi-radio', (on) => system.wifiRadio(on));
handle('sys:bt-power', (on) => system.btPower(on));
handle('sys:bt-devices', () => system.btDevices());
handle('sys:bt-scan', () => system.btScan());
handle('sys:bt-connect', (mac) => system.btConnect(mac));
handle('sys:bt-disconnect', (mac) => system.btDisconnect(mac));
handle('sys:bt-remove', (mac) => system.btRemove(mac));
handle('sys:power', (action) => system.power(action, app));
handle('sys:open-steam', () => launcher.openSteamBigPicture());
handle('sys:steam-status', () => launcher.steamStatus());
handle('sys:steam-login', () => launcher.steamLogin());
handle('sys:focus-shell', () => launcher.focusShell());
handle('perf:overlay', (level) => overlay.setLevel(level));
handle('perf:fps-limit', async (fps) => {
  settings.save({ fpsLimit: Number(fps) || 0 });
  // draait er een game met een eigen limiet? dan die laten staan
  launcher.applyFps(launcher.currentGameId());
  return { ok: true };
});
// eigen FPS-limiet voor één game (null = standaard gebruiken)
handle('perf:fps-game', async (gameId, fps) => {
  const id = String(gameId || '');
  if (!id) return { error: 'Niet gevonden' };
  const per = { ...(settings.load().fpsGame || {}) };
  if (fps == null || fps === 'default') delete per[id]; else per[id] = Math.max(0, Math.min(240, Number(fps) || 0));
  settings.save({ fpsGame: per });
  if (launcher.currentGameId() === id) launcher.applyFps(id);
  return { ok: true };
});
handle('sys:storage', () => system.storage());

// Slaaptimer: na X minuten gaat de laptop slapen (ook tijdens een game)
let sleepTimer = null, sleepAt = 0, sleepMin = 0;
handle('sys:sleep-timer', (min) => {
  clearTimeout(sleepTimer); sleepAt = 0; sleepMin = 0;
  min = Number(min) || 0;
  if (min > 0 && min <= 600) {
    sleepMin = min;
    sleepAt = Date.now() + min * 60000;
    sleepTimer = setTimeout(() => { sleepAt = 0; sleepMin = 0; console.log('[slaaptimer] tijd om te slapen'); system.power('suspend', app); }, min * 60000);
    console.log(`[slaaptimer] over ${min} min slapen`);
  }
  return { at: sleepAt, min: sleepMin };
});
handle('sys:sleep-timer-get', () => ({ at: sleepAt, min: sleepMin }));
handle('perf:available', () => overlay.available());
handle('upd:status', () => updates.status());
handle('upd:check', () => updates.check());
handle('upd:upgrade', () => updates.upgrade((line) => send('upd:progress', line)));
handle('upd:rollback', () => updates.rollback());

app.on('child-process-gone', (_e, d) => console.log('[main] hulpproces weg:', d && d.type, d && d.reason, d && d.exitCode));

app.whenReady().then(() => {
  launcher.ensureSteam();
  try { overlay.setLevel(settings.load().perfOverlay || 'off'); } catch {}
  try { system.setFpsLimit(settings.load().fpsLimit || 0); } catch {}
  applyNight();
  setInterval(applyNight, 60000);
  startMediaKeys();
  padswap.onChange((on) => send('pad:sysswap', on));
  try { padswap.apply(!!settings.load().swapAB); } catch {}
  setInterval(() => { padswap.sync(); }, 5000);
  createWindow();
  // Bewakers: Steam moet draaien, en gamescope moet het juiste venster vooraan houden
  setInterval(() => {
    try { launcher.watchdog(); } catch (e) { console.error('[watchdog]', e); }
  }, 15000);
});

app.on('window-all-closed', () => app.quit());

// Nachtlicht: aan, uit of automatisch 's avonds (20:00-07:00)
function nightActive(s) {
  if (s.night === 'on') return true;
  if (s.night !== 'auto') return false;
  const h = new Date().getHours();
  return h >= 20 || h < 7;
}
function applyNight() {
  try {
    const s = settings.load();
    system.setNightLight(nightActive(s) ? Math.max(10, Math.min(100, Number(s.nightStrength) || 50)) / 100 : 0);
  } catch {}
}
handle('sys:night', (mode, strength) => {
  const patch = {};
  if (['off', 'on', 'auto'].includes(mode)) patch.night = mode;
  if (strength != null) patch.nightStrength = Math.max(10, Math.min(100, Number(strength) || 50));
  const s = settings.save(patch);
  applyNight();
  return { ok: true, active: nightActive(s), night: s.night, nightStrength: s.nightStrength };
});

// Aan/uit-knop (logind laat hem op Bazzite aan Steam over, maar Steam draait hier op de achtergrond):
// tijdens een game = slaapstand (zoals een console), in het menu = aan/uit-menu tonen
function onPowerButton() {
  const st = launcher.state();
  if (st && st.phase === 'running' && gamescope.mode === 'game') {
    console.log('[aan/uit] knop tijdens game: slaapstand');
    system.power('suspend', app);
  } else {
    send('power-button', {});
  }
}

// Volume- en helderheidstoetsen van de laptop (werkt ook tijdens een game)
let mediaKeys = null;
function startMediaKeys(tries = 0) {
  const bin = '/usr/libexec/randomos/mediakeys';
  if (!fs.existsSync(bin)) return;
  const child = spawn(bin, [], { stdio: ['ignore', 'pipe', 'ignore'] });
  mediaKeys = child;
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const [k, a, b] = buf.slice(0, i).trim().split(' ');
      buf = buf.slice(i + 1);
      if (k === 'vol') send('osd', { type: 'volume', level: Number(a), muted: b === '1' });
      else if (k === 'bright') send('osd', { type: 'brightness', level: Number(a) });
      else if (k === 'power') onPowerButton();
    }
  });
  child.on('error', () => {});
  child.on('exit', () => { if (mediaKeys === child && tries < 5) setTimeout(() => startMediaKeys(tries + 1), 5000); });
}
app.on('will-quit', () => { const c = mediaKeys; mediaKeys = null; if (c) try { c.kill(); } catch {} });
