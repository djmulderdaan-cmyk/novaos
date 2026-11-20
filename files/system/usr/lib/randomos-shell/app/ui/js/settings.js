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
  if (I18N.setLang(s.lang || 'auto')) onLangChanged();
  const th = THEMES[s.theme] || THEMES.space;
  const root = document.documentElement.style;
  root.setProperty('--bg', th.bg);
  root.setProperty('--bg-2', th.bg2);
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

// Taal gewisseld: alles opnieuw tekenen zonder herstart, focus blijft zo veel mogelijk staan
function onLangChanged() {
  applyStaticI18n();
  if (!S.booted) return;
  const all = () => $$('#app [data-focus]');
  const cur = Focus.current;
  const idx = all().indexOf(cur);
  rerenderAll();
  loadProfile().then(() => updateGreeting());
  updateClock();
  updateGreeting();
  refreshGlyphs();
  renderSettingsNav().then(() => {
    if (cur && !cur.isConnected && idx >= 0) {
      const now = all();
      if (now[idx]) Focus.set(now[idx], { silent: true, scroll: false });
    }
    updateHints();
  });
  updateHints();
}

// Knoppenstijl: automatisch (van de controller) of vast gekozen
function applyPadStyle(detected) {
  const want = S.settings.pad && S.settings.pad !== 'auto' ? S.settings.pad : detected || 'xbox';
  document.body.dataset.pad = want;
  refreshGlyphs();
}

