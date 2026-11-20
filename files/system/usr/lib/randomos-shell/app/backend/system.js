// Systeembediening: batterij, wifi, bluetooth, volume, helderheid, aan/uit.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');
const settings = require('./settings');

function run(cmd, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, env: { ...process.env, LC_ALL: 'C' } }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || ''), err: String(stderr || (err && err.message) || '') });
    });
  });
}

const read = (p) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } };

function battery() {
  let dirs;
  try { dirs = fs.readdirSync('/sys/class/power_supply'); } catch { return null; }
  const bat = dirs.find((d) => d.startsWith('BAT'));
  if (!bat) return null;
  const base = `/sys/class/power_supply/${bat}`;
  const status = read(`${base}/status`) || 'Unknown';
  // resterende tijd: energie / verbruik (of lading / stroom bij batterijen die dat zo melden)
  let minutesLeft = null;
  const pn = Number(read(`${base}/power_now`) || 0), en = Number(read(`${base}/energy_now`) || 0);
  const cn = Number(read(`${base}/current_now`) || 0), ch = Number(read(`${base}/charge_now`) || 0);
  if (status === 'Discharging') {
    if (pn > 0 && en > 0) minutesLeft = Math.round((en / pn) * 60);
    else if (cn > 0 && ch > 0) minutesLeft = Math.round((ch / cn) * 60);
    if (minutesLeft != null && (minutesLeft < 1 || minutesLeft > 24 * 60)) minutesLeft = null;
  }
  return { level: Number(read(`${base}/capacity`) || 0), status, minutesLeft };
}

// CPU-temperatuur in °C (coretemp/k10temp, anders de ACPI-zone)
function cpuTemp() {
  let dirs;
  try { dirs = fs.readdirSync('/sys/class/hwmon'); } catch { return null; }
  let fallback = null;
  for (const d of dirs) {
    const base = `/sys/class/hwmon/${d}`;
    const name = read(`${base}/name`) || '';
    const v = Number(read(`${base}/temp1_input`) || 0);
    if (!v) continue;
    if (/coretemp|k10temp|zenpower|cpu_thermal/.test(name)) return Math.round(v / 1000);
    if (name === 'acpitz' && fallback == null) fallback = Math.round(v / 1000);
  }
  return fallback;
}

// FPS-limiet voor games via gamescope (0 = geen limiet)
function setFpsLimit(fps) {
  const n = Math.max(0, Math.min(240, Number(fps) || 0));
  return run('xprop', ['-root', '-f', 'GAMESCOPE_FPS_LIMIT', '32c', '-set', 'GAMESCOPE_FPS_LIMIT', String(n)]);
}

// Batterij van draadloze controllers (Xbox/PlayStation/Switch via Bluetooth of dongle)
const LEVELS = { Full: 100, High: 75, Normal: 50, Low: 20, Critical: 5 };
function padBatteries() {
  let dirs;
  try { dirs = fs.readdirSync('/sys/class/power_supply'); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    const base = `/sys/class/power_supply/${d}`;
    if ((read(`${base}/scope`) || '') !== 'Device') continue;
    const cap = read(`${base}/capacity`);
    const lvl = cap != null && cap !== '' ? Number(cap) : LEVELS[read(`${base}/capacity_level`) || ''];
    if (lvl == null || Number.isNaN(lvl)) continue;
    const status = read(`${base}/status`) || '';
    out.push({ name: read(`${base}/model_name`) || d, level: lvl, charging: /Charging|Full/.test(status) });
  }
  return out;
}

