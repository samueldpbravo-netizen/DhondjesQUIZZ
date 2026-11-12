// Speler-scherm (gsm): code ingeven, naam ingeven, groep kiezen, antwoorden.
// sessionStorage wordt gebruikt zodat elk tabblad een aparte speler is
// (handig om te testen) en een refresh je niet uit het spel gooit.

(async function () {
  const PIN_KEY = 'quiz-player-pin';
  const ID_KEY = 'quiz-player-id';
  const ANS_KEY = 'quiz-player-answer';

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
  let myAnswer = null; // { qn, v }
  const timer = { started: false, lastSec: null, timeup: false };

  try {
    myAnswer = JSON.parse(sessionStorage.getItem(ANS_KEY));
  } catch (e) {}

  const path = (sub) => 'games/' + pin + (sub ? '/' + sub : '');
  const answeredThis = (s) => !!(myAnswer && s && myAnswer.qn === s.qn);
  const buzz = (ms) => navigator.vibrate && navigator.vibrate(ms);

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

  function leave(message) {
    unsubs.forEach((u) => u());
    unsubs = [];
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
    return String(v);
  }

  function setStatus(title, detail) {
    $('#qBody').hidden = !!title;
    $('#qStatus').hidden = !title;
    if (title) fill($('#qStatus'), title, detail ? h('strong', {}, detail) : null);
  }

  function onTick() {
    const s = state;
    const intro = $('#intro');
    if (!pin || !s || s.phase !== 'question') {
      intro.hidden = true;
      return;
    }
    const now = Store.now();
    const dur = s.question.duration;
    if (now < s.startedAt) {
      if (intro.hidden) {
        $('#introText').textContent = 'Vraag ' + (s.qIndex + 1);
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
    const mine = answeredThis(s);
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
    else if (s.phase === 'reveal') renderResult(s, sc);
    else renderEnd(sc, team);
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
    if (answeredThis(s)) setStatus('Antwoord verstuurd!', describe(q, myAnswer.v));
    onTick();
  }

  // Het antwoordgedeelte, per soort vraag.
  function buildBody(q) {
    const body = $('#qBody');
    const sendBtn = (label, onclick) => plaque('button', { class: 'wide', type: 'button', onclick }, label);

    if (q.type === 'choice') {
      fill(body, 
        h(
          'div',
          { class: 'options' },
          q.options.map((text, i) => plaque('button', { class: 'option', orn: true, onclick: () => answer(i) }, text))
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
      fill(body, 
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
      fill(body, 
        h('p', { class: 'hint' }, 'Tik ze aan in de juiste volgorde' + (q.hint ? ': ' + q.hint : '')),
        pickedBox,
        poolBox,
        btn
      );
    }
  }

  function renderResult(s, sc) {
    showView('v-result');
    const q = s.question;
    const scored = sc.lastQn === s.qn;
    const frac = scored ? sc.frac || 0 : 0;
    const answered = scored ? sc.answered : answeredThis(s);
    const kind = frac >= 1 ? 'good' : frac > 0 ? 'near' : 'bad';
    const title = $('#resultTitle');
    title.className = 'result-title ' + kind;
    title.textContent =
      frac >= 1 ? 'Juist!' : frac > 0 ? (q.type === 'order' ? 'Deels juist' : 'Bijna!') : answered ? 'Helaas…' : 'Niet geantwoord';
    $('#resultPoints').textContent = scored && sc.last ? '+' + fmt(sc.last) + ' punten' : '';

    let detail = '';
    if (scored && answered && sc.detail != null) {
      if (q.type === 'location') detail = `Je zat ${fmt(sc.detail)} km van de juiste plek.`;
      else if (q.type === 'number' && sc.detail > 0) detail = `Je zat er ${fmt(sc.detail)} naast.`;
      else if (q.type === 'order') detail = `${sc.detail} van de ${q.items.length} op de juiste plaats.`;
    }
    $('#resultDetail').textContent = detail;
    $('#resultAnswer').textContent = 'Het juiste antwoord: ' + solutionText(q, s.solution);
    $('#resultRank').textContent = `Je staat op plaats ${myRank()} met ${fmt(sc.total || 0)} punten.`;

    if (resultQn !== s.qn && scored) {
      resultQn = s.qn;
      const box = $('#resultMap');
      box.replaceChildren();
      if (q.type === 'location' && s.solution) {
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
