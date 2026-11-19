// Samenwerking met gamescope (het console-scherm van Game Mode).
//
// gamescope draait in "Steam-modus": het laat alleen vensters zien met een app-nummer
// (X-eigenschap STEAM_GAME) en kiest welk venster vooraan staat via de lijst
// GAMESCOPECTRL_BASELAYER_APPID op het root-venster. Normaal regelt Steam dat;
// in RandomOS doet de shell het zelf.
const { execFile } = require('child_process');

const SHELL_APPID = 7690001; // ons eigen app-nummer
const STEAM_APPID = 769; // Steam (Big Picture / inlogscherm)
const DISPLAYS = [...new Set([process.env.DISPLAY || ':0', ':0', ':1'])];

let active = false;
let shellXid = null;
let tagTimer = null;
let mode = 'shell'; // 'shell' | 'steam' | 'game'

function run(cmd, args, display = process.env.DISPLAY) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000, env: { ...process.env, DISPLAY: display } }, (err, out) => resolve(err ? null : String(out)));
  });
}

async function setBaselayer(appids) {
  if (!active) return;
  await run('xprop', ['-root', '-f', 'GAMESCOPECTRL_BASELAYER_APPID', '32c', '-set', 'GAMESCOPECTRL_BASELAYER_APPID', appids.join(',')]);
}

async function tagWindow(xid, appid, display) {
  await run('xprop', ['-id', String(xid), '-f', 'STEAM_GAME', '32c', '-set', 'STEAM_GAME', String(appid)], display);
}

// Aanroepen zodra het shell-venster bestaat. xid = X11-venster-id van Electron.
async function init(xid) {
  const probe = await run('xprop', ['-root', 'GAMESCOPE_PID']);
  active = !!(probe && /GAMESCOPE_PID\(CARDINAL\) = \d+/.test(probe));
  if (!active) return false; // niet in gamescope (bv. test op het bureaublad)
  shellXid = xid;
  await tagWindow(xid, SHELL_APPID);
  await setBaselayer([SHELL_APPID]);
  return true;
}

// Shell weer vooraan
async function focusShell() {
  mode = 'shell';
  stopTagging();
  if (shellXid) await tagWindow(shellXid, SHELL_APPID);
  await setBaselayer([SHELL_APPID]);
}

// Steam-vensters (inlogscherm, Big Picture) vooraan, shell als terugval
async function focusSteam() {
  mode = 'steam';
  await setBaselayer([STEAM_APPID, SHELL_APPID]);
}

// Game vooraan. pidsFn() geeft de processen van de game; hun vensters krijgen het app-nummer.
function focusGame(appid, pidsFn) {
  stopTagging();
  mode = 'game';
  if (!active) return;
  const id = Number(appid);
  setBaselayer([id, SHELL_APPID]);
  const tagged = new Set();
  const tick = async () => {
    for (const pid of pidsFn()) {
      for (const display of DISPLAYS) {
        const out = await run('xdotool', ['search', '--pid', String(pid)], display);
        if (!out) continue;
        for (const w of out.split('\n').map((x) => x.trim()).filter(Boolean)) {
          const key = `${display}/${w}`;
          if (tagged.has(key)) continue;
          tagged.add(key);
          await tagWindow(w, id, display);
        }
      }
    }
  };
  tick();
  tagTimer = setInterval(tick, 1500);
}

// Bewaker: in shell-modus zorgen dat gamescope de shell nog steeds vooraan heeft
async function ensure() {
  if (!active || mode !== 'shell' || !shellXid) return;
  const out = await run('xprop', ['-root', 'GAMESCOPECTRL_BASELAYER_APPID']);
  if (!out || !new RegExp(`= ${SHELL_APPID}\\s*$`).test(out.trim())) {
    console.log('[gamescope] focus hersteld');
    await focusShell();
  }
}

function stopTagging() {
  if (tagTimer) clearInterval(tagTimer);
  tagTimer = null;
}

module.exports = { init, focusShell, focusSteam, focusGame, ensure, SHELL_APPID, STEAM_APPID, get active() { return active; }, get mode() { return mode; } };
