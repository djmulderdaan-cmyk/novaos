// Steam-games die je hebt (gekocht of gratis toegevoegd) maar nog niet hebt geïnstalleerd.
// Gelezen uit Steams eigen cache, alleen lezen:
//   appcache/packageinfo.vdf -> je licenties (pakketten) en welke apps daarin zitten
//   appcache/appinfo.vdf     -> naam en soort (game, demo, tool, dlc) van elke app
const fs = require('fs');
const path = require('path');

let cached = { key: '', result: [] };

// Binaire KeyValues; bij appinfo v29 zijn de sleutels nummers in een tekstentabel
function kv(buf, start, strings) {
  let i = start;
  const obj = () => {
    const out = {};
    for (;;) {
      const t = buf[i++];
      if (t === 8 || t === 11) return out;
      let key;
      if (strings) { key = strings[buf.readUInt32LE(i)]; i += 4; } else { const e = buf.indexOf(0, i); key = buf.toString('utf8', i, e); i = e + 1; }
      switch (t) {
        case 0: out[key] = obj(); break;
        case 1: { const e = buf.indexOf(0, i); out[key] = buf.toString('utf8', i, e); i = e + 1; break; }
        case 2: case 4: case 6: out[key] = buf.readInt32LE(i); i += 4; break;
        case 3: out[key] = buf.readFloatLE(i); i += 4; break;
        case 7: case 10: out[key] = Number(buf.readBigInt64LE(i)); i += 8; break;
        default: throw new Error(`onbekend type ${t}`);
      }
    }
  };
  const value = obj();
  return { value, end: i };
}

function readAppinfo(file) {
  const buf = fs.readFileSync(file);
  const magic = buf.readUInt32LE(0);
  let i = 8;
  let strings = null;
  if (magic === 0x07564429) { // v29: tekstentabel achteraan
    const off = Number(buf.readBigInt64LE(8));
    i = 16;
    const n = buf.readUInt32LE(off);
    let j = off + 4;
    strings = new Array(n);
    for (let k = 0; k < n; k++) { const e = buf.indexOf(0, j); strings[k] = buf.toString('utf8', j, e); j = e + 1; }
  } else if (magic !== 0x07564428 && magic !== 0x07564427) {
    throw new Error('onbekende appinfo-versie');
  }
  const apps = new Map();
  for (;;) {
    const appid = buf.readUInt32LE(i); i += 4;
    if (appid === 0) break;
    const size = buf.readUInt32LE(i); i += 4;
    const next = i + size;
    // infostate, last_updated, token, sha1, change_number, binary sha1
    const skip = magic === 0x07564427 ? 4 + 4 + 8 + 20 + 4 : 4 + 4 + 8 + 20 + 4 + 20;
    try {
      const { value } = kv(buf, i + skip, strings);
      const info = value.appinfo || value;
      const c = info.common || {};
      apps.set(appid, { name: c.name, type: String(c.type || '').toLowerCase() });
    } catch {}
    i = next;
  }
  return apps;
}

function readPackages(file) {
  const buf = fs.readFileSync(file);
  const magic = buf.readUInt32LE(0);
  let i = 8;
  const owned = new Set();
  for (;;) {
    const pid = buf.readUInt32LE(i); i += 4;
    if (pid === 0xFFFFFFFF) break;
    i += 20 + 4 + (magic >= 0x06565528 ? 8 : 0);
    const { value, end } = kv(buf, i, null);
    i = end;
    if (pid === 0) continue; // pakket 0 = gratis spullen die iedereen heeft (oude demo's, Spacewar)
    const pkg = value[String(pid)] || value;
    for (const a of Object.values(pkg.appids || {})) owned.add(Number(a));
  }
  return owned;
}

/**
 * Games/demo's die je hebt maar niet geïnstalleerd zijn.
 * installedIds: Set met appids (strings) die al geïnstalleerd zijn.
 */
function notInstalled(root, installedIds, skipIds = new Set()) {
  const ai = path.join(root, 'appcache', 'appinfo.vdf');
  const pi = path.join(root, 'appcache', 'packageinfo.vdf');
  let key;
  try { key = `${fs.statSync(ai).mtimeMs}|${fs.statSync(pi).mtimeMs}`; } catch { return []; }
  let all;
  if (cached.key === key) all = cached.result;
  else {
    try {
      const apps = readAppinfo(ai);
      const owned = readPackages(pi);
      all = [];
      for (const id of owned) {
        const a = apps.get(id);
        if (!a || !a.name || !['game', 'demo'].includes(a.type)) continue;
        all.push({ appid: String(id), name: a.name.trim(), type: a.type });
      }
    } catch (e) { console.error('[steamowned]', e.message); all = []; }
    cached = { key, result: all };
  }
  return all.filter((g) => !installedIds.has(g.appid) && !skipIds.has(g.appid));
}

module.exports = { notInstalled, readAppinfo, readPackages };
