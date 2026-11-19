// Bouwstenen voor menu's en instellingen

function group(title, ...children) {
  return h('div', { class: 'set-group' }, title ? h('h3', {}, title) : null, ...children);
}

function rowText(title, desc) {
  return h('div', { class: 'r-main' }, h('div', { class: 'r-title' }, title), desc ? h('div', { class: 'r-desc' }, desc) : null);
}

// Schuifje: links/rechts past de waarde aan
function sliderRow(title, value, onChange, { step = 5, min = 0, max = 100, group = 'qm', unit = '%', desc = null } = {}) {
  let v = value;
  const fill = h('div', { class: 'fill' }), knob = h('div', { class: 'knob' }), num = h('span', { class: 'num' });
  const track = h('div', { class: 'track' }, fill, knob);
  const paint = () => { const p = ((v - min) / (max - min)) * 100; fill.style.width = p + '%'; knob.style.left = p + '%'; num.textContent = `${v}${unit}`; };
  let t = null;
  const commit = () => { clearTimeout(t); t = setTimeout(() => onChange(v), 90); };
  const row = h('div', { class: 'row', 'data-focus': true, 'data-slider': '', 'data-group': group },
    h('div', { class: 'r-main', style: { flex: '0 0 auto', minWidth: '7.5em' } }, h('div', { class: 'r-title' }, title), desc ? h('div', { class: 'r-desc' }, desc) : null),
    h('div', { class: 'slider' }, track, num));
  row.addEventListener('adjust', (e) => { const nv = Math.max(min, Math.min(max, v + e.detail * step)); if (nv !== v) { v = nv; paint(); Sounds.tick(); commit(); } });
  track.addEventListener('click', (e) => { const r = track.getBoundingClientRect(); v = Math.round(((e.clientX - r.left) / r.width) * (max - min) / step) * step + min; v = Math.max(min, Math.min(max, v)); paint(); commit(); });
  paint();
  return row;
}

// Aan/uit-schakelaar
function toggleRow(title, desc, on, onChange, group) {
  let state = !!on;
  const tg = h('div', { class: `toggle${state ? ' on' : ''}` });
  const row = h('button', { class: 'row', 'data-focus': true, 'data-group': group }, rowText(title, desc), tg);
  row.addEventListener('click', async () => { state = !state; tg.classList.toggle('on', state); Sounds.toggle(state); Input.rumble(); await onChange(state); });
  return row;
}

// Knop-rij die iets doet
function actionRow(title, desc, icon, onClick, group, value) {
  const row = h('button', { class: 'row', 'data-focus': true, 'data-group': group },
    icon ? h('span', { class: `ico ${icon}` }) : null,
    rowText(title, desc),
    value != null ? (value.nodeType ? value : h('span', { class: 'r-val' }, value)) : null);
  row.addEventListener('click', () => { Sounds.select(); onClick(row); });
  return row;
}

// Keuze in console-stijl: ◀ Normaal ▶ (links/rechts of A om te wisselen)
function choiceRow(title, desc, options, value, onChange, group) {
  let i = Math.max(0, options.findIndex((o) => o[0] === value));
  const opts = options.map(([, label], k) => h('span', { class: `opt${k === i ? ' on' : ''}` }, label));
  const pills = h('div', { class: 'choice' }, ...opts);
  const row = h('div', { class: 'row', 'data-focus': true, 'data-slider': '', 'data-group': group }, rowText(title, desc), pills);
  const set = (k) => {
    if (k === i) return;
    i = k;
    opts.forEach((p, n) => p.classList.toggle('on', n === i));
    Sounds.tick();
    onChange(options[i][0]);
  };
  row.addEventListener('adjust', (e) => set(Math.max(0, Math.min(options.length - 1, i + e.detail))));
  row.addEventListener('click', (e) => {
    const hit = e.target.closest('.opt');
    set(hit ? opts.indexOf(hit) : (i + 1) % options.length);
  });
  return row;
}

function confirmBox(title, text, okLabel) {
  return new Promise((resolve) => {
    let modal;
    const done = (v) => { UI.closeModal(modal); resolve(v); };
    modal = UI.openModal(h('div', { class: 'sheet power-sheet', style: { maxWidth: '560px' } },
      h('h2', {}, title), h('p', { style: { color: 'var(--text-2)', lineHeight: 1.6, margin: '0 6px 24px' } }, text),
      h('div', { style: { display: 'flex', gap: '12px' } },
        h('button', { class: 'btn primary', 'data-focus': true, onclick: () => done(true) }, okLabel),
        h('button', { class: 'btn ghost', 'data-focus': true, 'data-autofocus': true, onclick: () => done(false) }, 'Annuleren'))),
    { onBack: () => done(false) });
  });
}
