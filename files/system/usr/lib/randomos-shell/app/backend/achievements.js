// Steam-prestaties (achievements), gelezen uit Steams eigen cache:
//   appcache/stats/UserGameStatsSchema_<appid>.bin      -> welke prestaties er zijn
//   appcache/stats/UserGameStats_<accountid>_<appid>.bin -> welke jij hebt (bitjes + datum)
// Beide zijn binaire KeyValues. Alleen lezen, nooit schrijven.
const fs = require('fs');
const path = require('path');

const ICON_CDN = 'https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps';
const STEAMID_BASE = 76561197960265728n;
const cache = new Map(); // bestand -> { mtime, data }

function parseKV(buf) {
  let i = 0;
  const str = () => { const end = buf.indexOf(0, i); const s = buf.toString('utf8', i, end); i = end + 1; return s; };
  const obj = () => {
    const out = {};
    while (i < buf.length) {
      const t = buf[i++];
      if (t === 8 || t === 11) return out;
      const key = str();
      switch (t) {
        case 0: out[key] = obj(); break;
        case 1: out[key] = str(); break;
        case 2: case 4: case 6: out[key] = buf.readInt32LE(i); i += 4; break;
        case 3: out[key] = buf.readFloatLE(i); i += 4; break;
        case 7: case 10: out[key] = Number(buf.readBigInt64LE(i)); i += 8; break;
        default: throw new Error(`onbekend type ${t}`);
      }
    }
    return out;
  };
  return obj();
}

function readKV(file) {
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const hit = cache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit.data;
  let data = null;
  try { data = parseKV(fs.readFileSync(file)); } catch { data = null; }
  cache.set(file, { mtime: st.mtimeMs, data });
  return data;
}

// Het Steam-account dat het laatst was ingelogd
function activeAccount(root) {
  try {
    const text = fs.readFileSync(path.join(root, 'config', 'loginusers.vdf'), 'utf8');
    let best = null;
    for (const m of text.matchAll(/"(\d{17})"\s*\{([^}]*)\}/g)) {
      const recent = /"MostRecent"\s*"1"/.test(m[2]);
      const ts = Number((m[2].match(/"Timestamp"\s*"(\d+)"/) || [])[1] || 0);
      if (!best || recent || (!best.recent && ts > best.ts)) best = { id: m[1], recent, ts };
      if (recent) break;
    }
    if (best) return String(BigInt(best.id) - STEAMID_BASE);
  } catch {}
  return null;
}

function pick(names, lang) {
  if (!names || typeof names !== 'object') return typeof names === 'string' ? names : '';
  return names[lang] || names.english || Object.values(names)[0] || '';
}

/** Alle prestaties van één game, met wat je al hebt. lang = 'dutch' of 'english'. */
function forGame(root, appid, lang = 'english') {
  const statsDir = path.join(root, 'appcache', 'stats');
  const schema = readKV(path.join(statsDir, `UserGameStatsSchema_${appid}.bin`));
  const game = schema && (schema[appid] || Object.values(schema)[0]);
  if (!game || !game.stats) return null;
  const account = activeAccount(root);
  const user = account ? readKV(path.join(statsDir, `UserGameStats_${account}_${appid}.bin`)) : null;
  const mine = (user && user.cache) || {};
  const list = [];
  for (const [statId, stat] of Object.entries(game.stats)) {
    if (!stat || !stat.bits) continue;
    const data = mine[statId] && typeof mine[statId].data === 'number' ? mine[statId].data >>> 0 : 0;
    const times = (mine[statId] && mine[statId].AchievementTimes) || {};
    for (const [bit, a] of Object.entries(stat.bits)) {
      const unlocked = ((data >>> Number(bit)) & 1) === 1;
      const d = a.display || {};
      list.push({
        id: a.name || `${statId}_${bit}`,
        name: pick(d.name, lang),
        desc: pick(d.desc, lang),
        hidden: Number(d.hidden) === 1,
        unlocked,
        time: unlocked && times[bit] ? times[bit] * 1000 : null,
        icon: d.icon ? `${ICON_CDN}/${appid}/${d.icon}` : null,
        iconGray: d.icon_gray ? `${ICON_CDN}/${appid}/${d.icon_gray}` : null,
      });
    }
  }
  if (!list.length) return null;
  list.sort((a, b) => (b.unlocked - a.unlocked) || ((b.time || 0) - (a.time || 0)));
  return { appid: String(appid), total: list.length, unlocked: list.filter((a) => a.unlocked).length, list };
}

/** Kort overzicht: { appid: { unlocked, total } } voor alle games met prestaties. */
function summary(root) {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(path.join(root, 'appcache', 'stats')); } catch { return out; }
  for (const f of files) {
    const m = f.match(/^UserGameStatsSchema_(\d+)\.bin$/);
    if (!m) continue;
    const r = forGame(root, m[1]);
    if (r) out[m[1]] = { unlocked: r.unlocked, total: r.total };
  }
  return out;
}

module.exports = { forGame, summary, parseKV, activeAccount };
