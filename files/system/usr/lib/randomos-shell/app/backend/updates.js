// Systeemupdates via rpm-ostree. Mag zonder wachtwoord vanuit de lokale, actieve sessie
// (polkit-regel van Bazzite voor org.projectatomic.rpmostree1.upgrade).
const { execFile, spawn } = require('child_process');

let busy = false;

function run(args, timeout = 120000) {
  return new Promise((resolve) => {
    execFile('rpm-ostree', args, { timeout, env: { ...process.env, LC_ALL: 'C' } }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || ''), err: String(stderr || (err && err.message) || ''), code: err && err.code });
    });
  });
}

function fmtDate(sec) {
  return sec ? new Date(sec * 1000).toISOString() : null;
}

// Huidige versie en of er al een update klaarstaat (wordt bij herstart geïnstalleerd)
async function status() {
  const r = await run(['status', '--json'], 20000);
  if (!r.ok) return { available: false, error: 'rpm-ostree niet beschikbaar' };
  let j;
  try { j = JSON.parse(r.out); } catch { return { available: false }; }
  const deps = j.deployments || [];
  const booted = deps.find((d) => d.booted) || {};
  const staged = deps.find((d) => d.staged);
  const ref = booted['container-image-reference'] || '';
  return {
    available: true,
    busy,
    image: ref.replace(/^ostree-image-signed:docker:\/\/|^ostree-unverified-registry:/, ''),
    version: booted.version || null,
    date: fmtDate(booted.timestamp),
    staged: staged ? { version: staged.version || null, date: fmtDate(staged.timestamp) } : null,
    canRollback: deps.some((d) => !d.booted && !d.staged),
  };
}

// Kijken of er een nieuwe versie is
async function check() {
  if (busy) return { busy: true };
  const r = await run(['upgrade', '--check'], 180000);
  const text = `${r.out}\n${r.err}`;
  if (/not allowed|not authorized|AccessDenied/i.test(text)) return { error: 'Geen toestemming om updates te zoeken' };
  if (/No updates? available|no update/i.test(text) || r.code === 77) return { available: false };
  const v = text.match(/Version:\s*(\S+)/);
  if (/AvailableUpdate|Diff:|Version:/i.test(text)) return { available: true, version: v ? v[1] : null };
  return r.ok ? { available: false } : { error: 'Zoeken mislukt' };
}

// Update downloaden en klaarzetten; onLine(tekst) krijgt de voortgang
function upgrade(onLine) {
  if (busy) return Promise.resolve({ busy: true });
  busy = true;
  return new Promise((resolve) => {
    const child = spawn('rpm-ostree', ['upgrade'], { env: { ...process.env, LC_ALL: 'C' } });
    let log = '';
    const feed = (buf) => {
      const txt = String(buf);
      log += txt;
      for (const line of txt.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)) onLine(line);
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', () => { busy = false; resolve({ error: 'Kon de update niet starten' }); });
    child.on('close', (code) => {
      busy = false;
      if (code === 0) {
        resolve(/No upgrade available|No updates? available/i.test(log) ? { ok: true, nothing: true } : { ok: true, staged: true });
      } else {
        resolve({ error: /not allowed|not authorized/i.test(log) ? 'Geen toestemming om te updaten' : 'Update mislukt' });
      }
    });
  });
}

// Terug naar de vorige versie (bij de volgende herstart)
async function rollback() {
  const r = await run(['rollback'], 120000);
  return r.ok ? { ok: true } : { error: 'Terugzetten mislukt' };
}

module.exports = { status, check, upgrade, rollback };
