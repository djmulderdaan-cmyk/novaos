'use strict';
// A/B-wissel voor de hele computer via InputPlumber (/usr/libexec/randomos/padswap).
// Als dit werkt, wisselt de controller zelf al A en B en hoeft de shell dat niet meer te doen.
const { execFile } = require('child_process');
const fs = require('fs');

const BIN = '/usr/libexec/randomos/padswap';
let active = false;
let wanted = false;
let busy = false;
let onChange = () => {};

function run(arg) {
  return new Promise((resolve) => {
    if (!fs.existsSync(BIN)) return resolve(false);
    execFile(BIN, [arg], { timeout: 15000 }, (err, out) => resolve(!err && String(out).trim() === 'on'));
  });
}

function set(state) {
  if (state !== active) { active = state; console.log('[padswap] systeembreed', state ? 'aan' : 'uit'); onChange(active); }
}

async function apply(on) {
  wanted = !!on;
  if (busy) return active;
  busy = true;
  try {
    // als de gebruiker tijdens het wachten nog eens wisselde, opnieuw toepassen
    let done;
    do { done = wanted; set(done ? await run('on') : (await run('off'), false)); } while (done !== wanted);
  } finally { busy = false; }
  return active;
}

// Nieuw aangesloten controllers krijgen ook het profiel
async function sync() {
  if (!wanted || busy) return;
  busy = true;
  try { set(await run('sync')); } finally { busy = false; }
}

module.exports = { apply, sync, isActive: () => active, onChange: (fn) => { onChange = fn; } };
