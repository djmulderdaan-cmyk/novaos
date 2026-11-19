// Instellingen-scherm en alles wat het uiterlijk/gedrag van de shell bepaalt

const THEMES = {
  space: { name: 'Space', bg: '#05081a', bg2: '#0a1030', accent: '#2aa8e8' },
  midnight: { name: 'Middernacht', bg: '#000000', bg2: '#0c0c12', accent: '#e2e8f0' },
  aurora: { name: 'Aurora', bg: '#0a0618', bg2: '#1a1240', accent: '#a78bfa' },
  ocean: { name: 'Oceaan', bg: '#021216', bg2: '#06333d', accent: '#2dd4bf' },
  sunset: { name: 'Zonsondergang', bg: '#12060a', bg2: '#2e0f1e', accent: '#fb923c' },
  forest: { name: 'Bos', bg: '#03100a', bg2: '#0b2a18', accent: '#4ade80' },
  candy: { name: 'Snoep', bg: '#120818', bg2: '#2b1038', accent: '#f472b6' },
  ember: { name: 'Gloed', bg: '#100606', bg2: '#2a0d0d', accent: '#fb7185' },
};

const SOUND_PACKS = {
  soft: { name: 'Zacht', icon: '☁️', desc: 'Rustige tikjes' },
  retro: { name: 'Retro', icon: '👾', desc: '8-bit piepjes' },
  space: { name: 'Ruimte', icon: '🚀', desc: 'Sci-fi bliepjes' },
  bubble: { name: 'Bubbels', icon: '🫧', desc: 'Plopjes' },
  crystal: { name: 'Kristal', icon: '💎', desc: 'Glazen belletjes' },
  click: { name: 'Klik', icon: '⌨️', desc: 'Mechanische klikjes' },
  custom: { name: 'Eigen', icon: '🎵', desc: 'Jouw bestanden' },
};

const TEXT_SIZES = { normal: 'clamp(14px, 1.05vw, 20px)', large: 'clamp(16px, 1.2vw, 23px)', xl: 'clamp(18px, 1.38vw, 26px)' };

// Past alles toe wat in de instellingen staat (aangeroepen vanuit applySettings)
function applyLook() {
  const s = S.settings;
  const t = THEMES[s.theme] || THEMES.space;
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--bg-2', t.bg2);
  root.fontSize = TEXT_SIZES[s.text] || TEXT_SIZES.normal;
  const b = document.body;
  b.dataset.bg = s.bgStyle || 'art';
  b.dataset.tiles = s.tiles || 'normal';
  b.classList.toggle('titles', !!s.titles);
  b.classList.toggle('reduce', !!s.reduceMotion);
  b.classList.toggle('no-greet', s.greeting === false);
  Input.swapAB = !!s.swapAB;
  Input.speed = s.navSpeed || 'normal';
  Input.rumbleOn = s.rumble !== false;
  Sounds.setVolume((s.uiVolume == null ? 70 : s.uiVolume) / 100);
  Sounds.setStyle(s.soundStyle || 'soft');
  applyPadStyle(Input.lastStyle);
  if (typeof updateClock === 'function') updateClock();
  if (typeof updateGreeting === 'function') updateGreeting();
}

// Knoppenstijl: automatisch (van de controller) of vast gekozen
function applyPadStyle(detected) {
  const want = S.settings.pad && S.settings.pad !== 'auto' ? S.settings.pad : detected || 'xbox';
  document.body.dataset.pad = want;
  refreshGlyphs();
}

const CATS = [
  { id: 'look', name: 'Uiterlijk', icon: 'palette' },
  { id: 'effects', name: 'Effecten & geluid', icon: 'sparkle' },
  { id: 'controller', name: 'Controller', icon: 'gamepad' },
  { id: 'library', name: 'Home & bibliotheek', icon: 'apps' },
  { id: 'energy', name: 'Energie', icon: 'moon' },
  { id: 'wifi', name: 'Wifi', icon: 'wifi' },
  { id: 'bt', name: 'Bluetooth', icon: 'bt' },
  { id: 'sound', name: 'Geluid & scherm', icon: 'sound' },
  { id: 'games', name: 'Games', icon: 'steam' },
  { id: 'system', name: 'Systeem', icon: 'cpu' },
  { id: 'about', name: 'Over RandomOS', icon: 'info' },
];

