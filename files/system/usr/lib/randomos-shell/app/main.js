// RandomOS Shell - Electron hoofdproces
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const games = require('./backend/games');
const system = require('./backend/system');
const launcher = require('./backend/launcher');
const settings = require('./backend/settings');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

let win = null;

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
  win.once('ready-to-show', () => win.show());

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
handle('games:launch', (game) => launcher.launch(game));
handle('games:stop', () => launcher.stop());
handle('games:state', () => launcher.state());
handle('profile:get', () => games.profile());

handle('settings:get', () => settings.load());
handle('settings:set', (patch) => settings.save(patch));

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

app.whenReady().then(() => {
  launcher.ensureSteam();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
