// Schermtoetsenbord voor controller (wifi-wachtwoord, zoeken, naam)
const OSK = (() => {
  const ROWS = [
    '1234567890'.split(''),
    'qwertyuiop'.split(''),
    'asdfghjkl@'.split(''),
    ['⇧', ...'zxcvbnm'.split(''), '-', '.', '_'],
  ];

  function open({ title = t('Typ iets'), value = '', password = false, placeholder = '' } = {}) {
    return new Promise((resolve) => {
      let text = value, shift = false, reveal = false;
      const field = h('div', { class: 'osk-field' });
      const rowsEl = h('div', { class: 'osk-rows' });

      const render = () => {
        field.innerHTML = '';
        const shown = password && !reveal ? '•'.repeat(text.length) : text;
        if (!text && placeholder) field.append(h('span', { class: 'ph' }, placeholder));
        else field.append(document.createTextNode(shown));
        field.append(h('span', { class: 'caret' }));
        $$('.key.letter', rowsEl).forEach((k) => { k.textContent = shift ? k.dataset.k.toUpperCase() : k.dataset.k; });
        const sk = $('.key.shift', rowsEl); if (sk) sk.classList.toggle('on', shift);
        const rk = $('.key.reveal', rowsEl); if (rk) rk.textContent = reveal ? t('Verberg') : t('Toon');
      };

      const type = (ch) => { text += ch; if (shift && /[a-z]/i.test(ch)) shift = false; Sounds.tick(); render(); };
      const backspace = () => { text = text.slice(0, -1); Sounds.tick(); render(); };

      for (const row of ROWS) {
        const r = h('div', { class: 'osk-row' });
        for (const k of row) {
          if (k === '⇧') r.append(h('button', { class: 'key shift', 'data-focus': true, 'data-group': 'osk', onclick: () => { shift = !shift; Sounds.toggle(shift); render(); } }, '⇧'));
          else r.append(h('button', { class: 'key letter', 'data-k': k, 'data-focus': true, 'data-group': 'osk', onclick: () => type(shift ? k.toUpperCase() : k) }, k));
        }
        rowsEl.append(r);
      }
      const last = h('div', { class: 'osk-row' });
      if (password) last.append(h('button', { class: 'key wide reveal', 'data-focus': true, 'data-group': 'osk', onclick: () => { reveal = !reveal; render(); } }, t('Toon')));
      last.append(
        h('button', { class: 'key wide', 'data-focus': true, 'data-group': 'osk', onclick: backspace }, '⌫'),
        h('button', { class: 'key xwide', 'data-focus': true, 'data-group': 'osk', onclick: () => type(' ') }, t('spatie')),
        h('button', { class: 'key wide accent', 'data-focus': true, 'data-group': 'osk', onclick: () => done(text) }, t('Klaar')),
      );
      rowsEl.append(last);

      const sheet = h('div', { class: 'sheet osk-sheet' },
        h('h3', {}, title), field, rowsEl,
        h('div', { class: 'osk-help' },
          h('span', { class: 'hint' }, glyph('x'), t('Wissen')),
          h('span', { class: 'hint' }, glyph('y'), t('Spatie')),
          h('span', { class: 'hint' }, glyph('start'), t('Klaar')),
          h('span', { class: 'hint' }, glyph('b'), t('Annuleren'))));

      let modal;
      const done = (val) => { Input.textMode = false; UI.closeModal(modal); resolve(val); };
      modal = UI.openModal(sheet, {
        onBack: () => done(null),
        onAction: (a, extra) => {
          if (a === 'char') { type(extra); return true; }
          if (a === 'x') { backspace(); return true; }
          if (a === 'y') { type(' '); return true; }
          if (a === 'start' || (a === 'a' && extra && extra.source === 'keyboard')) { done(text); return true; }
          return false;
        },
        focus: () => Focus.set($('.key.letter[data-k="q"]', rowsEl), { silent: true }),
      });
      Input.textMode = true;
      render();
    });
  }

  return { open };
})();
