// Veilige brug tussen de interface en het systeem
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('nova', {
  isReal: true,
  games: {
    list: call('games:list'),
    launch: call('games:launch'),
    stop: call('games:stop'),
    state: call('games:state'),
  },
  profile: call('profile:get'),
  settings: { get: call('settings:get'), set: call('settings:set') },
  customSounds: call('sounds:custom'),
  sys: {
    status: call('sys:status'),
    info: call('sys:info'),
    volume: call('sys:volume'),
    mute: call('sys:mute'),
    brightness: call('sys:brightness'),
    wifiList: call('sys:wifi-list'),
    wifiConnect: call('sys:wifi-connect'),
    wifiRadio: call('sys:wifi-radio'),
    btPower: call('sys:bt-power'),
    btDevices: call('sys:bt-devices'),
    btScan: call('sys:bt-scan'),
    btConnect: call('sys:bt-connect'),
    btDisconnect: call('sys:bt-disconnect'),
    power: call('sys:power'),
    openSteam: call('sys:open-steam'),
    steamStatus: call('sys:steam-status'),
    steamLogin: call('sys:steam-login'),
    focusShell: call('sys:focus-shell'),
  },
  onGameState: (cb) => ipcRenderer.on('game:state', (_e, s) => cb(s)),
  onSteamState: (cb) => ipcRenderer.on('steam:state', (_e, s) => cb(s)),
});