// nmcli -t escapet ':' als '\:'
function splitTerse(line) {
  const out = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
    if (line[i] === ':') { out.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  out.push(cur);
  return out;
}

async function wifiStatus() {
  const radio = await run('nmcli', ['-t', 'radio', 'wifi']);
  const enabled = radio.out.trim() === 'enabled';
  const list = await run('nmcli', ['-t', '-f', 'IN-USE,SIGNAL,SSID', 'dev', 'wifi', 'list', '--rescan', 'no']);
  const active = list.out.split('\n').map(splitTerse).find((f) => f[0] === '*');
  return { available: radio.ok, enabled, ssid: active ? active[2] : null, signal: active ? Number(active[1]) : 0 };
}

async function volume() {
  const r = await run('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@']);
  const m = r.out.match(/Volume:\s*([\d.]+)/);
  return { available: r.ok, level: m ? Math.round(Number(m[1]) * 100) : 0, muted: /MUTED/.test(r.out) };
}

async function brightness() {
  const r = await run('brightnessctl', ['-m', '-c', 'backlight']);
  const m = r.out.match(/,(\d+)%,/);
  return { available: r.ok && !!m, level: m ? Number(m[1]) : 100 };
}

async function bluetooth() {
  const r = await run('bluetoothctl', ['show']);
  return { available: r.ok && /Controller/.test(r.out), enabled: /Powered:\s*yes/.test(r.out) };
}

async function status() {
  const [wifi, vol, bright, bt] = await Promise.all([wifiStatus(), volume(), brightness(), bluetooth()]);
  return { battery: battery(), pads: padBatteries(), temp: cpuTemp(), wifi, volume: vol, brightness: bright, bluetooth: bt };
}

async function info() {
  const osr = read('/usr/lib/os-release') || '';
  const pretty = (osr.match(/^PRETTY_NAME="?([^"\n]*)/m) || [])[1] || 'RandomOS';
  let image = {};
  try { image = JSON.parse(read('/usr/share/ublue-os/image-info.json') || '{}'); } catch {}
  const cpu = (os.cpus()[0] || {}).model || 'Onbekend';
  const gpu = await run('sh', ['-c', "lspci 2>/dev/null | grep -Ei 'vga|3d|display' | sed 's/.*: //' | head -n2"]);
  const disk = await run('df', ['-h', '--output=avail,size', os.homedir()]);
  const d = disk.out.trim().split('\n')[1];
  return {
    os: pretty,
    image: image['image-name'] ? `${image['image-name']}:${image['image-tag'] || ''}` : null,
    base: image['base-image-name'] || null,
    kernel: os.release(),
    cpu: cpu.replace(/\s+/g, ' ').trim(),
    gpu: gpu.out.trim().split('\n').filter(Boolean),
    ram: `${Math.round(os.totalmem() / 1024 ** 3)} GB`,
    disk: d ? `${d.trim().split(/\s+/)[0]} vrij van ${d.trim().split(/\s+/)[1]}` : null,
    host: os.hostname(),
  };
}

async function setVolume(level) {
  const v = Math.max(0, Math.min(100, Number(level))) / 100;
  await run('wpctl', ['set-volume', '-l', '1.0', '@DEFAULT_AUDIO_SINK@', v.toFixed(2)]);
  if (v > 0) await run('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', '0']);
  return volume();
}
async function toggleMute() { await run('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', 'toggle']); return volume(); }

async function setBrightness(level) {
  const v = Math.max(5, Math.min(100, Number(level)));
  await run('brightnessctl', ['-c', 'backlight', 'set', `${v}%`]);
  return brightness();
}

async function wifiList() {
  const r = await run('nmcli', ['-t', '-f', 'IN-USE,SIGNAL,SECURITY,SSID', 'dev', 'wifi', 'list', '--rescan', 'auto'], 15000);
  const seen = new Map();
  for (const line of r.out.split('\n')) {
    if (!line.trim()) continue;
    const [inUse, signal, security, ssid] = splitTerse(line);
    if (!ssid) continue;
    const prev = seen.get(ssid);
    const item = { ssid, signal: Number(signal), secure: !!security && security !== '--', active: inUse === '*' };
    if (!prev || item.signal > prev.signal || item.active) seen.set(ssid, { ...item, active: item.active || (prev && prev.active) });
  }
  const saved = await run('nmcli', ['-t', '-f', 'NAME,TYPE', 'connection', 'show']);
  const known = new Set(saved.out.split('\n').map(splitTerse).filter((f) => /wireless/.test(f[1] || '')).map((f) => f[0]));
  return [...seen.values()].map((n) => ({ ...n, known: known.has(n.ssid) })).sort((a, b) => b.active - a.active || b.signal - a.signal);
}

