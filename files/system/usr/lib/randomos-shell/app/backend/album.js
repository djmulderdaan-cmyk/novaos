// Screenshots: maken via gamescope en een album met eigen + Steam-screenshots.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const HOME = os.homedir();
const DIR = path.join(HOME, 'Pictures', 'RandomOS');
const GS_FILE = '/tmp/gamescope.png'; // hier zet gamescope een screenshot neer
const STEAM_USERDATA = [
  path.join(HOME, '.local/share/Steam/userdata'),
  path.join(HOME, '.var/app/com.valvesoftware.Steam/.local/share/Steam/userdata'),
];

const fileUrl = (p) => 'file://' + p.split('/').map(encodeURIComponent).join('/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }

function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`;
}

/** Screenshot van wat gamescope nu laat zien. title = naam van de game (voor de bestandsnaam). */
async function take(title) {
  const before = mtime(GS_FILE);
  const ok = await new Promise((resolve) => {
    execFile('xprop', ['-root', '-f', 'GAMESCOPECTRL_REQUEST_SCREENSHOT', '32c', '-set', 'GAMESCOPECTRL_REQUEST_SCREENSHOT', '1'], { timeout: 3000 }, (err) => resolve(!err));
  });
  if (!ok) return { error: 'Screenshot maken lukte niet' };
  // wachten tot gamescope het bestand heeft geschreven (en klaar is met schrijven)
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const m = mtime(GS_FILE);
    if (m && m !== before) {
      let size = 0;
      try { size = fs.statSync(GS_FILE).size; } catch {}
      if (size > 0 && size === last) break;
      last = size;
    }
    if (i === 39) return { error: 'Screenshot maken lukte niet' };
  }
  fs.mkdirSync(DIR, { recursive: true });
  const safe = String(title || 'RandomOS').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'RandomOS';
  const dest = path.join(DIR, `${safe}_${stamp()}.png`);
  try { fs.copyFileSync(GS_FILE, dest); fs.rmSync(GS_FILE, { force: true }); } catch { return { error: 'Opslaan lukte niet' }; }
  console.log('[album] screenshot', dest);
  return { ok: true, file: dest };
}

function steamShots() {
  const out = [];
  for (const base of STEAM_USERDATA) {
    let users = [];
    try { users = fs.readdirSync(base); } catch { continue; }
    for (const u of users) {
      const remote = path.join(base, u, '760', 'remote');
      let apps = [];
      try { apps = fs.readdirSync(remote); } catch { continue; }
      for (const appid of apps) {
        const dir = path.join(remote, appid, 'screenshots');
        let files = [];
        try { files = fs.readdirSync(dir); } catch { continue; }
        for (const f of files) if (/\.(jpe?g|png)$/i.test(f)) out.push({ path: path.join(dir, f), appid, source: 'steam' });
      }
    }
  }
  return out;
}

/** Alle screenshots, nieuwste eerst. */
function list() {
  const items = [];
  try {
    for (const f of fs.readdirSync(DIR)) {
      if (!/\.(png|jpe?g)$/i.test(f)) continue;
      const m = f.match(/^(.+)_\d{4}-\d{2}-\d{2}_/);
      items.push({ path: path.join(DIR, f), game: m ? m[1].replace(/-/g, ' ') : null, source: 'randomos' });
    }
  } catch {}
  items.push(...steamShots());
  for (const it of items) { it.date = mtime(it.path); it.url = fileUrl(it.path); }
  return items.sort((a, b) => b.date - a.date).slice(0, 300);
}

/** Foto's voor de achtergrond: ~/Pictures (en mapjes daarin) plus alle screenshots. */
function pictures() {
  const base = path.join(HOME, 'Pictures');
  const out = [];
  const add = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const en of entries) {
      const p = path.join(dir, en.name);
      if (en.isDirectory() && depth < 2 && !en.name.startsWith('.')) add(p, depth + 1);
      else if (en.isFile() && /\.(png|jpe?g|webp)$/i.test(en.name)) out.push({ path: p, url: fileUrl(p), date: mtime(p), game: path.basename(en.name).replace(/\.[^.]+$/, '') });
    }
  };
  add(base, 0);
  const seen = new Set(out.map((x) => x.path));
  for (const s of list()) if (!seen.has(s.path)) out.push(s);
  return out.sort((a, b) => b.date - a.date).slice(0, 300);
}

/** Verwijderen: alleen bestanden uit onze eigen map of Steams screenshot-mappen. */
function remove(p) {
  const real = path.resolve(String(p || ''));
  const allowed = real.startsWith(DIR + path.sep) || STEAM_USERDATA.some((b) => real.startsWith(b + path.sep) && real.includes(`${path.sep}760${path.sep}remote${path.sep}`));
  if (!allowed || !/\.(png|jpe?g)$/i.test(real)) return { error: 'Niet gevonden' };
  try { fs.rmSync(real); } catch { return { error: 'Verwijderen lukte niet' }; }
  // Steam-thumbnail ook weg
  try { fs.rmSync(path.join(path.dirname(real), 'thumbnails', path.basename(real)), { force: true }); } catch {}
  return { ok: true };
}

module.exports = { take, list, remove, pictures, DIR };
