// Zoekt geïnstalleerde games: Steam, Heroic (Epic/GOG/Amazon) en eigen games.
const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('./settings');
const { execFileSync } = require('child_process');

const HOME = os.homedir();

const STEAM_ROOTS = [
  path.join(HOME, '.local/share/Steam'),
  path.join(HOME, '.steam/steam'),
  path.join(HOME, '.var/app/com.valvesoftware.Steam/.local/share/Steam'),
];

const HEROIC_ROOTS = [
  { dir: path.join(HOME, '.config/heroic'), flatpak: false },
  { dir: path.join(HOME, '.var/app/com.heroicgameslauncher.hgl/config/heroic'), flatpak: true },
];

// Tools die Steam als "game" installeert maar die je niet wilt zien
const STEAM_SKIP = /^(Proton|Steam Linux Runtime|Steamworks Common|SteamVR|Steam Audio|Steam Controller Configs)/i;
const STEAM_SKIP_IDS = new Set(['228980', '1070560', '1391110', '1628350', '1493710', '2180100', '961940', '1420170', '1887720', '1826330', '2348590', '2805730', '3658110']);

const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const fileUrl = (p) => 'file://' + p.split('/').map(encodeURIComponent).join('/');

function vdfValue(text, key) {
  const m = text.match(new RegExp(`"${key}"\\s+"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function steamRoot() {
  return STEAM_ROOTS.find((p) => exists(path.join(p, 'steamapps')));
}

function steamLibraries(root) {
  const set = new Set([root]);
  const text = readText(path.join(root, 'steamapps', 'libraryfolders.vdf'));
  if (text) for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) set.add(m[1].replace(/\\\\/g, '\\'));
  return [...set];
}

function findFile(dir, name, depth) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) if (e.isFile() && e.name === name) return path.join(dir, e.name);
  if (depth > 0) for (const e of entries) {
    if (e.isDirectory()) { const r = findFile(path.join(dir, e.name), name, depth - 1); if (r) return r; }
  }
  return null;
}

const CDN = [
  (id, f) => `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/${f}`,
  (id, f) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/${f}`,
];

// Geeft per soort plaatje een lijst URLs (lokaal eerst, dan internet) zodat de UI kan terugvallen
function steamArt(root, appid) {
  const lc = path.join(root, 'appcache', 'librarycache');
  const kinds = {
    cover: ['library_600x900.jpg', 'library_600x900_2x.jpg', 'library_capsule.jpg'],
    hero: ['library_hero.jpg'],
    logo: ['logo.png', 'logo_2x.png'],
    header: ['header.jpg'],
  };
  const out = {};
  for (const [kind, names] of Object.entries(kinds)) {
    const urls = [];
    for (const n of names) {
      const flat = path.join(lc, `${appid}_${n}`);
      const nested = exists(flat) ? flat : findFile(path.join(lc, String(appid)), n, 2);
      if (nested) urls.push(fileUrl(nested));
    }
    for (const n of names) for (const c of CDN) urls.push(c(appid, n));
    out[kind] = [...new Set(urls)];
  }
  return out;
}

function steamPlaytime(root) {
  // minuten gespeeld per appid uit localconfig.vdf (beste poging)
  const result = {};
  let users;
  try { users = fs.readdirSync(path.join(root, 'userdata')); } catch { return result; }
  for (const u of users) {
    const text = readText(path.join(root, 'userdata', u, 'config', 'localconfig.vdf'));
    if (!text) continue;
    for (const m of text.matchAll(/"(\d+)"\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
      const pt = m[2].match(/"Playtime"\s+"(\d+)"/);
      if (pt) result[m[1]] = Math.max(result[m[1]] || 0, Number(pt[1]));
    }
  }
  return result;
}

function listSteam() {
  const root = steamRoot();
  if (!root) return [];
  const playtime = steamPlaytime(root);
  const games = [];
  const seen = new Set();
  for (const lib of steamLibraries(root)) {
    const dir = path.join(lib, 'steamapps');
    let files;
    try { files = fs.readdirSync(dir).filter((f) => /^appmanifest_\d+\.acf$/.test(f)); } catch { continue; }
    for (const f of files) {
      const text = readText(path.join(dir, f));
      if (!text) continue;
      const appid = vdfValue(text, 'appid');
      const name = vdfValue(text, 'name');
      if (!appid || !name || seen.has(appid) || STEAM_SKIP_IDS.has(appid) || STEAM_SKIP.test(name)) continue;
      seen.add(appid);
      const flags = Number(vdfValue(text, 'StateFlags') || 4);
      games.push({
        id: `steam:${appid}`,
        appid,
        title: name,
        source: 'steam',
        installed: (flags & 4) === 4,
        updating: (flags & 2) === 2 || (flags & 1024) === 1024,
        lastPlayed: Number(vdfValue(text, 'LastPlayed') || 0) * 1000,
        playtime: playtime[appid] || 0,
        sizeBytes: Number(vdfValue(text, 'SizeOnDisk') || 0),
        art: steamArt(root, appid),
        launch: { type: 'steam', appid },
      });
    }
  }
  return games;
}

// ---------------------------------------------------------------- niet-Steam-games
// Steam bewaart "Een niet-Steam-game toevoegen" in userdata/<id>/config/shortcuts.vdf (binair VDF)
function parseBinaryVdf(buf) {
  let i = 0;
  const readStr = () => { const end = buf.indexOf(0, i); const str = buf.toString('utf8', i, end); i = end + 1; return str; };
  const readMap = () => {
    const obj = {};
    while (i < buf.length) {
      const type = buf[i++];
      if (type === 0x08) return obj;
      const key = readStr();
      if (type === 0x00) obj[key] = readMap();
      else if (type === 0x01) obj[key] = readStr();
      else if (type === 0x02) { obj[key] = buf.readUInt32LE(i); i += 4; }
      else if (type === 0x07) { obj[key] = buf.readBigUInt64LE(i); i += 8; }
      else return obj; // onbekend type: stoppen
    }
    return obj;
  };
  return readMap();
}

function listSteamShortcuts() {
  const root = steamRoot();
  if (!root) return [];
  let users;
  try { users = fs.readdirSync(path.join(root, 'userdata')).filter((u) => /^\d+$/.test(u)); } catch { return []; }
  const out = [];
  const seen = new Set();
  for (const u of users) {
    const file = path.join(root, 'userdata', u, 'config', 'shortcuts.vdf');
    let data;
    try { data = parseBinaryVdf(fs.readFileSync(file)); } catch { continue; }
    const list = data.shortcuts || data.Shortcuts || {};
    for (const sc of Object.values(list)) {
      if (!sc || typeof sc !== 'object') continue;
      const name = sc.AppName || sc.appname || sc.appName;
      const appid = Number(sc.appid ?? sc.AppId ?? 0) >>> 0;
      if (!name || !appid || seen.has(appid)) continue;
      seen.add(appid);
      const gameid = ((BigInt(appid) << 32n) | 0x02000000n).toString();
      const grid = path.join(root, 'userdata', u, 'config', 'grid');
      const art = (names) => names.map((n) => path.join(grid, n)).filter(exists).map(fileUrl);
      const exts = (base) => ['png', 'jpg', 'jpeg', 'webp'].map((e) => `${base}.${e}`);
      const icon = sc.icon && exists(sc.icon.replace(/^"|"$/g, '')) ? [fileUrl(sc.icon.replace(/^"|"$/g, ''))] : [];
      out.push({
        id: `steamshortcut:${appid}`,
        appid: String(appid),
        title: name,
        source: 'custom',
        installed: true,
        lastPlayed: Number(sc.LastPlayTime || 0) * 1000,
        playtime: 0,
        art: { cover: art(exts(`${appid}p`)), hero: art(exts(`${appid}_hero`)), logo: art(exts(`${appid}_logo`)), header: [...art(exts(String(appid))), ...icon] },
        launch: { type: 'steamshortcut', appid: String(appid), gameid },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Modrinth (Minecraft-instances)
// De Modrinth App bewaart instances in een SQLite-database (app.db). Elke instance wordt een eigen tegel.
const MODRINTH_DIRS = [
  { dir: path.join(HOME, '.var/app/com.modrinth.ModrinthApp/data/ModrinthApp'), flatpak: true },
  { dir: path.join(HOME, '.local/share/ModrinthApp'), flatpak: false },
];

function listModrinth() {
  const out = [];
  let sqlite;
  try { sqlite = require('node:sqlite'); } catch { return out; }
  for (const { dir, flatpak } of MODRINTH_DIRS) {
    const file = path.join(dir, 'app.db');
    if (!exists(file)) continue;
    let db;
    try { db = new sqlite.DatabaseSync(file, { readOnly: true }); } catch { continue; }
    let rows = [];
    try { rows = db.prepare('SELECT id, path, name, icon_path, last_played FROM instances').all(); }
    catch {
      // oudere Modrinth-versies: tabel "profiles", id = map-naam
      try { rows = db.prepare('SELECT path AS id, path, name, icon_path, last_played FROM profiles').all(); } catch {}
    }
    try { db.close(); } catch {}
    for (const r of rows) {
      if (!r || !r.name || !r.id) continue;
      const icon = r.icon_path && exists(String(r.icon_path)) ? [fileUrl(String(r.icon_path))] : [];
      const lp = Number(r.last_played || 0);
      out.push({
        id: `modrinth:${r.id}`,
        title: String(r.name),
        source: 'modrinth',
        installed: true,
        minecraft: true,
        lastPlayed: lp > 1e12 ? lp : lp * 1000,
        playtime: 0,
        art: { cover: [], hero: ['img/mc-hero.jpg'], logo: [], header: [], icon },
        launch: { type: 'modrinth', instanceId: String(r.id), flatpak },
      });
    }
  }
  return out;
}

function listHeroic() {
  const games = [];
  for (const { dir, flatpak } of HEROIC_ROOTS) {
    if (!exists(dir)) continue;
    const stores = [
      { file: 'legendary_library.json', key: 'library', runner: 'legendary', source: 'epic' },
      { file: 'gog_library.json', key: 'games', runner: 'gog', source: 'gog' },
      { file: 'nile_library.json', key: 'library', runner: 'nile', source: 'amazon' },
    ];
    for (const s of stores) {
      const j = readJSON(path.join(dir, 'store_cache', s.file));
      const list = Array.isArray(j) ? j : (j && j[s.key]) || [];
      for (const g of list) {
        if (!g || !g.is_installed || !g.app_name) continue;
        const cover = [g.art_square, g.art_cover].filter(Boolean);
        games.push({
          id: `${s.source}:${g.app_name}`,
          title: g.title || g.app_name,
          source: s.source,
          installed: true,
          lastPlayed: 0,
          playtime: 0,
          art: {
            cover,
            hero: [g.art_background, g.art_cover].filter(Boolean),
            logo: [g.art_logo].filter(Boolean),
            header: [g.art_cover].filter(Boolean),
          },
          launch: { type: 'heroic', runner: s.runner, app: g.app_name, flatpak },
        });
      }
    }
  }
  return games;
}

// Is dit een Unity-game? (UnityPlayer.dll naast de .exe die in het commando staat)
function detectUnity(cmd) {
  const paths = [...String(cmd).matchAll(/"([^"]+\.exe)"|(\S+\.exe)/gi)].map((m) => (m[1] || m[2]));
  for (let p of paths) {
    p = p.replace(/^\$HOME|^~/, HOME).replace(/\$\{HOME\}/, HOME).replace(/\\\$HOME/, HOME);
    if (exists(path.join(path.dirname(p), 'UnityPlayer.dll'))) return true;
  }
  return false;
}

// Eigen games: ~/.config/randomos/games.json
// [{ "name": "Mijn game", "cmd": "/pad/naar/game.sh", "cover": "/pad/naar/cover.jpg", "hero": "..." }]
function listCustom() {
  const list = readJSON(path.join(settings.DIR, 'games.json'));
  if (!Array.isArray(list)) return [];
  return list.filter((g) => g && g.name && g.cmd).map((g) => {
    const slug = g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const img = (p) => (!p ? [] : /^https?:/.test(p) ? [p] : [fileUrl(p.replace(/^~/, HOME))]);
    return {
      id: `custom:${slug}`,
      title: g.name,
      source: 'custom',
      installed: true,
      lastPlayed: 0,
      playtime: 0,
      art: { cover: img(g.cover), hero: img(g.hero || g.cover), logo: img(g.logo), header: [], icon: img(g.icon) },
      // Unity-games, en Windows-games via umu/Proton (vaak alleen toetsenbord/muis)
      unity: detectUnity(g.cmd) || /\bumu-run\b|\.exe\b/i.test(g.cmd),
      launch: { type: 'custom', cmd: g.cmd, windowClass: g.windowClass || null },
    };
  });
}

function listAll() {
  const s = settings.load();
  const all = [...listSteam(), ...listSteamShortcuts(), ...listModrinth(), ...listHeroic(), ...listCustom()];
  for (const g of all) {
    if (s.recent[g.id]) g.lastPlayed = Math.max(g.lastPlayed, s.recent[g.id]);
    if (g.source !== 'steam' && s.playtime && s.playtime[g.id]) g.playtime = (g.playtime || 0) + Math.round(s.playtime[g.id]);
    g.favorite = s.favorites.includes(g.id);
    const pm = (s.padMap || {})[g.id];
    g.padMap = pm === undefined ? !!g.unity : !!pm;
  }
  return all.filter((g) => g.installed);
}

function profile() {
  const s = settings.load();
  const root = steamRoot();
  let name = s.name || '';
  let avatar = null;
  const pid = settings.currentProfileId ? settings.currentProfileId() : 'main';
  if (pid !== 'main') {
    const me = settings.listProfiles().find((p) => p.current);
    return { name: name || 'Speler', avatar: null, color: me ? me.color : null, profileId: pid };
  }
  if (root) {
    const text = readText(path.join(root, 'config', 'loginusers.vdf')) || '';
    const blocks = [...text.matchAll(/"(\d{17})"\s*\{([^}]*)\}/g)];
    const pick = blocks.find((b) => /"MostRecent"\s+"1"/.test(b[2])) || blocks[0];
    if (pick) {
      if (!name) name = vdfValue(pick[2], 'PersonaName') || '';
      const av = path.join(root, 'config', 'avatarcache', `${pick[1]}.png`);
      if (exists(av)) avatar = fileUrl(av);
    }
  }
  return { name: name || os.userInfo().username, avatar };
}

// ---------------------------------------------------------------- installeren: wat je hebt + gratis lijst
const TOOL_DEMOS = /3DMark|Soundpad|Benchmark|Wallpaper/i;
function catalog() {
  const root = steamRoot();
  if (!root) return { notInstalled: [], free: [] };
  const present = new Set(listSteam().map((g) => String(g.appid))); // geïnstalleerd of bezig met downloaden
  let owned = [];
  try { owned = require('./steamowned').notInstalled(root, present, STEAM_SKIP_IDS); } catch {}
  owned = owned.filter((g) => !TOOL_DEMOS.test(g.name) && !STEAM_SKIP.test(g.name));
  const ownedIds = new Set(owned.map((g) => g.appid));
  const mk = (appid, name, extra) => ({ id: `steam:${appid}`, appid, title: name, source: 'steam', installed: false, notInstalled: true,
    lastPlayed: 0, playtime: 0, art: steamArt(root, appid), launch: { type: 'steam', appid }, ...extra });
  const { CATALOG } = require('./freegames');
  return {
    notInstalled: owned.map((g) => mk(g.appid, g.name, { kind: g.type === 'demo' ? 'demo' : 'owned', owned: true }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    free: CATALOG.filter((c) => !present.has(c.appid)).map((c) => mk(c.appid, c.name, { kind: c.kind, genre: c.genre, pad: !!c.pad, owned: ownedIds.has(c.appid) })),
  };
}

// ---------------------------------------------------------------- Steam-downloads
/** Steam-games die nu downloaden of updaten (uit de appmanifests), met voortgang. */
function listDownloads() {
  const root = steamRoot();
  if (!root) return [];
  const out = [];
  for (const lib of steamLibraries(root)) {
    const dir = path.join(lib, 'steamapps');
    let files;
    try { files = fs.readdirSync(dir).filter((f) => /^appmanifest_\d+\.acf$/.test(f)); } catch { continue; }
    for (const f of files) {
      const text = readText(path.join(dir, f));
      if (!text) continue;
      const appid = vdfValue(text, 'appid');
      const name = vdfValue(text, 'name');
      if (!appid || !name || STEAM_SKIP_IDS.has(appid) || STEAM_SKIP.test(name)) continue;
      const flags = Number(vdfValue(text, 'StateFlags') || 4);
      const total = Number(vdfValue(text, 'BytesToDownload') || 0);
      const done = Number(vdfValue(text, 'BytesDownloaded') || 0);
      const busy = (flags & 4) !== 4 || (flags & 1024) === 1024 || (flags & 2) === 2;
      if (!busy || !total || done >= total) continue;
      out.push({ appid, title: name.trim(), total, done, pct: Math.max(0, Math.min(100, Math.floor((done / total) * 100))), update: (flags & 4) === 4 });
    }
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// ---------------------------------------------------------------- apps (flatpak) toevoegen
const CUSTOM_FILE = path.join(settings.DIR, 'games.json');
const FLATPAK_EXPORTS = [path.join(HOME, '.local/share/flatpak/exports/share'), '/var/lib/flatpak/exports/share'];
// launchers die al een eigen bron hebben, en systeemhulpjes die geen "app op de tv" zijn
const APP_SKIP = new Set(['com.valvesoftware.Steam', 'com.modrinth.ModrinthApp', 'com.heroicgameslauncher.hgl', 'com.github.tchx84.Flatseal',
  'io.github.flattool.Warehouse', 'org.gnome.Firmware', 'io.github.DenysMb.Kontainer', 'com.vysp3r.ProtonPlus', 'com.github.Matoking.protontricks']);

function desktopInfo(id) {
  for (const base of FLATPAK_EXPORTS) {
    const text = readText(path.join(base, 'applications', `${id}.desktop`));
    if (!text) continue;
    const main = text.split(/\n\[(?!Desktop Entry)/)[0];
    const get = (k) => { const m = main.match(new RegExp(`^${k}=(.*)$`, 'm')); return m ? m[1].trim() : ''; };
    if (get('NoDisplay') === 'true') return null;
    return { name: get('Name'), wmClass: get('StartupWMClass'), icon: get('Icon') || id };
  }
  return null;
}

function iconPath(icon) {
  if (!icon) return null;
  if (icon.startsWith('/')) return exists(icon) ? icon : null;
  for (const base of FLATPAK_EXPORTS) {
    for (const size of ['512x512', '256x256', 'scalable', '192x192', '128x128', '96x96', '64x64', '48x48']) {
      for (const ext of ['png', 'svg']) {
        const p = path.join(base, 'icons', 'hicolor', size, 'apps', `${icon}.${ext}`);
        if (exists(p)) return p;
      }
    }
  }
  return null;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Geïnstalleerde flatpak-apps die nog niet in de bibliotheek staan. */
function listApps() {
  let out = '';
  try { out = execFileSync('flatpak', ['list', '--app', '--columns=application,name'], { timeout: 8000 }).toString(); } catch { return []; }
  const custom = readJSON(CUSTOM_FILE);
  const taken = JSON.stringify(Array.isArray(custom) ? custom.map((g) => g && g.cmd) : []);
  const seen = new Set();
  const apps = [];
  for (const line of out.split('\n')) {
    const [id, name] = line.split('\t');
    if (!id || seen.has(id) || APP_SKIP.has(id) || !/^[\w.-]+$/.test(id)) continue;
    seen.add(id);
    if (taken.includes(id)) continue;
    const d = desktopInfo(id);
    if (!d) continue;
    const icon = iconPath(d.icon);
    apps.push({ id, name: d.name || name || id, wmClass: d.wmClass || '', icon: icon ? fileUrl(icon) : null, iconPath: icon });
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

function writeCustom(list) {
  fs.mkdirSync(settings.DIR, { recursive: true });
  if (exists(CUSTOM_FILE)) { try { fs.copyFileSync(CUSTOM_FILE, CUSTOM_FILE + '.bak'); } catch {} }
  const tmp = CUSTOM_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, CUSTOM_FILE);
}

/** Voeg een flatpak-app toe als tegel. Alleen ids uit listApps() (nooit een vrij commando). */
function addApp(id) {
  const app = listApps().find((a) => a.id === id);
  if (!app) return { error: 'App niet gevonden' };
  const list = readJSON(CUSTOM_FILE);
  const games = Array.isArray(list) ? list : [];
  // vensters herkennen aan de WM-klasse uit het .desktop-bestand, of aan het app-id
  const classes = [app.wmClass, id, id.split('.').pop()].filter(Boolean).map(escRe);
  games.push({ name: app.name, cmd: `flatpak run ${id}`, windowClass: `(${[...new Set(classes)].join('|')})`, icon: app.iconPath || undefined, cover: undefined });
  writeCustom(games);
  return { ok: true, name: app.name };
}

/** Verwijder een eigen tegel (alleen uit games.json; de app/game zelf blijft geïnstalleerd). */
function removeCustom(gameId) {
  const list = readJSON(CUSTOM_FILE);
  if (!Array.isArray(list)) return { error: 'Niet gevonden' };
  const slug = (n) => `custom:${String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const next = list.filter((g) => !(g && g.name && slug(g.name) === gameId));
  if (next.length === list.length) return { error: 'Niet gevonden' };
  writeCustom(next);
  return { ok: true };
}

module.exports = { listAll, profile, steamRoot, listApps, addApp, removeCustom, listDownloads, catalog };
