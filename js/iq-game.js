// De IQ-test op de gsm: los zoveel mogelijk puzzels op, sla over wat je niet kunt.
// IQ.mount(box, { key, onProgress(punten, aantalOpgelost) }) start de test in een element.
(function () {
  const MAX_TRIES = { choice: 1, matrix: 1, num: 2, text: 2, sudoku: 2, sort: 2 };
  const SAVE = 'quiz-iq';

  // Blokken die je kunt verslepen. box.value() geeft de huidige volgorde.
  function dragList(items) {
    const box = h('div', { class: 'drag-list' }, items.map((t) => h('div', { class: 'drag-item' }, t)));
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      const it = e.target.closest('.drag-item');
      if (!it) return;
      drag = it;
      it.classList.add('dragging');
      box.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const others = [...box.children].filter((c) => c !== drag);
      const after = others.find((c) => {
        const r = c.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (after) {
        if (drag.nextSibling !== after) box.insertBefore(drag, after);
      } else if (box.lastChild !== drag) box.append(drag);
    });
    const end = () => {
      if (drag) drag.classList.remove('dragging');
      drag = null;
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.value = () => [...box.children].map((c) => c.textContent);
    return box;
  }

  // Tekent één figuur van een matrixpuzzel.
  function figure(spec) {
    const kind = spec[0];
    const n = Number(spec.slice(1));
    let inner = '';
    if (kind === 'a') {
      inner = `<g transform="rotate(${n} 30 30)"><path d="M30 8 L46 30 L36 30 L36 52 L24 52 L24 30 L14 30 Z"/></g>`;
    } else {
      const xs = n === 1 ? [30] : n === 2 ? [19, 41] : [12, 30, 48];
      const r = n === 1 ? 14 : n === 2 ? 9 : 7;
      inner = xs
        .map((x) =>
          kind === 'c'
            ? `<circle cx="${x}" cy="30" r="${r}"/>`
            : kind === 's'
              ? `<rect x="${x - r}" y="${30 - r}" width="${2 * r}" height="${2 * r}"/>`
              : `<path d="M${x} ${30 - r} L${x + r} ${30 + r} L${x - r} ${30 + r} Z"/>`
        )
        .join('');
    }
    const d = h('div', { class: 'fig' });
    d.innerHTML = `<svg viewBox="0 0 60 60">${inner}</svg>`;
    return d;
  }

  function mount(box, opts) {
    const P = window.IQ_PUZZLES;
    let st = null;
    try {
      st = JSON.parse(sessionStorage.getItem(SAVE));
    } catch (e) {}
    if (!st || st.key !== opts.key) {
      st = { key: opts.key, queue: shuffled(P.map((_, i) => i)), pts: 0, n: 0, tries: {} };
    }
    const save = () => sessionStorage.setItem(SAVE, JSON.stringify(st));
    const head = h('div', { class: 'iq-head' });
    const card = h('div', { class: 'iq-card' });
    const flash = h('p', { class: 'iq-flash' });
    fill(box, head, flash, card);

    function note(text, kind) {
      flash.textContent = text;
      flash.className = 'iq-flash ' + kind;
      void flash.offsetWidth;
      flash.classList.add('show');
    }

    function done(ok) {
      const i = st.queue[0];
      const pz = P[i];
      if (ok) {
        st.pts += pz.p;
        st.n++;
        st.queue.shift();
        note('Juist! +' + pz.p, 'good');
        SFX.good();
        FX.burstAt(head, 40, 6);
        opts.onProgress(st.pts, st.n);
      } else {
        st.tries[i] = (st.tries[i] || 0) + 1;
        const left = MAX_TRIES[pz.t] - st.tries[i];
        SFX.bad();
        FX.shake(card);
        if (left <= 0) {
          st.queue.shift();
          note('Fout. Deze puzzel is weg.', 'bad');
        } else {
          note('Fout. Nog ' + left + (left === 1 ? ' poging.' : ' pogingen.'), 'bad');
          save();
          return;
        }
      }
      save();
      show();
    }

    function skip() {
      st.queue.push(st.queue.shift());
      SFX.click();
      save();
      show();
    }

    function show() {
      fill(head, h('span', {}, st.n + ' opgelost'), h('strong', {}, fmt(st.pts) + ' punten'));
      if (!st.queue.length) {
        fill(card, h('p', { class: 'status' }, 'Je hebt alle puzzels gehad. Knap!'));
        return;
      }
      const pz = P[st.queue[0]];
      const buttons = (check) =>
        h(
          'div',
          { class: 'sub-buttons' },
          plaque('button', { type: 'button', class: 'skip', onclick: skip }, 'Sla over'),
          check ? plaque('button', { type: 'button', onclick: check }, 'Controleer') : null
        );
      const title = h('p', { class: 'iq-q' }, pz.q || (pz.t === 'sudoku' ? 'Vul in: elke rij, kolom en blok van 4 bevat 1, 2, 3 en 4.' : 'Welke figuur ontbreekt?'));
      const worth = h('p', { class: 'iq-worth' }, pz.p + ' punten');

      if (pz.t === 'num' || pz.t === 'text') {
        const isNum = pz.t === 'num';
        const input = h('input', { inputMode: isNum ? 'decimal' : 'text', maxLength: 20, autocomplete: 'off', autocapitalize: 'off', placeholder: isNum ? 'Getal' : 'Woord' });
        const check = () => {
          const raw = input.value.trim();
          if (!raw) return FX.shake(input);
          if (isNum) {
            const v = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
            if (!isFinite(v)) return FX.shake(input);
            done(v === pz.a);
          } else {
            done(textMatches(raw, pz.a));
          }
          input.value = '';
        };
        const big = pz.seq || pz.big;
        fill(
          card,
          worth,
          title,
          big ? h('p', { class: 'iq-big' }, big) : null,
          h('form', { onsubmit: (e) => (e.preventDefault(), check()) }, input),
          buttons(check)
        );
      } else if (pz.t === 'choice') {
        fill(
          card,
          worth,
          title,
          h('div', { class: 'options' }, pz.o.map((t, i) => plaque('button', { class: 'option', type: 'button', onclick: () => done(i === pz.a) }, t))),
          buttons()
        );
      } else if (pz.t === 'matrix') {
        const grid = h('div', { class: 'fig-grid' }, pz.cells.map(figure), h('div', { class: 'fig missing' }, '?'));
        const opts2 = h(
          'div',
          { class: 'fig-options' },
          pz.o.map((s, i) => {
            const b = h('button', { class: 'fig-btn', type: 'button', onclick: () => done(i === pz.a) });
            b.append(figure(s));
            return b;
          })
        );
        fill(card, worth, title, grid, opts2, buttons());
      } else if (pz.t === 'sudoku') {
        const vals = pz.g.split('').map((c) => (c === '.' ? 0 : Number(c)));
        const grid = h(
          'div',
          { class: 'sudoku' },
          vals.map((v, i) => {
            const fixed = pz.g[i] !== '.';
            const cell = h('button', { type: 'button', class: 'cell' + (fixed ? ' fixed' : ''), disabled: fixed }, v || '');
            if (!fixed) {
              cell.onclick = () => {
                vals[i] = (vals[i] + 1) % 5;
                cell.textContent = vals[i] || '';
                SFX.click();
              };
            }
            return cell;
          })
        );
        fill(card, worth, title, h('p', { class: 'hint small-text' }, 'Tik op een vakje om het cijfer te veranderen.'), grid, buttons(() => done(vals.join('') === pz.s)));
      } else if (pz.t === 'sort') {
        let start = shuffled(pz.items);
        for (let k = 0; k < 10 && start.every((it, j) => it === pz.items[j]); k++) start = shuffled(pz.items);
        const list = dragList(start);
        fill(card, worth, title, list, buttons(() => done(list.value().every((it, j) => it === pz.items[j]))));
      }
    }

    save();
    show();
    opts.onProgress(st.pts, st.n);
  }

  window.IQ = { mount, dragList };
})();
