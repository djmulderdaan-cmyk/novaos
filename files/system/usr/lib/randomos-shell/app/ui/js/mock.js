// Demo-modus: als de shell in een gewone browser draait (zonder Electron)
// gebruiken we nepdata, zodat je de interface op Windows kunt bekijken.
if (!window.nova) {
  const steamArt = (id) => {
    const a = (f) => [
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/${f}`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/${f}`,
    ];
    return { cover: [...a('library_600x900_2x.jpg'), ...a('library_600x900.jpg')], hero: a('library_hero.jpg'), logo: a('logo.png'), header: a('header.jpg') };
  };
  const day = 86400000;
  const now = Date.now();
  const steam = [
    [1145360, 'Hades', 0.2, 2940], [413150, 'Stardew Valley', 1, 8100], [367520, 'Hollow Knight', 3, 3300],
    [504230, 'Celeste', 6, 1260], [730, 'Counter-Strike 2', 0.5, 12400], [252950, 'Rocket League', 9, 5400],
    [105600, 'Terraria', 15, 7000], [620, 'Portal 2', 40, 900], [588650, 'Dead Cells', 22, 1800],
    [1794680, 'Vampire Survivors', 2, 1500], [1086940, "Baldur's Gate 3", 60, 0], [646570, 'Slay the Spire', 12, 4300],
  ].map(([id, title, d, pt]) => ({
    id: `steam:${id}`, appid: String(id), title, source: 'steam', installed: true,
    lastPlayed: now - d * day, playtime: pt, art: steamArt(id), launch: { type: 'steam', appid: String(id) },
  }));
  const extra = [
    { id: 'epic:fallguys', title: 'Fall Guys', source: 'epic', lastPlayed: now - 4 * day, playtime: 600, art: steamArt(1097150) },
    { id: 'gog:witcher3', title: 'The Witcher 3', source: 'gog', lastPlayed: now - 80 * day, playtime: 9000, art: steamArt(292030) },
    { id: 'custom:mijn-game', title: 'Mijn Eigen Game', source: 'custom', lastPlayed: 0, playtime: 0, art: { cover: [], hero: [], logo: [] } },
    { id: 'custom:retroarch', title: 'RetroArch', source: 'custom', lastPlayed: now - 30 * day, playtime: 0, art: steamArt(1118310) },
    { id: 'modrinth:abc', title: 'Survival met vrienden', source: 'modrinth', minecraft: true, lastPlayed: now - 0.5 * day, playtime: 0, art: { cover: [], hero: ['img/mc-hero.jpg'], logo: [], icon: [] } },
    { id: 'modrinth:def', title: 'Create Mod 1.21', source: 'modrinth', minecraft: true, lastPlayed: now - 6 * day, playtime: 0, art: { cover: [], hero: ['img/mc-hero.jpg'], logo: [], icon: [] } },
  ].map((g) => ({ installed: true, launch: { type: 'custom', cmd: 'true' }, ...g }));
  const games = [...steam, ...extra];

  let cfg = {
  theme: 'space', bgStyle: 'art', tiles: 'normal', titles: false, text: 'normal',
  clock12: false, showDate: false, battPct: true, greeting: true, reduceMotion: false,
  soundStyle: 'soft', uiVolume: 70, pad: 'auto', swapAB: false, navSpeed: 'normal', rumble: true,
  startTab: 'home', homeRow: 'recent', hidden: [], screensaver: 5, autoSleep: 0, lowBattery: true,
  lang: 'auto', accent: '#2aa8e8', sounds: true, ambient: true, intro: true, perf: false, name: '', favorites: ['steam:413150', 'steam:367520'], recent: {} };
  try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem('randomos-demo') || '{}') }; } catch {}
  const saveCfg = () => { try { localStorage.setItem('randomos-demo', JSON.stringify(cfg)); } catch {} };

  let gameCb = () => {};
  let running = null;
  let vol = 62, bright = 80, muted = false, wifiOn = true, btOn = true;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  window.nova = {
    isReal: false,
    games: {
      list: async () => games.map((g) => ({ ...g, favorite: cfg.favorites.includes(g.id), lastPlayed: Math.max(g.lastPlayed, cfg.recent[g.id] || 0) })),
      launch: async (g) => {
        cfg.recent[g.id] = Date.now(); saveCfg();
        running = { id: g.id, title: g.title, phase: 'launching' };
        gameCb(running);
        setTimeout(() => { if (running) { running = { ...running, phase: 'running' }; gameCb(running); } }, 2500);
        setTimeout(() => { if (running && running.id === g.id) { running = null; gameCb(null); } }, 7000);
        return { ok: true };
      },
      stop: async () => { running = null; gameCb(null); return { ok: true }; },
      showShell: async () => ({ ok: true }),
      resume: async () => ({ ok: true }),
      state: async () => running,
    },
    customSounds: async () => ({ dir: '~/.config/randomos/sounds', sounds: {} }),
    profile: async () => ({ name: cfg.name || t('Speler'), avatar: null }),
    settings: { get: async () => ({ ...cfg }), set: async (p) => { cfg = { ...cfg, ...p }; saveCfg(); return { ...cfg }; } },
    sys: {
      status: async () => ({
        battery: { level: 76, status: 'Discharging' },
        wifi: { available: true, enabled: wifiOn, ssid: wifiOn ? 'Thuisnetwerk' : null, signal: 78 },
        volume: { available: true, level: vol, muted },
        brightness: { available: true, level: bright },
        bluetooth: { available: true, enabled: btOn },
      }),
      info: async () => ({ os: 'RandomOS (demo)', image: 'ghcr.io/djmulderdaan-cmyk/randomos:latest', base: 'bazzite-deck', kernel: '6.17.7-ba01.fc43', cpu: 'Intel Core i5-1334U', gpu: ['Intel Iris Xe Graphics'], ram: '8 GB', disk: '182 GB vrij van 237 GB', host: 'randomos' }),
      volume: async (v) => { vol = v; muted = false; return { available: true, level: vol, muted }; },
      mute: async () => { muted = !muted; return { available: true, level: vol, muted }; },
      brightness: async (v) => { bright = v; return { available: true, level: bright }; },
      wifiList: async () => { await wait(900); return wifiOn ? [
        { ssid: 'Thuisnetwerk', signal: 78, secure: true, active: true, known: true },
        { ssid: 'Thuisnetwerk-5G', signal: 64, secure: true, active: false, known: false },
        { ssid: 'Buren_WiFi', signal: 41, secure: true, active: false, known: false },
        { ssid: 'Gratis Hotspot', signal: 22, secure: false, active: false, known: false },
      ] : []; },
      wifiConnect: async (ssid, pw) => { await wait(1500); return pw === 'fout' ? { error: 'Verkeerd wachtwoord' } : { ok: true }; },
      wifiRadio: async (on) => { wifiOn = on; return { enabled: on }; },
      btPower: async (on) => { btOn = on; return { available: true, enabled: on }; },
      btDevices: async () => btOn ? [
        { mac: '11:22:33:44:55:66', name: 'Xbox Wireless Controller', paired: true, connected: true },
        { mac: 'AA:BB:CC:DD:EE:FF', name: 'DualSense Wireless Controller', paired: true, connected: false },
      ] : [],
      btScan: async () => { await wait(2000); return [
        { mac: '11:22:33:44:55:66', name: 'Xbox Wireless Controller', paired: true, connected: true },
        { mac: 'AA:BB:CC:DD:EE:FF', name: 'DualSense Wireless Controller', paired: true, connected: false },
        { mac: '12:34:56:78:9A:BC', name: 'JBL Flip 6', paired: false, connected: false },
      ]; },
      btConnect: async () => { await wait(1500); return { ok: true }; },
      btDisconnect: async () => ({ ok: true }),
      power: async (a) => { toast(t('Demo: "{a}" zou nu uitgevoerd worden', { a }), { icon: 'power' }); return { ok: true }; },
      steamStatus: async () => ({ running: true, loggedIn: !/steam-uit/.test(location.hash), signInOpen: false }),
      steamLogin: async () => ({ ok: true }),
      focusShell: async () => ({ ok: true }),
      perfOverlay: async (l) => ({ available: true, level: l }),
      perfAvailable: async () => ({ available: true }),
      openSteam: async () => { toast(t('Demo: Steam Big Picture zou nu openen'), { icon: 'steam' }); return { ok: true }; },
    },
    onGameState: (cb) => { gameCb = cb; },
    onSteamState: () => {},
    updates: (() => {
      let progressCb = () => {}; let staged = null;
      return {
        status: async () => ({ available: true, image: 'ghcr.io/djmulderdaan-cmyk/randomos:latest', version: '45.20261119.0', date: new Date().toISOString(), staged }),
        check: async () => { await wait(1500); return staged ? { available: false } : { available: true, version: '45.20261120.0' }; },
        upgrade: async () => {
          for (const l of ['Pulling manifest', 'Fetching layer 1/12', 'Fetching layer 6/12', 'Fetching layer 12/12', 'Staging deployment...done']) { progressCb(l); await wait(700); }
          staged = { version: '45.20261120.0', date: new Date().toISOString() };
          return { ok: true, staged: true };
        },
        rollback: async () => ({ ok: true }),
        onProgress: (cb) => { progressCb = cb; },
      };
    })(),
  };
}
