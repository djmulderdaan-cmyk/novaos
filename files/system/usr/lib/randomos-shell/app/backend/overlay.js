// Prestatie-overlay (FPS-meter) via MangoHud.
// In Game Mode draait "mangoapp"; die leest zijn instellingen uit het bestand in
// MANGOHUD_CONFIGFILE (door de gamescope-sessie aangemaakt) en past ze live toe.
const fs = require('fs');

const LEVELS = {
  off: 'no_display\n',
  fps: 'fps_only\nposition=top-right\nbackground_alpha=0.4\nfont_size=22\n',
  full: [
    'position=top-right', 'background_alpha=0.45', 'font_size=20',
    'fps', 'frametime', 'frame_timing=1',
    'cpu_stats', 'cpu_temp', 'gpu_stats', 'gpu_temp',
    'ram', 'vram', 'battery', 'battery_time',
  ].join('\n') + '\n',
};

function configFile() {
  if (process.env.MANGOHUD_CONFIGFILE) return process.env.MANGOHUD_CONFIGFILE;
  // anders: het pad opzoeken bij mangoapp zelf
  try {
    for (const pid of fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p))) {
      let comm = '';
      try { comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim(); } catch { continue; }
      if (comm !== 'mangoapp') continue;
      const m = fs.readFileSync(`/proc/${pid}/environ`, 'latin1').match(/(?:^|\0)MANGOHUD_CONFIGFILE=([^\0]+)/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

function setLevel(level) {
  const file = configFile();
  if (!file) return { available: false };
  try {
    fs.writeFileSync(file, LEVELS[level] || LEVELS.off);
    return { available: true, level };
  } catch (e) {
    return { available: false, error: String(e.message || e) };
  }
}

function available() {
  return { available: !!configFile() };
}

module.exports = { setLevel, available };