const CATS = [
  { id: 'look', name: 'Uiterlijk', icon: 'palette' },
  { id: 'language', name: 'Taal', icon: 'globe' },
  { id: 'effects', name: 'Effecten & geluid', icon: 'sparkle' },
  { id: 'controller', name: 'Bediening', icon: 'gamepad' },
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
    const b = h('button', { class: `nav-item${S.setCat === c.id ? ' on' : ''}`, 'data-focus': true, 'data-group': 'setnav', 'data-id': `cat-${c.id}` }, h('span', { class: `ico ${c.icon}` }), t(c.name));
    let timer;
    b.addEventListener('focusin-nova', () => { clearTimeout(timer); timer = setTimeout(() => openCat(c.id), 120); });
    b.addEventListener('click', () => { openCat(c.id); Focus.first('setpanel'); });
    nav.append(b);
  }
  return renderCat();
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
  const head = (title, sub) => { out.push(h('h2', {}, title)); if (sub) out.push(h('p', { class: 'sub' }, sub)); };

  if (id === 'look') {
    head(t('Uiterlijk'), t('Maak RandomOS helemaal van jou.'));
    const themes = h('div', { class: 'themes' });
    for (const [key, th] of Object.entries(THEMES)) {
      const card = h('button', { class: `theme${(s.theme || 'space') === key ? ' on' : ''}`, 'data-focus': true, 'data-group': P, style: { '--t1': th.bg, '--t2': th.bg2, '--ta': th.accent } },
        h('div', { class: 'prev' }, h('span', { class: 'dot' })), h('div', { class: 'nm' }, t(th.name)));
      card.addEventListener('click', async () => {
        await saveSettings({ theme: key, accent: th.accent });
        Sounds.select();
        $$('.theme', themes).forEach((x) => x.classList.toggle('on', x === card));
        $$('.swatch').forEach((x) => x.classList.toggle('on', x.dataset.hex === th.accent));
        toast(t('Thema: {name}', { name: t(th.name) }), { icon: 'palette' });
      });
      themes.append(card);
    }
    out.push(group(t('Thema'), themes));

    const sw = h('div', { class: 'swatches' });
    for (const [hex, name] of ACCENTS) {
      const b = h('button', { class: `swatch${s.accent === hex ? ' on' : ''}`, style: { '--c': hex }, title: t(name), 'data-hex': hex, 'data-focus': true, 'data-group': P });
      b.addEventListener('click', async () => { await saveSettings({ accent: hex }); Sounds.select(); $$('.swatch', sw).forEach((x) => x.classList.toggle('on', x === b)); toast(t('Accentkleur: {name}', { name: t(name) }), { icon: 'check' }); });
      sw.append(b);
    }
    out.push(group(t('Accentkleur'), sw));

    out.push(group(t('Weergave'),
      choiceRow(t('Achtergrond'), t('Wat er achter het menu te zien is'), [['art', t('Game-art')], ['space', t('Ruimte')], ['plain', t('Effen')]], s.bgStyle || 'art', set('bgStyle'), P),
      choiceRow(t('Tegels'), null, [['small', t('Klein')], ['normal', t('Normaal')], ['large', t('Groot')]], s.tiles || 'normal', set('tiles', () => rerenderAll()), P),
      toggleRow(t('Titels altijd tonen'), t('Naam onder elke game, niet alleen bij selectie'), s.titles, set('titles'), P),
      choiceRow(t('Tekstgrootte'), null, [['normal', t('Normaal')], ['large', t('Groot')], ['xl', t('Extra groot')]], s.text || 'normal', set('text'), P)));

    out.push(group(t('Bovenbalk'),
      choiceRow(t('Klok'), null, [['24', t('24 uur')], ['12', t('12 uur')]], s.clock12 ? '12' : '24', set((v) => ({ clock12: v === '12' })), P),
      toggleRow(t('Datum tonen'), null, s.showDate, set('showDate'), P),
      toggleRow(t('Batterijpercentage'), null, s.battPct !== false, set('battPct', () => refreshStatus()), P)));

    out.push(group(t('Profiel'),
      actionRow(t('Naam'), t('Wordt rechtsboven en in de begroeting getoond'), null, async () => {
        const n = await OSK.open({ title: t('Hoe heet je?'), value: s.name || $('#profileName').textContent });
        if (n === null) return;
        await saveSettings({ name: n.trim() });
        await loadProfile();
        updateGreeting();
        refreshCat();
      }, P, s.name || $('#profileName').textContent),
      toggleRow(t('Begroeting op Home'), t('"Goedenavond, …" boven de game'), s.greeting !== false, set('greeting'), P)));
  }

  if (id === 'language') {
    head(t('Taal'), t('Kies de taal van RandomOS. Wordt meteen toegepast.'));
    const cur = I18N.setting;
    const langs = h('div', { class: 'packs' });
    const opts = [['auto', 'A', t('Automatisch (systeemtaal)'), t('Nu: {lang}', { lang: I18N.LANGS[I18N.resolve('auto')].native })],
      ...Object.entries(I18N.LANGS).map(([code, l]) => [code, code.toUpperCase(), l.native, code === I18N.lang ? null : t(l.name)])];
    for (const [code, badge, label, desc] of opts) {
      const card = h('button', { class: `pack${cur === code ? ' on' : ''}`, 'data-focus': true, 'data-group': P, 'data-lang': code, lang: code === 'auto' ? null : code },
        h('div', { class: 'pk-ico', style: { fontSize: '1.1rem', fontWeight: 800, letterSpacing: '.06em' } }, badge), h('div', { class: 'pk-nm' }, label), desc ? h('div', { class: 'pk-ds' }, desc) : null);
      card.addEventListener('click', async () => {
        Sounds.select();
        await saveSettings({ lang: code }); // applyLook -> onLangChanged tekent alles opnieuw
        if (S.setCat !== 'language') return;
        await renderCat();
        const again = $(`#setPanel [data-lang="${code}"]`);
        if (again) Focus.set(again, { silent: true, scroll: false });
        toast(t('Taal: {lang}', { lang: code === 'auto' ? t('Automatisch (systeemtaal)') : I18N.LANGS[code].native }), { icon: 'globe' });
      });
      langs.append(card);
    }
    out.push(group(null, langs));
  }

  if (id === 'effects') {
    head(t('Effecten & geluid'));
    out.push(group(t('Effecten'),
      toggleRow(t('Zwevende lichtjes'), t('Rustige deeltjes op de achtergrond'), s.ambient, set('ambient'), P),
      toggleRow(t('Opstartanimatie'), t('De astronaut bij het opstarten'), s.intro, set('intro'), P),
      toggleRow(t('Animaties beperken'), t('Minder beweging in de menu’s'), s.reduceMotion, set('reduceMotion'), P),
      toggleRow(t('Prestatiemodus'), t('Geen vervaging, gloed of lichtjes. Handig op zwakkere laptops.'), s.perf, set('perf'), P),
      actionRow(t('Opstartanimatie bekijken'), null, 'sparkle', async () => { document.body.classList.remove('ready'); await playIntro(); document.body.classList.add('ready'); }, P)));
    out.push(group(t('Menugeluiden'),
      toggleRow(t('Geluidseffecten'), t('Klikjes en tonen in de menu’s'), s.sounds, set('sounds'), P),
      sliderRow(t('Volume menu'), s.uiVolume == null ? 70 : s.uiVolume, (v) => saveSettings({ uiVolume: v }).then(() => Sounds.select()), { group: P, step: 10 })));

    const packs = h('div', { class: 'packs' });
    for (const [key, p] of Object.entries(SOUND_PACKS)) {
      const card = h('button', { class: `pack${(s.soundStyle || 'soft') === key ? ' on' : ''}`, 'data-focus': true, 'data-group': P },
        h('div', { class: 'pk-ico' }, p.icon), h('div', { class: 'pk-nm' }, t(p.name)), h('div', { class: 'pk-ds' }, t(p.desc)));
      // voorproefje zodra je erover beweegt
      let timer;
      card.addEventListener('focusin-nova', () => { clearTimeout(timer); timer = setTimeout(() => Sounds.preview(key, 'move'), 60); });
      card.addEventListener('click', async () => {
        if (key === 'custom' && !(S.customSoundCount > 0)) { Sounds.error(); toast(t('Nog geen eigen geluiden gevonden. Zie de uitleg hieronder.'), { bad: true, icon: 'info' }); return; }
        await saveSettings({ soundStyle: key });
        $$('.pack', packs).forEach((x) => x.classList.toggle('on', x === card));
        Sounds.preview(key, 'select');
        toast(t('Geluiden: {name}', { name: t(p.name) }), { icon: 'sound' });
      });
      packs.append(card);
    }
    out.push(group(t('Geluidspakket'), packs));
    out.push(group(t('Eigen geluiden'),
      h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.65, color: 'var(--text-2)' } },
        ...tx('Zet in de bureaubladmodus geluidsbestanden (.wav, .ogg, .mp3) in {dir} met deze namen: {names}. Bijvoorbeeld move.wav voor het geluid als je beweegt. Ontbreekt er een, dan gebruikt RandomOS het zachte geluid.', {
          dir: h('b', { style: { color: 'var(--text)' } }, S.customSoundDir || '~/.config/randomos/sounds'),
          names: h('b', { style: { color: 'var(--text)' } }, 'move, select, back, tab, open, launch, boot'),
        })),
      actionRow(t('Eigen geluiden opnieuw laden'), t('{n} gevonden', { n: S.customSoundCount || 0 }), 'refresh', async () => {
        const n = await loadCustomSounds();
        toast(n ? t('{n} eigen geluiden geladen', { n }) : t('Geen eigen geluiden gevonden'), { icon: n ? 'check' : 'info', bad: !n });
        refreshCat();
      }, P)));
  }

  if (id === 'controller') {
    head(t('Bediening'), t('Controller, toetsenbord en muis werken allemaal. Xbox, PlayStation, Nintendo en de meeste andere controllers werken direct.'));
    out.push(group(t('Knoppen'),
      choiceRow(t('Knoppenstijl'), t('Welke knoppen op het scherm getoond worden'), [['auto', t('Automatisch')], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['nintendo', 'Nintendo']], s.pad || 'auto', set('pad'), P),
      toggleRow(t('Bevestigen en terug wisselen'), t('Rechterknop kiest, onderste knop gaat terug (zoals bij Nintendo). Geldt ook in alle games.'), s.swapAB, set('swapAB', () => updateHints()), P)));
    out.push(group(t('Gevoel'),
      choiceRow(t('Scrollsnelheid'), t('Als je de stick of het pijltje ingedrukt houdt'), [['slow', t('Rustig')], ['normal', t('Normaal')], ['fast', t('Snel')]], s.navSpeed || 'normal', set('navSpeed'), P),
      toggleRow(t('Trillen'), t('Korte tik bij kiezen (als je controller dat kan)'), s.rumble !== false, set('rumble', (v) => v && Input.rumble(0.4, 0.6, 120)), P)));
    out.push(group(t('Hulpmiddelen'),
      actionRow(t('Controller testen'), t('Zie live welke knoppen en sticks werken'), 'gamepad', () => openPadTest(), P),
      actionRow(t('Draadloze controller koppelen'), t('Via Bluetooth'), 'bt', () => { openCat('bt'); Focus.first('setpanel'); }, P)));
    out.push(group(t('Toetsenbord & muis'),
      actionRow(t('Sneltoetsen bekijken'), t('Of druk op H'), 'apps', () => openShortcuts(), P)));
  }

  if (id === 'library') {
    head(t('Home & bibliotheek'));
    out.push(group(t('Home'),
      choiceRow(t('Opstarten in'), t('Welk scherm je ziet na het aanzetten'), [['home', t('Home')], ['library', t('Bibliotheek')]], s.startTab || 'home', set('startTab'), P),
      choiceRow(t('Rij op Home'), null, [['recent', t('Recent gespeeld')], ['favorites', t('Favorieten eerst')]], s.homeRow || 'recent', set('homeRow', () => rerenderAll()), P)));
    const hidden = S.games.filter((g) => (s.hidden || []).includes(g.id));
    out.push(group(t('Verborgen games ({n})', { n: hidden.length }),
      ...(hidden.length ? hidden.map((g) => actionRow(g.title, t('Kies om weer te tonen'), null, () => toggleHidden(g).then(refreshCat), P, h('span', { class: `badge ${g.source}` }, SOURCE_NAMES[g.source])))
        : [h('div', { class: 'row static', style: { color: 'var(--text-2)' } }, t('Geen verborgen games. Verberg een game via Info bij die game.'))])));
  }

  if (id === 'energy') {
    head(t('Energie'), t('Spaar je batterij als je even niet speelt.'));
    out.push(group(null,
      choiceRow(t('Screensaver'), t('Na hoe lang niks doen'), [[0, t('Uit')], [2, '2 min'], [5, '5 min'], [10, '10 min']], s.screensaver == null ? 5 : s.screensaver, set('screensaver'), P),
      choiceRow(t('Automatisch slapen'), t('Niet tijdens het gamen'), [[0, t('Nooit')], [15, '15 min'], [30, '30 min'], [60, t('1 uur')]], s.autoSleep || 0, set('autoSleep'), P),
      toggleRow(t('Waarschuwing bij lage batterij'), t('Bij 15% en 5%'), s.lowBattery !== false, set('lowBattery'), P),
      await sleepTimerRow(P),
      actionRow(t('Screensaver nu bekijken'), null, 'moon', () => startScreensaver(), P)));
  }

  if (id === 'wifi') {
    head(t('Wifi'));
    const st = S.status || (await nova.sys.status());
    const list = h('div', {}, h('div', { class: 'row static' }, h('div', { class: 'spinner', style: { width: '22px', height: '22px', borderWidth: '3px' } }), h('div', { class: 'r-main' }, t('Netwerken zoeken…'))));
    out.push(group(null, toggleRow(t('Wifi'), st.wifi.ssid ? t('Verbonden met {name}', { name: st.wifi.ssid }) : t('Niet verbonden'), st.wifi.enabled, async (v) => { await nova.sys.wifiRadio(v); await refreshStatus(); renderCat(); }, P)));
    if (st.wifi.enabled) {
      out.push(group(t('Netwerken'), list));
      nova.sys.wifiList().then((nets) => {
        if (S.setCat !== 'wifi') return;
        list.innerHTML = '';
        if (!Array.isArray(nets) || !nets.length) { list.append(h('div', { class: 'row static' }, t('Geen netwerken gevonden'))); return; }
        for (const n of nets) {
          const bars = h('span', { class: 'bars' }, ...[25, 50, 75].map((th, i) => h('i', { class: n.signal > th - 10 ? 'on' : '', style: { height: `${6 + i * 5}px` } })));
          const val = h('span', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, n.active ? h('span', { class: 'ok' }, t('Verbonden')) : null, n.secure ? h('span', { class: 'ico lock', style: { width: '16px', height: '16px' } }) : null, bars);
          list.append(actionRow(n.ssid, n.known && !n.active ? t('Opgeslagen') : null, null, async () => {
            if (n.active) return;
            let pw = null;
            if (n.secure && !n.known) { pw = await OSK.open({ title: t('Wachtwoord voor {name}', { name: n.ssid }), password: true }); if (pw === null) return; }
            toast(t('Verbinden met {name}…', { name: n.ssid }), { icon: 'refresh' });
            const r = await nova.sys.wifiConnect(n.ssid, pw);
            if (r && r.ok) { toast(t('Verbonden met {name}', { name: n.ssid })); await refreshStatus(); renderCat(); } else { Sounds.error(); toast(tErr((r && r.error) || 'Verbinden mislukt'), { bad: true, icon: 'info' }); }
          }, P, val));
        }
      });
      out.push(actionRow(t('Opnieuw zoeken'), null, 'refresh', () => renderCat(), P));
    }
  }

  if (id === 'bt') {
    head(t('Bluetooth'), t('Koppel draadloze controllers, koptelefoons en speakers.'));
    const st = S.status || (await nova.sys.status());
    out.push(group(null, toggleRow(t('Bluetooth'), null, st.bluetooth.enabled, async (v) => { await nova.sys.btPower(v); await refreshStatus(); renderCat(); }, P)));
    if (st.bluetooth.enabled) {
      const list = h('div', {});
      const fill = (devs) => {
        list.innerHTML = '';
        if (!Array.isArray(devs) || !devs.length) { list.append(h('div', { class: 'row static' }, t('Nog geen apparaten. Zet je apparaat in koppelmodus en kies "Zoeken".'))); return; }
        for (const d of devs) {
          list.append(actionRow(d.name, d.connected ? t('Verbonden') : d.paired ? t('Gekoppeld') : t('Nieuw apparaat'), 'bt', async () => {
            if (d.connected) { await nova.sys.btDisconnect(d.mac); toast(t('{name} losgekoppeld', { name: d.name })); }
            else { toast(t('Verbinden met {name}…', { name: d.name }), { icon: 'refresh' }); const r = await nova.sys.btConnect(d.mac); r && r.ok ? toast(t('{name} verbonden', { name: d.name })) : toast(tErr((r && r.error) || 'Mislukt'), { bad: true, icon: 'info' }); }
            fill(await nova.sys.btDevices());
          }, P, d.connected ? h('span', { class: 'ok' }, t('Verbonden')) : null));
        }
      };
      out.push(group(t('Apparaten'), list));
      out.push(group(t('Koppelen'),
        h('div', { class: 'row static', style: { display: 'block', color: 'var(--text-2)', lineHeight: 1.6 } },
          h('b', { style: { color: 'var(--text)' } }, 'Xbox: '), t('houd de koppelknop bovenop 3 sec ingedrukt.') + ' ',
          h('b', { style: { color: 'var(--text)' } }, 'PlayStation: '), t('houd PS + Share/Create ingedrukt tot het lampje knippert.')),
        actionRow(t('Zoeken naar apparaten'), t('Duurt ongeveer 8 seconden'), 'refresh', async (row) => {
          $('.r-title', row).textContent = t('Zoeken…');
          fill(await nova.sys.btScan());
          $('.r-title', row).textContent = t('Zoeken naar apparaten');
        }, P)));
      nova.sys.btDevices().then((d) => S.setCat === 'bt' && fill(d));
    }
  }

  if (id === 'sound') {
    head(t('Geluid & scherm'));
    const st = await nova.sys.status();
    if (st.volume.available) out.push(group(t('Geluid'),
      sliderRow(t('Volume'), st.volume.level, (v) => nova.sys.volume(v), { group: P }),
      toggleRow(t('Dempen'), null, st.volume.muted, () => nova.sys.mute(), P)));
    if (st.brightness.available) out.push(group(t('Scherm'), sliderRow(t('Helderheid'), st.brightness.level, (v) => nova.sys.brightness(v), { min: 5, group: P })));
    out.push(group(t('Prestaties'), perfOverlayRow(P)));
    if (!st.volume.available && !st.brightness.available) out.push(h('p', { class: 'sub' }, t('Geen geluid of scherm gevonden om te regelen.')));
  }

  if (id === 'games') {
    head(t('Games'), t('{n} games gevonden.', { n: S.games.length }));
    const counts = ['steam', 'epic', 'gog', 'amazon', 'modrinth', 'custom'].map((src) => [src, S.games.filter((g) => g.source === src).length]).filter(([, n]) => n);
    out.push(group(t('Bronnen'), ...counts.map(([src, n]) => h('div', { class: 'row static' }, h('span', { class: `badge ${src}` }, SOURCE_NAMES[src]), h('div', { class: 'r-main' }), h('span', { class: 'r-val' }, n === 1 ? t('1 game') : t('{n} games', { n }))))));
    out.push(group(t('Acties'),
      actionRow(t('Bibliotheek vernieuwen'), t('Zoek opnieuw naar geïnstalleerde games'), 'refresh', async () => { await loadGames(); rerenderAll(); renderCat(); toast(t('{n} games gevonden', { n: S.games.length })); }, P),
      actionRow(t('Steam Big Picture openen'), t('Winkel, downloads en Steam-instellingen'), 'steam', () => openSteamFront(), P)));
    // apps die geïnstalleerd zijn maar nog geen tegel hebben (Firefox, Haruna, YouTube, ...)
    const apps = await nova.games.apps().catch(() => []);
    out.push(group(t('Apps toevoegen'), ...(apps.length ? apps.map((a) => {
      const val = h('span', { class: 'r-val' }, '+');
      const row = actionRow(a.name, t('Als tegel in je bibliotheek zetten'), null, async () => {
        if (row.dataset.done) return;
        const r = await nova.games.addApp(a.id);
        if (r && r.ok) {
          row.dataset.done = '1'; val.textContent = '✓';
          toast(t('{name} staat nu in je bibliotheek', { name: r.name }));
          await loadGames(); rerenderAll();
        } else { Sounds.error(); toast(t('Toevoegen lukte niet'), { bad: true, icon: 'info' }); }
      }, P, val);
      if (a.icon) row.prepend(h('img', { class: 'app-ico', src: a.icon, alt: '' }));
      return row;
    }) : [h('div', { class: 'row static' }, rowText(t('Alles staat er al'), t('Alle geïnstalleerde apps staan al in je bibliotheek.')))])));
    // speeltijd: totaal en meest gespeeld
    const played = S.games.filter((g) => g.playtime > 0).sort((a, b) => b.playtime - a.playtime);
    if (played.length) {
      const total = played.reduce((n, g) => n + g.playtime, 0);
      out.push(group(t('Speeltijd'),
        h('div', { class: 'row static' }, rowText(t('Totaal'), t('{n} games gespeeld', { n: played.length })), h('span', { class: 'r-val' }, playtimeText(total))),
        ...played.slice(0, 5).map((g, i) => h('div', { class: 'row static' }, rowText(`${i + 1}. ${g.title}`, g.lastPlayed ? relTime(g.lastPlayed) : null), h('span', { class: 'r-val' }, playtimeText(g.playtime))))));
    }
    out.push(group(t('Eigen games toevoegen'), h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.6, color: 'var(--text-2)' } },
      ...tx('Ga naar de bureaubladmodus en zet je games in {file}. Epic-, GOG- en Amazon-games uit Heroic verschijnen vanzelf.', { file: h('b', { style: { color: 'var(--text)' } }, '~/.config/randomos/games.json') }))));
  }

  if (id === 'system') {
    head(t('Systeem'));
    out.push(await updatesGroup(P));
    const i = await nova.sys.info();
    const dl = h('dl', { class: 'info-grid' });
    // schijfruimte komt als "182 GB vrij van 237 GB" uit de backend
    const disk = i.disk && i.disk.match(/^(.+) vrij van (.+)$/);
    const diskText = disk ? t('{free} vrij van {total}', { free: disk[1], total: disk[2] }) : i.disk;
    for (const [k, v] of [['Systeem', i.os], ['Processor', i.cpu], ['Graphics', (i.gpu || []).join(', ')], ['Geheugen', i.ram], ['Opslag', diskText], ['Kernel', i.kernel], ['Image', i.image]]) {
      if (v) dl.append(h('dt', {}, t(k)), h('dd', {}, v));
    }
    out.push(group(t('Over dit apparaat'), dl));
    out.push(group(t('Geavanceerd'),
      actionRow(t('Bureaubladmodus'), t('Schakel naar het gewone bureaublad'), 'desktop', () => nova.sys.power('desktop'), P),
      actionRow(t('Gewone Steam-interface gebruiken'), t('Start Game Mode voortaan zonder RandomOS Shell. Terug via het bureaublad.'), 'steam', async () => {
        const ok = await confirmBox(t('Steam-interface gebruiken?'), t('Game Mode start dan met de gewone Steam-interface. Je kunt terug via "RandomOS Shell weer gebruiken" in de bureaubladmodus.'), t('Overschakelen'));
        if (ok) nova.sys.power('steam-ui');
      }, P),
      actionRow(t('RandomOS Shell herstarten'), null, 'restart', () => nova.sys.power('restart-shell'), P),
      actionRow(t('Instellingen terugzetten'), t('Alles van de shell terug naar standaard (je games blijven)'), 'refresh', async () => {
        const ok = await confirmBox(t('Alles terugzetten?'), t('Thema, kleuren, controller- en energie-instellingen gaan terug naar standaard. Favorieten en verborgen games blijven.'), t('Terugzetten'));
        if (!ok) return;
        await saveSettings({ ...DEFAULT_LOOK });
        toast(t('Instellingen teruggezet'));
        rerenderAll();
        refreshCat();
      }, P)));
  }

  if (id === 'about') {
    head(t('Over RandomOS'));
    out.push(h('div', { class: 'row static', style: { display: 'flex', gap: '24px', alignItems: 'center', padding: '10px 4px 26px' } },
      h('img', { class: 'about-mascot', src: 'img/mascot.png', alt: '' }),
      h('div', {}, h('div', { class: 'display', style: { fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em' } }, 'RandomOS'), h('div', { style: { color: 'var(--text-2)', marginTop: '4px' } }, 'RandomOS Shell 1.1'))));
    out.push(group(null, h('div', { class: 'row static', style: { display: 'block', lineHeight: 1.7, color: 'var(--text-2)' } },
      t('Een eigen console-OS, gebouwd op Bazzite en Fedora Linux. Games draaien via Steam en Proton; updates komen elke dag automatisch binnen.'))));
    out.push(group(t('Bediening'), h('div', { class: 'row static', style: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '12px 18px', alignItems: 'center' } },
      glyph('a'), t('Kiezen / spelen'), glyph('b'), t('Terug'), glyph('x'), t('Favoriet maken'), glyph('y'), t('Snelmenu'),
      h('span', { style: { display: 'flex', gap: '4px' } }, glyph('lb'), glyph('rb')), t('Tabblad wisselen'),
      glyph('start'), t('Aan/uit-menu'), glyph('guide'), t('Naar Home (ingedrukt houden tijdens een game: game stoppen)'))));
  }

  if (S.setCat !== id) return;
  panel.innerHTML = '';
  panel.append(...out);
  if (Focus.current && Focus.current.dataset.group === P && !Focus.current.isConnected) Focus.first(P);
  updateHints();
}

// Standaardwaarden voor "Instellingen terugzetten" (favorieten/verborgen/naam blijven)
const DEFAULT_LOOK = {
  lang: 'auto', theme: 'space', accent: '#2aa8e8', bgStyle: 'art', tiles: 'normal', titles: false, text: 'normal',
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
  toast(nowHidden ? t('{title} verborgen', { title: g.title }) : t('{title} is weer zichtbaar', { title: g.title }), { icon: nowHidden ? 'info' : 'check' });
  rerenderAll();
}

// ---------------------------------------------------------------- updates
function fmtUpdateDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(I18N.locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

async function updatesGroup(P) {
  const st = await nova.updates.status();
  const box = h('div', {});
  if (!st || !st.available) {
    box.append(h('div', { class: 'row static', style: { color: 'var(--text-2)' } }, t('Updates zijn hier niet beschikbaar.')));
    return group(t('Updates'), box);
  }
  const versionRow = h('div', { class: 'row static' },
    h('span', { class: 'ico refresh' }),
    h('div', { class: 'r-main' }, h('div', { class: 'r-title' }, t('Versie {v}', { v: st.version || '?' })), h('div', { class: 'r-desc' }, fmtUpdateDate(st.date))));
  box.append(versionRow);

  const progress = h('div', { class: 'row static upd-progress', style: { display: 'none' } }, h('div', { class: 'spinner', style: { width: '22px', height: '22px', borderWidth: '3px' } }), h('div', { class: 'r-main' }, ''));
  const setProgress = (text) => { progress.style.display = ''; $('.r-main', progress).textContent = text; };

  const rebootRow = () => actionRow(t('Herstarten om de update te installeren'), st.staged ? t('Versie {v} staat klaar', { v: st.staged.version || '' }) : null, 'restart', async () => {
    const ok = await confirmBox(t('Nu herstarten?'), t('De laptop start opnieuw op met de nieuwe versie. Dat duurt ongeveer een minuut.'), t('Herstarten'));
    if (ok) nova.sys.power('reboot');
  }, P);

  if (st.staged) {
    box.append(rebootRow());
  } else {
    const checkRow = actionRow(t('Zoeken naar updates'), t('RandomOS zoekt ook elke dag automatisch'), 'refresh', async (row) => {
      $('.r-title', row).textContent = t('Zoeken…');
      const r = await nova.updates.check();
      if (r && r.available) {
        $('.r-title', row).textContent = t('Update beschikbaar');
        $('.r-desc', row).textContent = r.version ? t('Versie {v}', { v: r.version }) : '';
        const go = actionRow(t('Nu updaten'), t('Downloaden en klaarzetten; je kunt gewoon blijven spelen'), 'restart', async () => {
          go.remove();
          setProgress(t('Update downloaden…'));
          const done = await nova.updates.upgrade();
          if (done && done.ok && !done.nothing) {
            progress.style.display = 'none';
            toast(t('Update klaar! Herstart om hem te installeren.'), { icon: 'check', ms: 6000 });
            S.updateStaged = true;
            refreshCat();
          } else if (done && done.nothing) {
            setProgress(t('Je hebt al de nieuwste versie'));
          } else {
            setProgress(t((done && done.error) || 'Update mislukt'));
            Sounds.error();
          }
        }, P);
        row.after(go);
        Focus.set(go);
      } else if (r && r.error) {
        $('.r-title', row).textContent = t('Zoeken naar updates');
        toast(t(r.error), { bad: true, icon: 'info' });
      } else {
        $('.r-title', row).textContent = t('Je hebt de nieuwste versie');
      }
    }, P);
    box.append(checkRow);
  }
  box.append(progress);
  if (st.canRollback) {
    box.append(actionRow(t('Terug naar vorige versie'), t('Als een update problemen geeft. Wordt actief na een herstart.'), 'restart', async () => {
      const ok = await confirmBox(t('Vorige versie terugzetten?'), t('Na de volgende herstart start de laptop met de vorige versie van RandomOS.'), t('Terugzetten'));
      if (!ok) return;
      const r = await nova.updates.rollback();
      toast(r && r.ok ? t('Vorige versie staat klaar. Herstart om terug te gaan.') : t('Terugzetten mislukt'), { icon: r && r.ok ? 'check' : 'info', bad: !(r && r.ok) });
    }, P));
  }
  return group(t('Updates'), box);
}
nova.updates && nova.updates.onProgress((line) => {
  const el = $('.upd-progress .r-main');
  if (!el) return;
  const m = line.match(/(\d+)\/(\d+)/);
  el.textContent = m ? t('Update downloaden… {a} van {b}', { a: m[1], b: m[2] }) : /Staging|deploy/i.test(line) ? t('Update klaarzetten…') : t('Update downloaden…');
});