async function wifiConnect(ssid, password) {
  const args = ['dev', 'wifi', 'connect', ssid];
  if (password) args.push('password', password);
  const r = await run('nmcli', args, 30000);
  return r.ok ? { ok: true } : { error: /Secrets were required|password/i.test(r.err) ? 'Verkeerd wachtwoord' : 'Verbinden mislukt' };
}

async function wifiRadio(on) { await run('nmcli', ['radio', 'wifi', on ? 'on' : 'off']); return wifiStatus(); }

async function btPower(on) { await run('bluetoothctl', ['power', on ? 'on' : 'off']); return bluetooth(); }

async function btDevices() {
  const all = await run('bluetoothctl', ['devices']);
  const paired = await run('bluetoothctl', ['devices', 'Paired']);
  const connected = await run('bluetoothctl', ['devices', 'Connected']);
  const parse = (o) => o.split('\n').map((l) => l.match(/^Device\s+([0-9A-F:]{17})\s+(.*)$/i)).filter(Boolean).map((m) => ({ mac: m[1], name: m[2] }));
  const pairedSet = new Set(parse(paired.out).map((d) => d.mac));
  const connSet = new Set(parse(connected.out).map((d) => d.mac));
  return parse(all.out)
    .filter((d) => !/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/i.test(d.name))
    .map((d) => ({ ...d, paired: pairedSet.has(d.mac), connected: connSet.has(d.mac) }))
    .sort((a, b) => b.connected - a.connected || b.paired - a.paired || a.name.localeCompare(b.name));
}

async function btScan() { await run('bluetoothctl', ['--timeout', '8', 'scan', 'on'], 12000); return btDevices(); }

async function btConnect(mac) {
  await run('bluetoothctl', ['--agent', 'NoInputNoOutput', 'pair', mac], 25000);
  await run('bluetoothctl', ['trust', mac]);
  const r = await run('bluetoothctl', ['connect', mac], 20000);
  return /Connection successful/i.test(r.out) ? { ok: true } : { error: 'Verbinden mislukt. Staat het apparaat in koppelmodus?' };
}
async function btDisconnect(mac) { await run('bluetoothctl', ['disconnect', mac]); return { ok: true }; }

async function power(action, app) {
  switch (action) {
    case 'suspend': return run('systemctl', ['suspend']);
    case 'reboot': return run('systemctl', ['reboot']);
    case 'poweroff': return run('systemctl', ['poweroff']);
    case 'desktop': {
      const r = await run('steamosctl', ['switch-to-desktop-mode']);
      if (!r.ok) await run('/usr/libexec/os-session-select', ['plasma']);
      return { ok: true };
    }
    case 'steam-ui': {
      // Volgende keer Game Mode met de gewone Steam-interface starten
      fs.mkdirSync(settings.DIR, { recursive: true });
      fs.writeFileSync(path.join(settings.DIR, 'use-steam-ui'), '');
      setTimeout(() => app.exit(0), 300);
      return { ok: true };
    }
    case 'restart-shell':
      // exitcode 42 = het startscript start de shell meteen opnieuw
      setTimeout(() => app.exit(42), 300);
      return { ok: true };
    default:
      return { error: 'Onbekende actie' };
  }
}

module.exports = { setFpsLimit, status, info, setVolume, toggleMute, setBrightness, wifiList, wifiConnect, wifiRadio, btPower, btDevices, btScan, btConnect, btDisconnect, power };
