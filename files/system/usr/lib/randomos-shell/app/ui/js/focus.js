// Ruimtelijke navigatie: kies het dichtstbijzijnde element in de richting die je drukt.
const Focus = (() => {
  let current = null;
  const memory = new Map(); // groep -> laatst gefocust element
  let scopeFn = () => document.body;

  function visible(el) {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    // niet op computed visibility leunen: die schakelt pas na de overgangsanimatie om
    return !el.closest('.screen:not(.active), .modal.closing') && el.closest('[style*="visibility: hidden"]') === null;
  }

  function candidates() {
    return $$('[data-focus]', scopeFn()).filter((el) => !el.disabled && visible(el));
  }

  function set(el, { silent = false, scroll = true } = {}) {
    if (!el || el === current) return;
    if (current) current.classList.remove('focused');
    current = el;
    el.classList.add('focused');
    if (el.dataset.group) memory.set(el.dataset.group, el);
    if (scroll) scrollIntoView(el);
    if (!silent) Sounds.move();
    el.dispatchEvent(new CustomEvent('focusin-nova', { bubbles: true }));
  }

  function scrollIntoView(el) {
    const scroller = el.closest('.rail, .grid, .set-panel, .sheet');
    if (!scroller) return;
    if (scroller.classList.contains('rail')) {
      const target = el.offsetLeft - scroller.clientWidth * 0.08;
      scroller.scrollTo({ left: Math.max(0, target - parseFloat(getComputedStyle(scroller).paddingLeft || 0) * 0.5), behavior: 'smooth' });
    } else {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function move(dir) {
    if (!current || !current.isConnected || !visible(current)) { first(); return true; }
    // sliders vangen links/rechts zelf af
    if ((dir === 'left' || dir === 'right') && current.dataset.slider !== undefined) {
      current.dispatchEvent(new CustomEvent('adjust', { detail: dir === 'right' ? 1 : -1 }));
      return true;
    }
    const from = current.getBoundingClientRect();
    const fc = center(from);
    const all = candidates().filter((el) => el !== current);
    const horizontal = dir === 'left' || dir === 'right';
    const group = current.dataset.group;

    const scored = [];
    for (const el of all) {
      // de tabbladen bovenin zijn alleen bereikbaar met omhoog; links/rechts blijft in de eigen laag
      if (horizontal && (el.dataset.group === 'tabs') !== (group === 'tabs')) continue;
      const r = el.getBoundingClientRect();
      const c = center(r);
      let primary, secondary;
      if (dir === 'right') { primary = r.left - from.right; secondary = Math.abs(c.y - fc.y); if (c.x <= fc.x + 2) continue; }
      if (dir === 'left') { primary = from.left - r.right; secondary = Math.abs(c.y - fc.y); if (c.x >= fc.x - 2) continue; }
      if (dir === 'down') { primary = r.top - from.bottom; secondary = Math.abs(c.x - fc.x); if (c.y <= fc.y + 2) continue; }
      if (dir === 'up') { primary = from.top - r.bottom; secondary = Math.abs(c.x - fc.x); if (c.y >= fc.y - 2) continue; }
      primary = Math.max(primary, -Math.min(r.width, r.height) * 0.5);
      // overlap op de andere as maakt een kandidaat veel aantrekkelijker
      const overlap = horizontal
        ? Math.min(from.bottom, r.bottom) - Math.max(from.top, r.top)
        : Math.min(from.right, r.right) - Math.max(from.left, r.left);
      let score = primary + secondary * (overlap > 0 ? 0.3 : 2.2);
      if (horizontal && group && el.dataset.group === group) score -= 10000; // in dezelfde rij blijven
      scored.push({ el, score, group: el.dataset.group });
    }
    if (!scored.length) return false;
    scored.sort((a, b) => a.score - b.score);
    let pick = scored[0].el;
    // bij wisselen van groep: terug naar waar je in die groep was
    const g = pick.dataset.group;
    if (g && g !== group && memory.has(g)) {
      const remembered = memory.get(g);
      if (remembered.isConnected && visible(remembered) && all.includes(remembered)) pick = remembered;
    } else if (g && g !== group && horizontal) {
      // nieuw paneel zijwaarts binnengaan: begin bovenaan
      const same = all.filter((e) => e.dataset.group === g);
      same.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      if (same.length) pick = same[0];
    }
    set(pick);
    return true;
  }

  function first(preferGroup) {
    const list = candidates();
    let el = null;
    if (preferGroup) {
      const m = memory.get(preferGroup);
      el = m && m.isConnected && list.includes(m) ? m : list.find((e) => e.dataset.group === preferGroup);
    }
    el = el || list.find((e) => e.dataset.autofocus !== undefined) || list[0];
    if (el) set(el, { silent: true });
  }

  return {
    move, set, first,
    get current() { return current; },
    setScope(fn) { scopeFn = fn; },
    forget(group) { memory.delete(group); },
    clear() { if (current) current.classList.remove('focused'); current = null; },
  };
})();