function renderSettingsNav() {
  const nav = $('#setNav');
  nav.innerHTML = '';
  for (const c of CATS) {
    const b = h('button', { class: `nav-item${S.setCat === c.id ? ' on' : ''}`, 'data-focus': true, 'data-group': 'setnav', 'data-id': `cat-${c.id}` }, h('span', { class: `ico ${c.icon}` }), c.name);
    let t;
    b.addEventListener('focusin-nova', () => { clearTimeout(t); t = setTimeout(() => openCat(c.id), 120); });
    b.addEventListener('click', () => { openCat(c.id); Focus.first('setpanel'); });
    nav.append(b);
  }
  renderCat();
}

function openCat(id, force) {
  if (!force && S.setCat === id && $('#setPanel').childElementCount) return;
  S.setCat = id;
  $$('#setNav .nav-item').forEach((b) => b.classList.toggle('on', b.dataset.id === `cat-${id}`));
  Focus.forget('setpanel');
  renderCat();
}

// Opnieuw tekenen maar de focus op dezelfde rij houden
function refreshCat() {
  const rows = $$('#setPanel [data-focus]');
  const idx = rows.indexOf(Focus.current);
  renderCat().then(() => {
    if (idx < 0) return;
    const now = $$('#setPanel [data-focus]');
    if (now[idx]) Focus.set(now[idx], { silent: true, scroll: false });
  });
}

const set = (patch, after) => async (v) => {
  await saveSettings(typeof patch === 'function' ? patch(v) : { [patch]: v });
  if (after) after(v);
};

