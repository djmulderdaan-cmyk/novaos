// Zoekt geïnstalleerde games: Steam, Heroic (Epic/GOG/Amazon) en eigen games.
const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('./settings');

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
      art: { cover: img(g.cover), hero: img(g.hero || g.cover), logo: img(g.logo), header: [] },
      launch: { type: 'custom', cmd: g.cmd, windowClass: g.windowClass || null },
    };
  });
}

function listAll() {
  const s = settings.load();
  const all = [...listSteam(), ...listSteamShortcuts(), ...listHeroic(), ...listCustom()];
  for (const g of all) {
    if (s.recent[g.id]) g.lastPlayed = Math.max(g.lastPlayed, s.recent[g.id]);
    g.favorite = s.favorites.includes(g.id);
  }
  return all.filter((g) => g.installed);
}

function profile() {
  const s = settings.load();
  const root = steamRoot();
  let name = s.name || '';
  let avatar = null;
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

module.exports = { listAll, profile, steamRoot };
