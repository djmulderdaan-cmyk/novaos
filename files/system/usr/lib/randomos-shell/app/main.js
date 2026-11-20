// RandomOS Shell - Electron hoofdproces
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const games = require('./backend/games');
const system = require('./backend/system');
const launcher = require('./backend/launcher');
const settings = require('./backend/settings');
const gamescope = require('./backend/gamescope');
const updates = require('./backend/updates');
const overlay = require('./backend/overlay');

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
handle('games:state', () => launcher.state());
handle('profile:get', () => games.profile());

handle('settings:get', () => settings.load());
handle('settings:set', (patch) => settings.save(patch));
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
handle('sys:power', (action) => system.power(action, app));
handle('sys:open-steam', () => launcher.openSteamBigPicture());
handle('sys:steam-status', () => launcher.steamStatus());
handle('sys:steam-login', () => launcher.steamLogin());
handle('sys:focus-shell', () => launcher.focusShell());
handle('perf:overlay', (level) => overlay.setLevel(level));
handle('perf:available', () => overlay.available());
handle('upd:status', () => updates.status());
handle('upd:check', () => updates.check());
handle('upd:upgrade', () => updates.upgrade((line) => send('upd:progress', line)));
handle('upd:rollback', () => updates.rollback());

app.on('child-process-gone', (_e, d) => console.log('[main] hulpproces weg:', d && d.type, d && d.reason, d && d.exitCode));

app.whenReady().then(() => {
  launcher.ensureSteam();
  try { overlay.setLevel(settings.load().perfOverlay || 'off'); } catch {}
  createWindow();
  // Bewakers: Steam moet draaien, en gamescope moet het juiste venster vooraan houden
  setInterval(() => {
    try { launcher.watchdog(); } catch (e) { console.error('[watchdog]', e); }
  }, 15000);
});

app.on('window-all-closed', () => app.quit());