async function renderCat() {
  const panel = $('#setPanel');
  const id = S.setCat;
  const P = 'setpanel';
  const s = S.settings;
  const out = [];
  const head = (t, sub) => { out.push(h('h2', {}, t)); if (sub) out.push(h('p', { class: 'sub' }, sub)); };

  if (id === 'look') {
    head('Uiterlijk', 'Maak RandomOS helemaal van jou.');
    const themes = h('div', { class: 'themes' });
    for (const [key, t] of Object.entries(THEMES)) {
      const card = h('button', { class: `theme${(s.theme || 'space') === key ? ' on' : ''}`, 'data-focus': true, 'data-group': P, style: { '--t1': t.bg, '--t2': t.bg2, '--ta': t.accent } },
        h('div', { class: 'prev' }, h('span', { class: 'dot' })), h('div', { class: 'nm' }, t.name));
      card.addEventListener('click', async () => {
        await saveSettings({ theme: key, accent: t.accent });
        Sounds.select();
        $$('.theme', themes).forEach((x) => x.classList.toggle('on', x === card));
        $$('.swatch').forEach((x) => x.classList.toggle('on', x.dataset.hex === t.accent));
        toast(`Thema: ${t.name}`, { icon: 'palette' });
      });
      themes.append(card);
    }
    out.push(group('Thema', themes));

    const sw = h('div', { class: 'swatches' });
    for (const [hex, name] of ACCENTS) {
      const b = h('button', { class: `swatch${s.accent === hex ? ' on' : ''}`, style: { '--c': hex }, title: name, 'data-hex': hex, 'data-focus': true, 'data-group': P });
      b.addEventListener('click', async () => { await saveSettings({ accent: hex }); Sounds.select(); $$('.swatch', sw).forEach((x) => x.classList.toggle('on', x === b)); toast(`Accentkleur: ${name}`, { icon: 'check' }); });
      sw.append(b);
    }
    out.push(group('Accentkleur', sw));

    out.push(group('Weergave',
      choiceRow('Achtergrond', 'Wat er achter het menu te zien is', [['art', 'Game-art'], ['space', 'Ruimte'], ['plain', 'Effen']], s.bgStyle || 'art', set('bgStyle'), P),
      choiceRow('Tegels', null, [['small', 'Klein'], ['normal', 'Normaal'], ['large', 'Groot']], s.tiles || 'normal', set('tiles', () => rerenderAll()), P),
      toggleRow('Titels altijd tonen', 'Naam onder elke game, niet alleen bij selectie', s.titles, set('titles'), P),
      choiceRow('Tekstgrootte', null, [['normal', 'Normaal'], ['large', 'Groot'], ['xl', 'Extra groot']], s.text || 'normal', set('text'), P)));

    out.push(group('Bovenbalk',
      choiceRow('Klok', null, [['24', '24 uur'], ['12', '12 uur']], s.clock12 ? '12' : '24', set((v) => ({ clock12: v === '12' })), P),
      toggleRow('Datum tonen', null, s.showDate, set('showDate'), P),
      toggleRow('Batterijpercentage', null, s.battPct !== false, set('battPct', () => refreshStatus()), P)));

    out.push(group('Profiel',
      actionRow('Naam', 'Wordt rechtsboven en in de begroeting getoond', null, async () => {
        const n = await OSK.open({ title: 'Hoe heet je?', value: s.name || $('#profileName').textContent });
        if (n === null) return;
        await saveSettings({ name: n.trim() });
        await loadProfile();
        updateGreeting();
        refreshCat();
      }, P, s.name || $('#profileName').textContent),
      toggleRow('Begroeting op Home', '"Goedenavond, …" boven de game', s.greeting !== false, set('greeting'), P)));
  }

  if (id === 'effects') {
    head('Effecten & geluid');
    out.push(group('Effecten',
      toggleRow('Zwevende lichtjes', 'Rustige deeltjes op de achtergrond', s.ambient, set('ambient'), P),
      toggleRow('Opstartanimatie', 'De astronaut bij het opstarten', s.intro, set('intro'), P),
      toggleRow('Animaties beperken', 'Minder beweging in de menu’s', s.reduceMotion, set('reduceMotion'), P),
      toggleRow('Prestatiemodus', 'Geen vervaging, gloed of lichtjes. Handig op zwakkere laptops.', s.perf, set('perf'), P),
      actionRow('Opstartanimatie bekijken', null, 'sparkle', async () => { document.body.classList.remove('ready'); await playIntro(); document.body.classList.add('ready'); }, P)));
    out.push(group('Menugeluiden',
      toggleRow('Geluidseffecten', 'Klikjes en tonen in de menu’s', s.sounds, set('sounds'), P),
      sliderRow('Volume menu', s.uiVolume == null ? 70 : s.uiVolume, (v) => saveSettings({ uiVolume: v }).then(() => Sounds.select()), { group: P, step: 10 })));

    const packs = h('div', { class: 'packs' });
    for (const [key, p] of Object.entries(SOUND_PACKS)) {
      const card = h('button', { class: `pack${(s.soundStyle || 'soft') === key ? ' on' : ''}`, 'data-focus': true, 'data-group': P },
        h('div', { class: 'pk-ico' }, p.icon), h('div', { class: 'pk-nm' }, p.name), h('div', { class: 'pk-ds' }, p.desc));
      // voorproefje zodra je erover beweegt
      let t;
      card.addEventListener('focusin-nova', () => { clearTimeout(t); t = setTimeout(() => Sounds.preview(key, 'move'), 60); });
      card.addEventListener('click', async () => {
        if (key === 'custom' && !(S.customSoundCount > 0)) { Sounds.error(); toast('Nog geen eigen geluiden gevonden. Zie de uitleg hieronder.', { bad: true, icon: 'info' }); return; }
        await saveSettings({ soundStyle: key });
        $$('.pack', packs).forEach((x) => x.classList.toggle('on', x === card));
        Sounds.preview(key, 'select');
        toast(`Geluiden: ${p.name}`, { icon: 'sound' });
      });
      packs.append(card);
    }
    out.push(group('Geluidspakket', packs));
    out.push(group('Eigen geluiden',
      h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.65, color: 'var(--text-2)' } },
        'Zet in de bureaubladmodus geluidsbestanden (.wav, .ogg, .mp3) in ', h('b', { style: { color: 'var(--text)' } }, S.customSoundDir || '~/.config/randomos/sounds'),
        ' met deze namen: ', h('b', { style: { color: 'var(--text)' } }, 'move, select, back, tab, open, launch, boot'),
        '. Bijvoorbeeld move.wav voor het geluid als je beweegt. Ontbreekt er een, dan gebruikt RandomOS het zachte geluid.'),
      actionRow('Eigen geluiden opnieuw laden', `${S.customSoundCount || 0} gevonden`, 'refresh', async () => {
        const n = await loadCustomSounds();
        toast(n ? `${n} eigen geluiden geladen` : 'Geen eigen geluiden gevonden', { icon: n ? 'check' : 'info', bad: !n });
        refreshCat();
      }, P)));
  }

  if (id === 'controller') {
    head('Controller', 'Xbox, PlayStation, Nintendo en de meeste andere controllers werken direct.');
    out.push(group('Knoppen',
      choiceRow('Knoppenstijl', 'Welke knoppen op het scherm getoond worden', [['auto', 'Automatisch'], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['nintendo', 'Nintendo']], s.pad || 'auto', set('pad'), P),
      toggleRow('Bevestigen en terug wisselen', 'Rechterknop kiest, onderste knop gaat terug (zoals bij Nintendo en Japanse consoles)', s.swapAB, set('swapAB', () => updateHints()), P)));
    out.push(group('Gevoel',
      choiceRow('Scrollsnelheid', 'Als je de stick of het pijltje ingedrukt houdt', [['slow', 'Rustig'], ['normal', 'Normaal'], ['fast', 'Snel']], s.navSpeed || 'normal', set('navSpeed'), P),
      toggleRow('Trillen', 'Korte tik bij kiezen (als je controller dat kan)', s.rumble !== false, set('rumble', (v) => v && Input.rumble(0.4, 0.6, 120)), P)));
    out.push(group('Hulpmiddelen',
      actionRow('Controller testen', 'Zie live welke knoppen en sticks werken', 'gamepad', () => openPadTest(), P),
      actionRow('Draadloze controller koppelen', 'Via Bluetooth', 'bt', () => { openCat('bt'); Focus.first('setpanel'); }, P)));
  }

  if (id === 'library') {
    head('Home & bibliotheek');
    out.push(group('Home',
      choiceRow('Opstarten in', 'Welk scherm je ziet na het aanzetten', [['home', 'Home'], ['library', 'Bibliotheek']], s.startTab || 'home', set('startTab'), P),
      choiceRow('Rij op Home', null, [['recent', 'Recent gespeeld'], ['favorites', 'Favorieten eerst']], s.homeRow || 'recent', set('homeRow', () => rerenderAll()), P)));
    const hidden = S.games.filter((g) => (s.hidden || []).includes(g.id));
    out.push(group(`Verborgen games (${hidden.length})`,
      ...(hidden.length ? hidden.map((g) => actionRow(g.title, 'Kies om weer te tonen', null, () => toggleHidden(g).then(refreshCat), P, h('span', { class: `badge ${g.source}` }, SOURCE_NAMES[g.source])))
        : [h('div', { class: 'row static', style: { color: 'var(--text-2)' } }, 'Geen verborgen games. Verberg een game via Info bij die game.')])));
  }

  if (id === 'energy') {
    head('Energie', 'Spaar je batterij als je even niet speelt.');
    out.push(group(null,
      choiceRow('Screensaver', 'Na hoe lang niks doen', [[0, 'Uit'], [2, '2 min'], [5, '5 min'], [10, '10 min']], s.screensaver == null ? 5 : s.screensaver, set('screensaver'), P),
      choiceRow('Automatisch slapen', 'Niet tijdens het gamen', [[0, 'Nooit'], [15, '15 min'], [30, '30 min'], [60, '1 uur']], s.autoSleep || 0, set('autoSleep'), P),
      toggleRow('Waarschuwing bij lage batterij', 'Bij 15% en 5%', s.lowBattery !== false, set('lowBattery'), P),
      actionRow('Screensaver nu bekijken', null, 'moon', () => startScreensaver(), P)));
  }

  if (id === 'wifi') {
    head('Wifi');
    const st = S.status || (await nova.sys.status());
    const list = h('div', {}, h('div', { class: 'row static' }, h('div', { class: 'spinner', style: { width: '22px', height: '22px', borderWidth: '3px' } }), h('div', { class: 'r-main' }, 'Netwerken zoeken…')));
    out.push(group(null, toggleRow('Wifi', st.wifi.ssid ? `Verbonden met ${st.wifi.ssid}` : 'Niet verbonden', st.wifi.enabled, async (v) => { await nova.sys.wifiRadio(v); await refreshStatus(); renderCat(); }, P)));
    if (st.wifi.enabled) {
      out.push(group('Netwerken', list));
      nova.sys.wifiList().then((nets) => {
        if (S.setCat !== 'wifi') return;
        list.innerHTML = '';
        if (!Array.isArray(nets) || !nets.length) { list.append(h('div', { class: 'row static' }, 'Geen netwerken gevonden')); return; }
        for (const n of nets) {
          const bars = h('span', { class: 'bars' }, ...[25, 50, 75].map((th, i) => h('i', { class: n.signal > th - 10 ? 'on' : '', style: { height: `${6 + i * 5}px` } })));
          const val = h('span', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, n.active ? h('span', { class: 'ok' }, 'Verbonden') : null, n.secure ? h('span', { class: 'ico lock', style: { width: '16px', height: '16px' } }) : null, bars);
          list.append(actionRow(n.ssid, n.known && !n.active ? 'Opgeslagen' : null, null, async () => {
            if (n.active) return;
            let pw = null;
            if (n.secure && !n.known) { pw = await OSK.open({ title: `Wachtwoord voor ${n.ssid}`, password: true }); if (pw === null) return; }
            toast(`Verbinden met ${n.ssid}…`, { icon: 'refresh' });
            const r = await nova.sys.wifiConnect(n.ssid, pw);
            if (r && r.ok) { toast(`Verbonden met ${n.ssid}`); await refreshStatus(); renderCat(); } else { Sounds.error(); toast((r && r.error) || 'Verbinden mislukt', { bad: true, icon: 'info' }); }
          }, P, val));
        }
      });
      out.push(actionRow('Opnieuw zoeken', null, 'refresh', () => renderCat(), P));
    }
  }

  if (id === 'bt') {
    head('Bluetooth', 'Koppel draadloze controllers, koptelefoons en speakers.');
    const st = S.status || (await nova.sys.status());
    out.push(group(null, toggleRow('Bluetooth', null, st.bluetooth.enabled, async (v) => { await nova.sys.btPower(v); await refreshStatus(); renderCat(); }, P)));
    if (st.bluetooth.enabled) {
      const list = h('div', {});
      const fill = (devs) => {
        list.innerHTML = '';
        if (!Array.isArray(devs) || !devs.length) { list.append(h('div', { class: 'row static' }, 'Nog geen apparaten. Zet je apparaat in koppelmodus en kies "Zoeken".')); return; }
        for (const d of devs) {
          list.append(actionRow(d.name, d.connected ? 'Verbonden' : d.paired ? 'Gekoppeld' : 'Nieuw apparaat', 'bt', async () => {
            if (d.connected) { await nova.sys.btDisconnect(d.mac); toast(`${d.name} losgekoppeld`); }
            else { toast(`Verbinden met ${d.name}…`, { icon: 'refresh' }); const r = await nova.sys.btConnect(d.mac); r && r.ok ? toast(`${d.name} verbonden`) : toast((r && r.error) || 'Mislukt', { bad: true, icon: 'info' }); }
            fill(await nova.sys.btDevices());
          }, P, d.connected ? h('span', { class: 'ok' }, 'Verbonden') : null));
        }
      };
      out.push(group('Apparaten', list));
      out.push(group('Koppelen',
        h('div', { class: 'row static', style: { display: 'block', color: 'var(--text-2)', lineHeight: 1.6 } },
          h('b', { style: { color: 'var(--text)' } }, 'Xbox: '), 'houd de koppelknop bovenop 3 sec ingedrukt. ',
          h('b', { style: { color: 'var(--text)' } }, 'PlayStation: '), 'houd PS + Share/Create ingedrukt tot het lampje knippert.'),
        actionRow('Zoeken naar apparaten', 'Duurt ongeveer 8 seconden', 'refresh', async (row) => {
          $('.r-title', row).textContent = 'Zoeken…';
          fill(await nova.sys.btScan());
          $('.r-title', row).textContent = 'Zoeken naar apparaten';
        }, P)));
      nova.sys.btDevices().then((d) => S.setCat === 'bt' && fill(d));
    }
  }

  if (id === 'sound') {
    head('Geluid & scherm');
    const st = await nova.sys.status();
    if (st.volume.available) out.push(group('Geluid',
      sliderRow('Volume', st.volume.level, (v) => nova.sys.volume(v), { group: P }),
      toggleRow('Dempen', null, st.volume.muted, () => nova.sys.mute(), P)));
    if (st.brightness.available) out.push(group('Scherm', sliderRow('Helderheid', st.brightness.level, (v) => nova.sys.brightness(v), { min: 5, group: P })));
    if (!st.volume.available && !st.brightness.available) out.push(h('p', { class: 'sub' }, 'Geen geluid of scherm gevonden om te regelen.'));
  }

  if (id === 'games') {
    head('Games', `${S.games.length} games gevonden.`);
    const counts = ['steam', 'epic', 'gog', 'amazon', 'custom'].map((src) => [src, S.games.filter((g) => g.source === src).length]).filter(([, n]) => n);
    out.push(group('Bronnen', ...counts.map(([src, n]) => h('div', { class: 'row static' }, h('span', { class: `badge ${src}` }, SOURCE_NAMES[src]), h('div', { class: 'r-main' }), h('span', { class: 'r-val' }, `${n} ${n === 1 ? 'game' : 'games'}`)))));
    out.push(group('Acties',
      actionRow('Bibliotheek vernieuwen', 'Zoek opnieuw naar geïnstalleerde games', 'refresh', async () => { await loadGames(); rerenderAll(); renderCat(); toast(`${S.games.length} games gevonden`); }, P),
      actionRow('Steam Big Picture openen', 'Winkel, downloads en Steam-instellingen', 'steam', () => nova.sys.openSteam(), P)));
    out.push(group('Eigen games toevoegen', h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.6, color: 'var(--text-2)' } },
      'Ga naar de bureaubladmodus en zet je games in ', h('b', { style: { color: 'var(--text)' } }, '~/.config/randomos/games.json'), '. Epic-, GOG- en Amazon-games uit Heroic verschijnen vanzelf.')));
  }

  if (id === 'system') {
    head('Systeem');
    const i = await nova.sys.info();
    const dl = h('dl', { class: 'info-grid' });
    for (const [k, v] of [['Systeem', i.os], ['Processor', i.cpu], ['Graphics', (i.gpu || []).join(', ')], ['Geheugen', i.ram], ['Opslag', i.disk], ['Kernel', i.kernel], ['Image', i.image]]) {
      if (v) dl.append(h('dt', {}, k), h('dd', {}, v));
    }
    out.push(group('Over dit apparaat', dl));
    out.push(group('Geavanceerd',
      actionRow('Bureaubladmodus', 'Schakel naar het gewone bureaublad', 'desktop', () => nova.sys.power('desktop'), P),
      actionRow('Gewone Steam-interface gebruiken', 'Start Game Mode voortaan zonder RandomOS Shell. Terug via het bureaublad.', 'steam', async () => {
        const ok = await confirmBox('Steam-interface gebruiken?', 'Game Mode start dan met de gewone Steam-interface. Je kunt terug via "RandomOS Shell weer gebruiken" in de bureaubladmodus.', 'Overschakelen');
        if (ok) nova.sys.power('steam-ui');
      }, P),
      actionRow('RandomOS Shell herstarten', null, 'restart', () => nova.sys.power('restart-shell'), P),
      actionRow('Instellingen terugzetten', 'Alles van de shell terug naar standaard (je games blijven)', 'refresh', async () => {
        const ok = await confirmBox('Alles terugzetten?', 'Thema, kleuren, controller- en energie-instellingen gaan terug naar standaard. Favorieten en verborgen games blijven.', 'Terugzetten');
        if (!ok) return;
        await saveSettings({ ...DEFAULT_LOOK });
        toast('Instellingen teruggezet');
        rerenderAll();
        refreshCat();
      }, P)));
  }

  if (id === 'about') {
    head('Over RandomOS');
    out.push(h('div', { class: 'row static', style: { display: 'flex', gap: '24px', alignItems: 'center', padding: '10px 4px 26px' } },
      h('img', { class: 'about-mascot', src: 'img/mascot.png', alt: '' }),
      h('div', {}, h('div', { class: 'display', style: { fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em' } }, 'RandomOS'), h('div', { style: { color: 'var(--text-2)', marginTop: '4px' } }, 'RandomOS Shell 1.1'))));
    out.push(group(null, h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.7, color: 'var(--text-2)' } },
      'Een eigen console-OS, gebouwd op Bazzite en Fedora Linux. Games draaien via Steam en Proton; updates komen elke dag automatisch binnen.')));
    out.push(group('Bediening', h('div', { class: 'row static', style: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '12px 18px', alignItems: 'center' } },
      glyph('a'), 'Kiezen / spelen', glyph('b'), 'Terug', glyph('x'), 'Favoriet maken', glyph('y'), 'Snelmenu',
      h('span', { style: { display: 'flex', gap: '4px' } }, glyph('lb'), glyph('rb')), 'Tabblad wisselen',
      glyph('start'), 'Aan/uit-menu', glyph('guide'), 'Naar Home (ingedrukt houden tijdens een game: game stoppen)')));
  }

  if (S.setCat !== id) return;
  panel.innerHTML = '';
  panel.append(...out);
  if (Focus.current && Focus.current.dataset.group === P && !Focus.current.isConnected) Focus.first(P);
  updateHints();
}

// Standaardwaarden voor "Instellingen terugzetten" (favorieten/verborgen/naam blijven)
const DEFAULT_LOOK = {
  theme: 'space', accent: '#2aa8e8', bgStyle: 'art', tiles: 'normal', titles: false, text: 'normal',
  clock12: false, showDate: false, battPct: true, greeting: true,
  ambient: true, intro: true, reduceMotion: false, perf: false, sounds: true, soundStyle: 'soft', uiVolume: 70,
  pad: 'auto', swapAB: false, navSpeed: 'normal', rumble: true,
  startTab: 'home', homeRow: 'recent', screensaver: 5, autoSleep: 0, lowBattery: true,
};

async function toggleHidden(g) {
  const hidden = new Set(S.settings.hidden || []);
  const nowHidden = !hidden.has(g.id);
  nowHidden ? hidden.add(g.id) : hidden.delete(g.id);
  await saveSettings({ hidden: [...hidden] });
  toast(nowHidden ? `${g.title} verborgen` : `${g.title} is weer zichtbaar`, { icon: nowHidden ? 'info' : 'check' });
  rerenderAll();
}
