// Speler-scherm (gsm): code ingeven, naam ingeven, antwoorden en de spelletjes spelen.
// sessionStorage wordt gebruikt zodat elk tabblad een aparte speler is
// (handig om te testen) en een refresh je niet uit het spel gooit.

(async function () {
  const PIN_KEY = 'quiz-player-pin';
  const ID_KEY = 'quiz-player-id';
  const ANS_KEY = 'quiz-player-answer';
  const HINT_KEY = 'quiz-player-hint';
  const PICK_KEY = 'quiz-player-pick';
  const TIMED = ['whois-write', 'hide-place', 'hide-seek', 'iq-play'];

  let pid = sessionStorage.getItem(ID_KEY);
  if (!pid) {
    pid = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem(ID_KEY, pid);
  }

  let pin = null;
  let pendingPin = null;
  let me = null;
  let state = null;
  let config = {};
  let scores = {};
  let unsubs = [];
  let builtQn = -1;
  let resultQn = -1;
  let endShown = false;
  let gameKey = '';
  let myAnswer = null; // { qn, v }
  let myHint = null; // mijn profiel bij Wie is het?: { text, color, animal, traits, k, at }
  let editingHint = false;
  let formOpen = false;
  let myPick = null; // { key, team }
  let allPlayers = {}; // alleen geladen voor de spelletjes die het nodig hebben
  let iq = {};
  let subs = {};
  let seek = null; // toestand van het zoeken bij verstoppertje
  const timer = { started: false, lastSec: null, timeup: false };

  try {
    myAnswer = JSON.parse(sessionStorage.getItem(ANS_KEY));
    myPick = JSON.parse(sessionStorage.getItem(PICK_KEY));
    myHint = JSON.parse(sessionStorage.getItem(HINT_KEY));
  } catch (e) {}

  const path = (sub) => 'games/' + pin + (sub ? '/' + sub : '');
  const answeredThis = (s) => !!(myAnswer && s && myAnswer.qn === s.qn);
  const buzz = (ms) => navigator.vibrate && navigator.vibrate(ms);
  const nameOf = (id) => (allPlayers[id] ? allPlayers[id].name : '?');

  // Niet inzoomen, geen tekst selecteren, geen menu bij lang drukken.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.matches('input, textarea')) e.preventDefault();
  });
  document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });

  try {
    await Store.ready;
  } catch (e) {
    $('#loadingText').textContent = e.message;
    return;
  }
  if (Store.mode === 'demo') showBanner('Demo-modus: werkt alleen tussen tabbladen van deze browser.');

  const urlPin = new URLSearchParams(location.search).get('pin');
  if (urlPin) $('#pinInput').value = urlPin;

  // Terugkomen na een refresh
  const savedPin = sessionStorage.getItem(PIN_KEY);
  let resumed = false;
  if (savedPin) {
    try {
      if (await Store.get('games/' + savedPin + '/players/' + pid)) {
        pin = savedPin;
        attach();
        resumed = true;
      }
    } catch (e) {}
  }
  if (!resumed) showCode();

  setInterval(onTick, 100);

  // ---------- Stap 1: code ----------
  function showCode(message) {
    $('#playerBar').hidden = true;
    $('#intro').hidden = true;
    showView('v-code');
    const err = $('#codeError');
    err.hidden = !message;
    err.textContent = message || '';
  }

  $('#pinInput').oninput = (e) => (e.target.value = e.target.value.replace(/\D/g, ''));

  $('#codeForm').onsubmit = async (e) => {
    e.preventDefault();
    SFX.click();
    const p = $('#pinInput').value.trim();
    if (!p) return;
    $('#codeBtn').disabled = true;
    try {
      const [created, phase, title] = await Promise.all([
        Store.get('games/' + p + '/createdAt'),
        Store.get('games/' + p + '/state/phase'),
        Store.get('games/' + p + '/title')
      ]);
      if (!created) {
        FX.shake($('#pinInput'));
        return showCode('Deze code bestaat niet. Kijk nog eens op het grote scherm.');
      }
      if (phase === 'end') return showCode('Deze quiz is al afgelopen.');
      pendingPin = p;
      $('#gameTitle').textContent = title || 'Quiz';
      $('#nameError').hidden = true;
      showView('v-name');
      $('#nameInput').focus();
    } catch (err) {
      showCode('Geen verbinding: ' + err.message);
    } finally {
      $('#codeBtn').disabled = false;
    }
  };

  $('#backBtn').onclick = () => showCode();

  // ---------- Stap 2: naam ----------
  $('#nameForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#nameInput').value.trim().slice(0, 16);
    if (!name || !pendingPin) return;
    const fail = (msg) => {
      $('#nameError').textContent = msg;
      $('#nameError').hidden = false;
      FX.shake($('#nameInput'));
    };
    $('#nameBtn').disabled = true;
    try {
      const others = (await Store.get('games/' + pendingPin + '/players')) || {};
      if (Object.keys(others).length >= MAX_PLAYERS) return fail('Deze quiz zit vol.');
      if (Object.values(others).some((o) => o.name.toLowerCase() === name.toLowerCase())) {
        return fail('Deze naam is al in gebruik. Kies een andere.');
      }
      pin = pendingPin;
      await Store.set(path('players/' + pid), { name, joinedAt: Store.now() });
      sessionStorage.setItem(PIN_KEY, pin);
      SFX.good();
      attach();
    } catch (err) {
      fail('Geen verbinding: ' + err.message);
    } finally {
      $('#nameBtn').disabled = false;
    }
  };

  function attach() {
    let sawMe = false;
    unsubs = [
      Store.on(path('players/' + pid), (v) => {
        if (!v && sawMe) return leave('Je bent uit het spel verwijderd.');
        if (v) sawMe = true;
        me = v;
        render();
      }),
      Store.on(path('state'), (v) => {
        state = v;
        render();
      }),
      Store.on(path('config'), (v) => {
        config = v || {};
        render();
      }),
      Store.on(path('scores'), (v) => {
        scores = v || {};
        render();
      })
    ];
  }

  // Extra gegevens pas ophalen wanneer een spelletje ze nodig heeft.
  function need(what) {
    if (subs[what]) return;
    subs[what] = true;
    unsubs.push(
      Store.on(path(what), (v) => {
        if (what === 'players') allPlayers = v || {};
        else iq = v || {};
        render();
      })
    );
  }

  function leave(message) {
    unsubs.forEach((u) => u());
    unsubs = [];
    subs = {};
    sessionStorage.removeItem(PIN_KEY);
    pin = null;
    me = null;
    state = null;
    showCode(message);
  }

  // ---------- Antwoorden ----------
  function answer(v) {
    const s = state;
    if (!s || s.phase !== 'question' || answeredThis(s)) return;
    const ms = Store.now() - s.startedAt;
    if (ms < 0 || ms > s.question.duration * 1000) return;
    myAnswer = { qn: s.qn, v };
    sessionStorage.setItem(ANS_KEY, JSON.stringify(myAnswer));
    Store.set(path('answers/q' + s.qn + '/' + pid), { v, ms });
    SFX.send();
    buzz(30);
    render();
  }

  function describe(q, v) {
    if (q.type === 'choice') return q.options[v];
    if (q.type === 'number') return fmt(v) + (q.unit ? ' ' + q.unit : '');
    if (q.type === 'location') return 'Je locatie is doorgestuurd';
    if (q.type === 'order') return v.join(' → ');
    if (q.type === 'who') return (q.names.find((n) => n.id === v) || {}).name || '';
    return String(v);
  }

  function setStatus(title, detail) {
    $('#qBody').hidden = !!title;
    $('#qStatus').hidden = !title;
    if (title) fill($('#qStatus'), title, detail ? h('strong', {}, detail) : null);
  }

  const isMyHint = (q) => q.type === 'who' && !!myHint && !!q.profile && !!q.profile.k && q.profile.k === myHint.k;

  function onTick() {
    const s = state;
    const intro = $('#intro');
    if (!pin || !s) {
      intro.hidden = true;
      return;
    }
    const now = Store.now();
    if (s.phase === 'question') {
      const dur = s.question.duration;
      if (now < s.startedAt) {
        if (intro.hidden) {
          $('#introText').textContent = (s.question.label || 'Vraag') + ' ' + (s.qIndex + 1);
          intro.hidden = false;
        }
        $('#timer').textContent = dur;
        $('#fuse').style.width = '100%';
        return;
      }
      intro.hidden = true;
      if (!timer.started) {
        timer.started = true;
        SFX.go();
      }
      const left = dur - (now - s.startedAt) / 1000;
      const sec = Math.max(0, Math.ceil(left));
      $('#timer').textContent = sec;
      $('#fuse').style.width = Math.max(0, (left / dur) * 100) + '%';
      const mine = answeredThis(s) || isMyHint(s.question);
      $('#timerBox').classList.toggle('urgent', sec <= 5 && left > 0 && !mine);
      if (sec !== timer.lastSec) {
        timer.lastSec = sec;
        if (sec <= 5 && sec > 0 && !mine) SFX.tick(sec <= 3);
      }
      if (left <= 0 && !timer.timeup) {
        timer.timeup = true;
        if (!mine) {
          setStatus('Tijd om!');
          SFX.timeup();
        }
      }
    } else if (TIMED.includes(s.phase)) {
      if (now < s.startedAt) {
        if (intro.hidden) {
          $('#introText').textContent = s.intro || s.roundName;
          intro.hidden = false;
        }
        $('#gTimer').textContent = clock(s.duration);
        return;
      }
      intro.hidden = true;
      const left = s.duration - (now - s.startedAt) / 1000;
      $('#gTimer').textContent = clock(left);
      $('#gTimerBox').classList.toggle('urgent', left <= 10 && left > 0);
      if (left <= 0 && !timer.timeup) {
        timer.timeup = true;
        SFX.timeup();
        if (s.phase === 'iq-play' || s.phase === 'hide-seek') {
          fill($('#gBody'), h('p', { class: 'status' }, 'Tijd om!', h('strong', {}, 'Kijk naar het grote scherm.')));
        }
      }
    } else {
      intro.hidden = true;
    }
  }

  // ---------- Weergave ----------
  function myTeam() {
    return teamList(config).find((t) => me && t.id === me.teamId) || null;
  }

  function myRank() {
    const mine = (scores[pid] && scores[pid].total) || 0;
    return 1 + Object.values(scores).filter((s) => s.total > mine).length;
  }

  function render() {
    if (!pin || !me || !state) return;
    const s = state;
    const sc = scores[pid] || { total: 0 };
    const team = config.teamMode ? myTeam() : null;

    $('#playerBar').hidden = false;
    $('#meName').textContent = me.name;
    $('#meScore').textContent = fmt(sc.total || 0);
    const tag = $('#meTeam');
    tag.hidden = !team;
    if (team) {
      tag.textContent = team.name;
      tag.style.background = team.color;
    }

    if (s.phase === 'lobby') renderLobby();
    else if (s.phase === 'select') showView('v-wait');
    else if (s.phase === 'question') renderQuestion(s);
    else if (s.phase === 'reveal' || s.phase === 'gameresult') renderResult(s, sc);
    else if (s.phase === 'end') renderEnd(sc, team);
    else renderGame(s);
  }

  function renderLobby() {
    showView('v-lobby');
    $('#teamPick').hidden = !config.teamMode;
    if (!config.teamMode) return;
    $('#teamButtons').replaceChildren(
      ...teamList(config).map((t) =>
        plaque(
          'button',
          {
            class: 'team-btn' + (me.teamId === t.id ? ' selected' : ''),
            onclick: () => {
              SFX.click();
              Store.set(path('players/' + pid + '/teamId'), t.id);
            }
          },
          h('span', { class: 'dot', style: 'background:' + t.color + ';margin-right:10px' }),
          t.name
        )
      )
    );
  }

  function renderQuestion(s) {
    showView('v-question');
    const q = s.question;
    if (builtQn !== s.qn) {
      builtQn = s.qn;
      Object.assign(timer, { started: false, lastSec: null, timeup: false });
      $('#qCount').textContent = `${s.qIndex + 1} / ${s.qTotal}`;
      $('#qText').textContent = q.text;
      renderMedia($('#qMedia'), q.media);
      buildBody(q);
      setStatus('');
    }
    if (isMyHint(q)) setStatus('Dit ben jij!', 'Sst… niets verklappen.');
    else if (answeredThis(s)) setStatus('Antwoord verstuurd!', describe(q, myAnswer.v));
    onTick();
  }

  // Het antwoordgedeelte, per soort vraag.
  function buildBody(q) {
    const body = $('#qBody');
    const sendBtn = (label, onclick) => plaque('button', { class: 'wide', type: 'button', onclick }, label);

    if (q.type === 'choice') {
      fill(
        body,
        h(
          'div',
          { class: 'options' },
          q.options.map((text, i) => plaque('button', { class: 'option', orn: true, onclick: () => answer(i) }, text))
        )
      );
    } else if (q.type === 'who') {
      fill(
        body,
        profileCard(q.profile),
        h('p', { class: 'hint' }, 'Wie is dit?'),
        h(
          'div',
          { class: 'name-grid' },
          q.names.filter((n) => n.id !== pid).map((n) => plaque('button', { class: 'who-btn', type: 'button', onclick: () => answer(n.id) }, n.name))
        )
      );
    } else if (q.type === 'text' || q.type === 'number') {
      const isNum = q.type === 'number';
      const input = h('input', {
        maxLength: isNum ? 12 : 40,
        inputMode: isNum ? 'decimal' : 'text',
        placeholder: isNum ? 'Getal' : 'Jouw antwoord',
        autocomplete: 'off',
        autocapitalize: 'off',
        enterKeyHint: 'send'
      });
      const submit = (e) => {
        e.preventDefault();
        const raw = input.value.trim();
        if (isNum) {
          const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
          if (!isFinite(n)) return FX.shake(input);
          answer(n);
        } else {
          if (!raw) return FX.shake(input);
          answer(raw);
        }
      };
      fill(
        body,
        q.scramble ? h('div', { class: 'tiles' }, q.scramble.split('').map((ch) => plaque('div', { class: 'tile' }, ch))) : null,
        h(
          'form',
          { onsubmit: submit },
          h('div', { class: 'answer-row' }, input, q.unit ? h('span', { class: 'unit' }, q.unit) : null),
          plaque('button', { class: 'wide' }, 'Verstuur')
        )
      );
    } else if (q.type === 'location') {
      let pending = null;
      const map = buildMap(q.map);
      map.classList.add('tappable');
      const btn = sendBtn('Bevestig locatie', () => pending && answer(pending));
      btn.disabled = true;
      map.addEventListener('click', (e) => {
        const r = map.getBoundingClientRect();
        const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
        const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
        const pos = pctToMap(q.map, x, y);
        pending = { lat: Math.round(pos.lat * 1e4) / 1e4, lon: Math.round(pos.lon * 1e4) / 1e4 };
        map.querySelectorAll('.pin').forEach((p) => p.remove());
        map.append(mapPin(q.map, { ...pending, cls: 'me' }));
        btn.disabled = false;
        SFX.click();
      });
      fill(body, h('p', { class: 'hint' }, 'Tik op de kaart'), h('div', { class: 'map-wrap' }, map), btn);
    } else if (q.type === 'order') {
      const picked = [];
      const pickedBox = h('div', { class: 'order-list picked-list' });
      const poolBox = h('div', { class: 'order-list' });
      const btn = sendBtn('Verstuur', () => picked.length === q.items.length && answer(picked.slice()));
      const paint = () => {
        pickedBox.replaceChildren(
          ...picked.map((it, i) => {
            const el = plaque(
              'button',
              {
                class: 'order-item picked',
                type: 'button',
                onclick: () => {
                  picked.splice(i, 1);
                  SFX.click();
                  paint();
                }
              },
              it
            );
            el.querySelector('.plaque-text').prepend(h('span', { class: 'num' }, i + 1 + '.'));
            return el;
          })
        );
        poolBox.replaceChildren(
          ...q.items
            .filter((it) => !picked.includes(it))
            .map((it) =>
              plaque(
                'button',
                {
                  class: 'order-item',
                  type: 'button',
                  onclick: () => {
                    picked.push(it);
                    SFX.click();
                    paint();
                  }
                },
                it
              )
            )
        );
        btn.disabled = picked.length !== q.items.length;
      };
      paint();
      fill(body, h('p', { class: 'hint' }, 'Tik ze aan in de juiste volgorde' + (q.hint ? ': ' + q.hint : '')), pickedBox, poolBox, btn);
    }
  }

  // ================= SPELLETJES =================
  function setGame(name, title, sub, withTimer) {
    $('#gName').textContent = name;
    $('#gTitle').textContent = title || '';
    $('#gSub').textContent = sub || '';
    $('#gTimerBox').hidden = !withTimer;
    $('#gTimerBox').classList.remove('urgent');
  }

  function renderGame(s) {
    showView('v-game');
    const key = s.phase + '|' + (s.qn || 0) + '|' + s.roundId + '|' + (s.startedAt || 0);
    const first = key !== gameKey;
    if (first) {
      gameKey = key;
      Object.assign(timer, { started: false, lastSec: null, timeup: false });
    }
    const body = $('#gBody');

    if (s.phase === 'whois-write') {
      if (first) {
        setGame(s.roundName, 'Maak je profiel', 'Mysterieus, maar met kleine aanwijzingen. De anderen moeten raden dat jij het bent!', true);
        editingHint = false;
        formOpen = false;
      }
      if (!first && formOpen) return; // niet storen tijdens het invullen
      const mine = myHint && myHint.at === s.startedAt ? myHint : null;
      if (mine && !editingHint) {
        fill(
          body,
          h('p', { class: 'status' }, 'Je profiel is verstuurd!'),
          profileCard(mine),
          mine.text ? h('p', { class: 'center' }, '“' + mine.text + '”') : null,
          plaque('button', { class: 'wide', type: 'button', onclick: () => ((editingHint = true), render()) }, 'Wijzig mijn profiel')
        );
      } else {
        formOpen = true;
        const old = mine || {};
        const color = h('input', { type: 'color', class: 'color-input', value: old.color || '#d98a3c' });
        const animal = h('input', { maxLength: 20, placeholder: 'Bv. kat, uil, dolfijn…', autocomplete: 'off', value: old.animal || '' });
        const area = h('textarea', { maxLength: 90, rows: 2, placeholder: 'Bv. "Ik heb ooit een marathon gelopen op klompen"' });
        area.value = old.text || '';
        const picked = new Set(old.traits || []);
        const max = s.maxTraits || 4;
        const count = h('span', { class: 'muted' });
        const paintCount = () => (count.textContent = ` (${picked.size} van ${max})`);
        const chips = h(
          'div',
          { class: 'prof-traits pick' },
          (s.traits || []).map((t) => {
            const chip = h('button', { type: 'button', class: 'trait' + (picked.has(t) ? ' on' : '') }, t);
            chip.onclick = () => {
              if (picked.has(t)) picked.delete(t);
              else if (picked.size < max) picked.add(t);
              else return FX.shake(chip);
              chip.classList.toggle('on', picked.has(t));
              SFX.click();
              paintCount();
            };
            return chip;
          })
        );
        paintCount();
        const send = (e) => {
          e.preventDefault();
          myHint = {
            text: area.value.trim(),
            color: color.value,
            animal: animal.value.trim(),
            traits: [...picked],
            k: Math.random().toString(36).slice(2, 10),
            at: s.startedAt
          };
          editingHint = false;
          formOpen = false;
          sessionStorage.setItem(HINT_KEY, JSON.stringify(myHint));
          const { at, ...pub } = myHint;
          Store.set(path('whois/hints/' + pid), pub);
          SFX.send();
          render();
        };
        fill(
          body,
          h(
            'form',
            { class: 'profile-form', onsubmit: send },
            h('label', {}, 'Mijn lievelingskleur', h('div', { class: 'color-row' }, color, h('span', { class: 'muted' }, 'Tik om zelf een kleur te mengen'))),
            h('label', {}, 'Mijn lievelingsdier', animal),
            h('div', { class: 'field' }, h('span', {}, 'Dit past bij mij', count), chips),
            h('label', {}, 'Een kleine hint over mezelf (mag leeg blijven)', area),
            plaque('button', { class: 'wide' }, 'Verstuur mijn profiel')
          )
        );
      }
    } else if (s.phase === 'teams-pick') {
      if (first) setGame(s.roundName, 'Kies je team', 'Het winnende team krijgt de meeste punten.');
      const mine = myPick && myPick.key === s.roundId + s.qn ? myPick.team : null;
      fill(
        body,
        h(
          'div',
          { class: 'options' },
          s.teamNames.map((name, i) =>
            plaque(
              'button',
              {
                class: 'option' + (mine === i + 1 ? ' picked' : ''),
                orn: true,
                type: 'button',
                onclick: () => {
                  myPick = { key: s.roundId + s.qn, team: i + 1 };
                  sessionStorage.setItem(PICK_KEY, JSON.stringify(myPick));
                  Store.set(path('teampick/' + pid), i + 1);
                  SFX.send();
                  render();
                }
              },
              name
            )
          )
        ),
        mine ? h('p', { class: 'status' }, 'Je zit in ' + s.teamNames[mine - 1], h('strong', {}, 'Je mag nog wisselen tot het spel begint.')) : null
      );
    } else if (s.phase === 'hide-place') {
      if (!first) return;
      setGame(s.roundName, 'Verstop je!', 'Tik op de kaart waar je je verstopt. Je mag je plek nog veranderen.', true);
      const map = buildImageMap(s.map);
      map.classList.add('tappable');
      const note = h('p', { class: 'status' });
      map.addEventListener('click', (e) => {
        const r = map.getBoundingClientRect();
        const spot = { x: round1(((e.clientX - r.left) / r.width) * 100), y: round1(((e.clientY - r.top) / r.height) * 100) };
        map.querySelectorAll('.pin').forEach((p) => p.remove());
        map.append(pctPin({ ...spot, cls: 'me' }));
        Store.set(path('hide/spots/' + pid), spot);
        note.textContent = 'Je bent verstopt!';
        SFX.send();
      });
      fill(body, zoomable(map), note);
    } else if (s.phase === 'hide-seek') {
      if (!first) return;
      setGame(s.roundName, 'Zoek de anderen!', 'Tik op de kaart waar je iemand vermoedt.', true);
      startSeek(s, body);
    } else if (s.phase === 'iq-group') {
      need('players');
      need('iq');
      if (first) setGame(s.roundName, 'Vorm een groepje', `Maximaal ${s.groupMax}. Iedereen puzzelt zelf; je krijgt het gemiddelde van je groepje. Alleen spelen mag ook.`);
      renderIqGroup(s, body);
    } else if (s.phase === 'iq-play') {
      need('players');
      need('iq');
      if (first) setGame(s.roundName, '', '', true);
      const mates = iqMembers(iqGid()).filter((id) => id !== pid);
      $('#gSub').textContent = mates.length ? 'Je groepje: ' + mates.map(nameOf).join(', ') : 'Je speelt alleen.';
      if (!first) return;
      if (Store.now() >= s.startedAt + s.duration * 1000) {
        fill(body, h('p', { class: 'status' }, 'Tijd om!'));
        return;
      }
      IQ.mount(body, {
        key: pin + '-' + s.startedAt,
        onProgress: (pts, n) => Store.set(path('iq/prog/' + pid), { pts, n })
      });
    }
    onTick();
  }

  const round1 = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

  // Kaart met een knop om te vergroten (dan kun je erin schuiven).
  function zoomable(map) {
    const wrap = h('div', { class: 'map-wrap zoomable' }, map);
    const btn = h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        onclick: () => {
          const on = wrap.classList.toggle('zoomed');
          btn.textContent = on ? 'Kaart verkleinen' : 'Kaart vergroten';
        }
      },
      'Kaart vergroten'
    );
    return h('div', {}, h('p', { class: 'center' }, btn), wrap);
  }

  // ---------- Verstoppertje: zoeken ----------
  async function startSeek(s, body) {
    const map = buildImageMap(s.map);
    map.classList.add('tappable');
    const note = h('p', { class: 'status' }, 'Gevonden: 0');
    fill(body, zoomable(map), note);
    const my = (seek = { key: gameKey, found: {}, last: 0 });
    let spots = {};
    try {
      const [sp, pl, fo] = await Promise.all([Store.get(path('hide/spots')), Store.get(path('players')), Store.get(path('hide/found/' + pid))]);
      spots = sp || {};
      allPlayers = pl || {};
      my.found = fo || {};
    } catch (e) {}
    if (seek !== my) return;
    const paintCount = () => (note.textContent = 'Gevonden: ' + Object.keys(my.found).length);
    if (spots[pid]) map.append(pctPin({ ...spots[pid], cls: 'me' }));
    for (const id of Object.keys(my.found)) if (spots[id]) map.append(pctPin({ ...spots[id], cls: 'ok', label: nameOf(id) }));
    paintCount();

    map.addEventListener('click', (e) => {
      const now = Store.now();
      if (seek !== my || now < s.startedAt || now > s.startedAt + s.duration * 1000) return;
      if (Date.now() - my.last < 900) return; // niet razendsnel overal tikken
      my.last = Date.now();
      const r = map.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      const ratio = r.height / r.width;
      let best = null;
      for (const [id, sp] of Object.entries(spots)) {
        if (id === pid || my.found[id] || !allPlayers[id]) continue;
        const d = Math.hypot(sp.x - x, (sp.y - y) * ratio);
        if (d <= s.radius && (!best || d < best.d)) best = { id, d, sp };
      }
      if (best) {
        my.found[best.id] = true;
        Store.set(path('hide/found/' + pid + '/' + best.id), true);
        const pin2 = pctPin({ ...best.sp, cls: 'ok', label: nameOf(best.id) });
        map.append(pin2);
        FX.burstAt(pin2, 40, 6);
        SFX.good();
        buzz([40, 60, 40]);
        paintCount();
      } else {
        const miss = pctPin({ x, y, cls: 'miss' });
        map.append(miss);
        setTimeout(() => miss.remove(), 2500);
        SFX.click();
      }
    });
  }

  // ---------- IQ-test: groepjes ----------
  const iqGroupMap = () => iq.group || {};
  const iqGid = () => iqGroupMap()[pid] || null;
  const iqMembers = (gid) => (gid ? Object.keys(iqGroupMap()).filter((id) => iqGroupMap()[id] === gid && allPlayers[id]) : []);

  function renderIqGroup(s, body) {
    const g = iqGroupMap();
    const max = s.groupMax;
    const mine = iqMembers(iqGid());
    const mySize = Math.max(1, mine.length);
    const inGroup = mine.length > 1;
    const requests = Object.keys((iq.req && iq.req[pid]) || {}).filter((id) => allPlayers[id] && !mine.includes(id));
    const sent = (to) => iq.req && iq.req[to] && iq.req[to][pid];
    const small = (label, onclick, cls) => h('button', { class: 'link-btn ' + (cls || ''), type: 'button', onclick }, label);

    // Ja zeggen: wie al in een groepje zit, haalt de ander erbij; anders ga je naar de ander.
    const accept = (from) => {
      const upd = { ['req/' + pid + '/' + from]: null };
      const theirSize = g[from] ? Math.max(1, iqMembers(g[from]).length) : 1;
      if (inGroup && theirSize < 2) {
        if (mySize < max) upd['group/' + from] = iqGid();
      } else if (theirSize < max) {
        const gid = g[from] || 'g' + from;
        upd['group/' + from] = gid;
        upd['group/' + pid] = gid;
      }
      SFX.good();
      Store.update(path('iq'), upd);
    };

    const others = Object.keys(allPlayers)
      .filter((id) => id !== pid && !mine.includes(id))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

    fill(
      body,
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, inGroup ? 'Jouw groepje' : 'Je speelt nu alleen'),
        inGroup ? h('p', {}, mine.map(nameOf).join(' + ')) : null,
        inGroup ? small('Groepje verlaten', () => Store.set(path('iq/group/' + pid), null)) : null
      ),
      requests.length
        ? h(
            'div',
            { class: 'panel requests' },
            h('h2', {}, 'Wil samen spelen met jou'),
            requests.map((id) =>
              h('div', { class: 'req-row' }, h('span', {}, nameOf(id)), small('Ja', () => accept(id), 'yes'), small('Nee', () => Store.set(path('iq/req/' + pid + '/' + id), null)))
            )
          )
        : null,
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Vraag iemand'),
        mySize >= max ? h('p', { class: 'muted' }, 'Je groepje zit vol.') : null,
        others.map((id) => {
          const theirs = g[id] ? iqMembers(g[id]).length : 1;
          return h(
            'div',
            { class: 'req-row' },
            h('span', {}, nameOf(id), theirs > 1 ? h('small', { class: 'muted' }, ` (groepje van ${theirs})`) : null),
            theirs >= max
              ? h('span', { class: 'muted' }, 'vol')
              : sent(id)
                ? h('span', { class: 'muted' }, 'gevraagd…')
                : mySize < max
                ? small('Vraag', () => {
                    Store.set(path('iq/req/' + id + '/' + pid), true);
                    SFX.send();
                  })
                : null
          );
        })
      )
    );
  }

  // ---------- Resultaat ----------
  function renderResult(s, sc) {
    showView('v-result');
    const isGame = s.phase === 'gameresult';
    const q = s.question;
    const scored = sc.lastQn === s.qn;
    const frac = scored ? sc.frac || 0 : 0;
    const answered = scored ? sc.answered : answeredThis(s);
    const kind = frac >= 1 ? 'good' : frac > 0 || (scored && sc.msg && !answered) ? 'near' : 'bad';
    const title = $('#resultTitle');
    title.className = 'result-title ' + kind + (scored && sc.msg ? ' small' : '');
    title.textContent =
      scored && sc.msg
        ? sc.msg
        : frac >= 1
          ? 'Juist!'
          : frac > 0
            ? q && q.type === 'order'
              ? 'Deels juist'
              : 'Bijna!'
            : answered
              ? 'Helaas…'
              : 'Niet geantwoord';
    $('#resultPoints').textContent = scored && sc.last ? '+' + fmt(sc.last) + ' punten' : '';

    let detail = '';
    if (!isGame && scored && answered && sc.detail != null) {
      if (q.type === 'location') detail = `Je zat ${fmt(sc.detail)} km van de juiste plek.`;
      else if (q.type === 'number' && sc.detail > 0) detail = `Je zat er ${fmt(sc.detail)} naast.`;
      else if (q.type === 'order') detail = `${sc.detail} van de ${q.items.length} op de juiste plaats.`;
    }
    $('#resultDetail').textContent = detail;
    $('#resultAnswer').textContent = isGame ? s.title || '' : (q.type === 'who' ? 'Het was: ' : 'Het juiste antwoord: ') + solutionText(q, s.solution);
    $('#resultRank').textContent = `Je staat op plaats ${myRank()} met ${fmt(sc.total || 0)} punten.`;

    if (resultQn !== s.qn && scored) {
      resultQn = s.qn;
      const box = $('#resultMap');
      box.replaceChildren();
      if (!isGame && q.type === 'location' && s.solution) {
        const pins = [{ lat: s.solution.lat, lon: s.solution.lon, cls: 'sol' }];
        if (answeredThis(s)) pins.unshift({ ...myAnswer.v, cls: 'me' });
        box.append(h('div', { class: 'map-wrap' }, buildMap(q.map, pins)));
      }
      if (kind === 'good') {
        SFX.good();
        buzz([40, 60, 40]);
        FX.burstAt(title, 70, 7);
      } else if (kind === 'near') {
        SFX.almost();
        buzz(60);
        FX.burstAt(title, 25, 5);
      } else {
        SFX.bad();
        buzz(200);
        FX.shake(title);
      }
    }
  }

  function renderEnd(sc, team) {
    showView('v-end');
    $('#endRank').textContent = 'Plaats ' + myRank();
    $('#endScore').textContent = fmt(sc.total || 0) + ' punten';
    $('#endTeam').textContent = team ? 'Groep: ' + team.name : '';
    if (!endShown) {
      endShown = true;
      SFX.fanfare();
      FX.rain(6);
    }
  }
})();
