// Host-scherm (het grote scherm): maakt het spel en de code, beheert spelers en
// groepen, toont de vragen en telt de punten.
//
// Database-structuur onder games/{pin}:
//   createdAt, title
//   config   { teamMode, teams: { t1: {name}, ... } }
//   players  { playerId: { name, teamId, joinedAt } }        <- geschreven door spelers
//   answers  { q{nr}: { playerId: { v, ms } } }              <- geschreven door spelers
//   scores   { playerId: { total, last, lastQn, frac, detail, answered } } <- door host
//   state    { phase, qn, roundId, roundName, qIndex, qTotal, question, startedAt, solution }
//   played   { roundId: true }
//
// Fases: lobby -> select -> question -> reveal -> (question | select) -> end

(async function () {
  const PIN_KEY = 'quiz-host-pin';
  let pin = null;
  let game = {};
  let lastPhaseKey = '';
  let builtQn = -1;
  let revealBuiltQn = -1;
  let teamSig = '';
  let selectSig = '';
  let busy = false;
  let stage = 'answer'; // tijdens reveal: 'answer' of 'board'
  let endBuilt = false;
  let dialogId = null;
  const known = new Set();
  const timer = { started: false, timeup: false, lastSec: null, answers: 0 };

  const players = () => game.players || {};
  const state = () => game.state || { phase: 'lobby' };
  const config = () => game.config || {};
  const scores = () => game.scores || {};
  const path = (sub) => 'games/' + pin + (sub ? '/' + sub : '');
  const findRound = (id) => QUIZ.rounds.find((r) => r.id === id);

  $('#quizTitle').textContent = QUIZ.title;
  $('#curtainTitle').textContent = QUIZ.title;
  document.title = QUIZ.title + ' – Host';

  // ---------- Startscherm en geluid ----------
  $('#openBtn').onclick = () => {
    SFX.unlock();
    SFX.fireOn();
    SFX.question();
    $('#curtain').classList.add('open');
  };
  const soundBtn = $('#soundBtn');
  const paintSound = () => (soundBtn.textContent = 'Geluid: ' + (SFX.muted ? 'uit' : 'aan'));
  soundBtn.onclick = () => {
    SFX.setMuted(!SFX.muted);
    paintSound();
  };
  paintSound();
  document.addEventListener('click', (e) => {
    if (e.target.closest('button') && !e.target.closest('#openBtn')) SFX.click();
  });
  // Spatie, Enter of pijltje rechts = de knop rechtsonder
  document.addEventListener('keydown', (e) => {
    if (![' ', 'Enter', 'ArrowRight'].includes(e.key)) return;
    const t = e.target;
    if (t.matches('input, select, textarea') || $('#playerDialog').open) return;
    const visible = (el) => el.getClientRects().length > 0;
    if (t.matches('button, summary') && visible(t)) return;
    const btn = !$('#curtain').classList.contains('open')
      ? $('#openBtn')
      : [...document.querySelectorAll('.btn-next')].find((b) => visible(b) && !b.disabled);
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  });

  try {
    await Store.ready;
  } catch (e) {
    $('#loadingText').textContent = e.message;
    return;
  }
  if (Store.mode === 'demo') {
    showBanner('Demo-modus: werkt alleen tussen tabbladen van deze browser. Vul js/firebase-config.js in om online te spelen.');
  }

  try {
    pin = sessionStorage.getItem(PIN_KEY);
    if (pin && !(await Store.get(path('createdAt')))) pin = null;
    if (!pin) pin = await createGame();
  } catch (e) {
    $('#loadingText').textContent = 'Geen verbinding met de database: ' + e.message;
    return;
  }
  sessionStorage.setItem(PIN_KEY, pin);

  Store.on(path(), (g) => {
    game = g || {};
    render();
  });
  setInterval(onTick, 100);

  // ---------- Spel aanmaken ----------
  async function createGame() {
    for (let i = 0; i < 20; i++) {
      const p = String(Math.floor(100000 + Math.random() * 900000));
      if (await Store.get('games/' + p + '/createdAt')) continue;
      await Store.set('games/' + p, {
        createdAt: Store.now(),
        title: QUIZ.title,
        config: { teamMode: false, teams: makeTeams(2, {}) },
        state: { phase: 'lobby', qn: 0 }
      });
      return p;
    }
    throw new Error('kon geen vrije spelcode vinden');
  }

  function makeTeams(n, old) {
    const teams = {};
    for (let i = 1; i <= n; i++) teams['t' + i] = { name: (old['t' + i] && old['t' + i].name) || 'Groep ' + i };
    return teams;
  }

  $('#newGame').onclick = () => {
    if (!confirm('Een nieuw spel starten? Het huidige spel stopt.')) return;
    sessionStorage.removeItem(PIN_KEY);
    location.reload();
  };

  // ---------- Spelers: naam wijzigen of verwijderen ----------
  const dialog = $('#playerDialog');
  function openPlayerDialog(id) {
    dialogId = id;
    $('#renameInput').value = players()[id].name;
    dialog.showModal();
    $('#renameInput').select();
  }
  function saveName() {
    const name = $('#renameInput').value.trim().slice(0, 16);
    if (name && players()[dialogId]) Store.set(path('players/' + dialogId + '/name'), name);
    dialog.close();
  }
  $('#renameSave').onclick = saveName;
  $('#renameInput').onkeydown = (e) => e.key === 'Enter' && saveName();
  $('#playerRemove').onclick = () => {
    if (players()[dialogId]) Store.remove(path('players/' + dialogId));
    dialog.close();
  };
  $('#dialogCancel').onclick = () => dialog.close();

  // ---------- Groepen ----------
  const countSel = $('#teamCount');
  for (let i = 2; i <= 8; i++) countSel.append(h('option', { value: i }, i));

  $('#teamMode').onchange = (e) => Store.set(path('config/teamMode'), e.target.checked);

  countSel.onchange = () => {
    const teams = makeTeams(Number(countSel.value), config().teams || {});
    const upd = { 'config/teams': teams };
    for (const [id, p] of Object.entries(players())) {
      if (p.teamId && !teams[p.teamId]) upd['players/' + id + '/teamId'] = null;
    }
    Store.update(path(), upd);
  };

  $('#shuffleTeams').onclick = () => {
    const ids = shuffled(Object.keys(players()));
    const teams = teamList(config());
    const upd = {};
    ids.forEach((id, i) => (upd['players/' + id + '/teamId'] = teams[i % teams.length].id));
    if (ids.length) Store.update(path(), upd);
  };

  // ---------- Fase-overgangen ----------
  $('#startBtn').onclick = () => {
    const upd = { state: { phase: 'select', qn: 0 } };
    if (config().teamMode) {
      // Wie nog geen groep heeft, gaat naar de kleinste groep.
      const teams = teamList(config());
      const size = {};
      teams.forEach((t) => (size[t.id] = 0));
      const loose = [];
      for (const [id, p] of Object.entries(players())) {
        if (p.teamId && size[p.teamId] != null) size[p.teamId]++;
        else loose.push(id);
      }
      for (const id of loose) {
        const t = teams.reduce((a, b) => (size[b.id] < size[a.id] ? b : a));
        size[t.id]++;
        upd['players/' + id + '/teamId'] = t.id;
      }
    }
    Store.update(path(), upd);
  };

  // Stuurt een vraag naar iedereen (zonder het antwoord).
  function startQuestion(round, index) {
    const q = round.questions[index];
    const type = q.type || 'choice';
    const pub = { type, text: q.text, media: q.media || null, duration: q.duration || DEFAULT_DURATION };
    if (type === 'choice') pub.options = q.options;
    if (type === 'text' && q.scramble) pub.scramble = q.scramble;
    if (type === 'number' && q.unit) pub.unit = q.unit;
    if (type === 'location') pub.map = q.map;
    if (type === 'order') {
      let items = shuffled(q.items);
      for (let i = 0; i < 10 && items.every((it, k) => it === q.items[k]); i++) items = shuffled(q.items);
      pub.items = items;
      pub.hint = q.hint || null;
    }
    Store.set(path('state'), {
      phase: 'question',
      qn: (state().qn || 0) + 1,
      roundId: round.id,
      roundName: round.name,
      qIndex: index,
      qTotal: round.questions.length,
      question: pub,
      startedAt: Store.now() + INTRO_MS
    });
  }

  function currentQuestion() {
    const s = state();
    const round = findRound(s.roundId);
    return round ? round.questions[s.qIndex] : null;
  }

  function solutionOf(q) {
    switch (q.type || 'choice') {
      case 'choice':
        return { correct: q.correct };
      case 'text':
        return { answer: q.answers[0] };
      case 'number':
        return { value: q.correct };
      case 'location':
        return { lat: q.lat, lon: q.lon, label: q.label || '' };
      case 'order':
        return { items: q.items };
    }
  }

  // Toont het juiste antwoord en telt de punten (één keer per vraag).
  function reveal() {
    const s = state();
    const q = currentQuestion();
    if (s.phase !== 'question' || busy || !q) return;
    busy = true;
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const upd = { 'state/phase': 'reveal', 'state/solution': solutionOf(q) };
    for (const id of Object.keys(players())) {
      const a = answers[id];
      const res = a ? judgeAnswer(q, a.v) : { frac: 0 };
      const pts = a ? calcPoints(res.frac, a.ms, s.question.duration) : 0;
      upd['scores/' + id] = {
        total: ((scores()[id] && scores()[id].total) || 0) + pts,
        last: pts,
        lastQn: s.qn,
        frac: res.frac,
        detail: res.detail == null ? null : res.detail,
        answered: !!a
      };
    }
    SFX.reveal();
    setTimeout(() => Store.update(path(), upd), 650);
  }
  $('#revealBtn').onclick = reveal;

  // Een getypt antwoord toch goed of fout rekenen.
  function toggleText(ids, makeOk) {
    const s = state();
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const upd = {};
    for (const id of ids) {
      const sc = scores()[id];
      if (!sc || sc.lastQn !== s.qn || !answers[id]) continue;
      const pts = makeOk ? calcPoints(1, answers[id].ms, s.question.duration) : 0;
      upd['scores/' + id] = { ...sc, total: sc.total - sc.last + pts, last: pts, frac: makeOk ? 1 : 0 };
    }
    Store.update(path(), upd);
  }

  $('#boardBtn').onclick = () => {
    const s = state();
    if (s.phase !== 'reveal') return;
    stage = 'board';
    showView('v-board');
    SFX.board();
    const r = buildRanking(players(), scores(), config());
    $('#boardTeamsWrap').hidden = !r.teams.length;
    renderBoard($('#boardTeams'), r.teams, 8, true);
    renderBoard($('#boardPlayers'), r.individuals, r.teams.length ? 5 : 8, true);
    $('#nextBtn .plaque-text').textContent = s.qIndex + 1 < s.qTotal ? 'Volgende vraag' : 'Einde ronde';
  };

  $('#nextBtn').onclick = () => {
    const s = state();
    if (s.phase !== 'reveal') return;
    const round = findRound(s.roundId);
    if (round && s.qIndex + 1 < s.qTotal) {
      startQuestion(round, s.qIndex + 1);
    } else {
      Store.update(path(), { ['played/' + s.roundId]: true, state: { phase: 'select', qn: s.qn } });
    }
  };

  $('#endBtn').onclick = () => {
    if (confirm('De quiz beëindigen en de eindstand tonen?')) {
      Store.set(path('state'), { phase: 'end', qn: state().qn || 0 });
    }
  };

  // ---------- Timer ----------
  function onTick() {
    const s = state();
    const intro = $('#intro');
    if (s.phase !== 'question') {
      intro.hidden = true;
      return;
    }
    const now = Store.now();
    const dur = s.question.duration;
    if (now < s.startedAt) {
      if (intro.hidden) {
        $('#introText').textContent = 'Vraag ' + (s.qIndex + 1);
        $('#introSub').textContent = s.roundName;
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
    $('#timerBox').classList.toggle('urgent', sec <= 5 && left > 0);
    if (sec !== timer.lastSec) {
      timer.lastSec = sec;
      if (sec <= 5 && sec > 0) SFX.tick(sec <= 3);
    }
    if (left <= 0 && !timer.timeup) {
      timer.timeup = true;
      SFX.timeup();
      $('#revealBtn').classList.add('ready');
    }
  }

  // ---------- Weergave ----------
  function render() {
    const s = state();
    const key = s.phase + '|' + (s.qn || 0);
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      busy = false;
      if (s.phase !== 'reveal') stage = 'answer';
    }
    $('#pinSmall').textContent = s.phase === 'lobby' ? '' : 'Code: ' + pin;
    if (s.phase === 'lobby') renderLobby();
    else if (s.phase === 'select') renderSelect();
    else if (s.phase === 'question' || s.phase === 'reveal') renderQuestion(s);
    else renderEnd();
  }

  function renderLobby() {
    showView('v-lobby');
    const c = config();
    const teams = teamList(c);
    const ps = players();
    const ids = Object.keys(ps).sort((a, b) => ps[a].joinedAt - ps[b].joinedAt);

    if (!$('#pinBig').children.length) {
      $('#pinBig').replaceChildren(
        ...pin.split('').map((d, i) => plaque('div', { class: 'digit', style: `animation-delay:${i * 90}ms` }, d))
      );
    }
    $('#joinUrl').textContent = location.href.replace(/host\.html.*$/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    $('#teamMode').checked = !!c.teamMode;
    $('#teamSettings').hidden = !c.teamMode;
    countSel.value = teams.length;

    // Naamvelden alleen opnieuw opbouwen als het aantal groepen wijzigt
    // (anders verlies je de cursor tijdens het typen).
    const sig = teams.map((t) => t.id).join(',');
    if (sig !== teamSig) {
      teamSig = sig;
      $('#teamNames').replaceChildren(
        ...teams.map((t) =>
          h(
            'div',
            { class: 'team-name' },
            h('span', { class: 'dot', style: 'background:' + t.color }),
            h('input', {
              type: 'text',
              maxLength: 20,
              value: t.name,
              'data-team': t.id,
              onchange: (e) => Store.set(path('config/teams/' + t.id + '/name'), e.target.value.trim() || t.name)
            })
          )
        )
      );
    }

    $('#playerCount').textContent = ids.length ? `${ids.length} ${ids.length === 1 ? 'speler' : 'spelers'}` : '';
    const nameEl = (id) =>
      plaque('button', { class: 'name' + (known.has(id) ? '' : ' pop'), onclick: () => openPlayerDialog(id) }, ps[id].name);
    const list = $('#playerList');
    if (!ids.length) {
      list.replaceChildren(h('p', { class: 'waiting' }, 'Wachten op spelers…'));
    } else if (c.teamMode) {
      const groups = teams.map((t) => ({ ...t, ids: ids.filter((id) => ps[id].teamId === t.id) }));
      const loose = ids.filter((id) => !teams.some((t) => t.id === ps[id].teamId));
      if (loose.length) groups.push({ name: 'Nog geen groep', color: '#8a7a66', ids: loose });
      list.replaceChildren(
        ...groups.map((g) =>
          h(
            'div',
            { class: 'team-group' },
            h('h3', {}, h('span', { class: 'dot', style: 'background:' + g.color }), `${g.name} (${g.ids.length})`),
            h('div', { class: 'names' }, g.ids.map(nameEl))
          )
        )
      );
    } else {
      list.replaceChildren(h('div', { class: 'names' }, ids.map(nameEl)));
    }
    const fresh = ids.filter((id) => !known.has(id));
    fresh.forEach((id) => known.add(id));
    if (fresh.length) SFX.pop();
    for (const id of [...known]) if (!ps[id]) known.delete(id);
    $('#startBtn').disabled = !ids.length;
  }

  function renderSelect() {
    showView('v-select');
    const played = game.played || {};
    const sig = JSON.stringify(played);
    if (sig !== selectSig || !$('#rounds').children.length) {
      selectSig = sig;
      $('#rounds').replaceChildren(
        ...QUIZ.rounds.map((round, i) => {
          const n = round.questions.length;
          const done = played[round.id];
          return plaque(
            'button',
            {
              class: 'round' + (done ? ' done' : ''),
              orn: true,
              style: `animation-delay:${i * 130}ms`,
              disabled: !n,
              onclick: () => {
                if (done && !confirm('Deze ronde is al gespeeld. Opnieuw spelen?')) return;
                startQuestion(round, 0);
              }
            },
            round.name,
            h('small', {}, !n ? 'binnenkort' : done ? 'gespeeld' : n + ' vragen')
          );
        })
      );
    }
    const r = buildRanking(players(), scores(), config());
    $('#selBoardPanel').hidden = !Object.keys(scores()).length;
    $('#selTeamBoard').hidden = !r.teams.length;
    renderBoard($('#selTeamBoard'), r.teams);
    renderBoard($('#selBoard'), r.individuals, 8);
  }

  function renderQuestion(s) {
    const q = s.question;
    const isReveal = s.phase === 'reveal';
    if (isReveal && stage === 'board') return;
    showView('v-question');

    // Vraag maar één keer opbouwen, zodat animaties en video's niet herstarten.
    if (builtQn !== s.qn) {
      builtQn = s.qn;
      Object.assign(timer, { started: false, timeup: false, lastSec: null, answers: 0 });
      $('#qCount').textContent = `${s.qIndex + 1} / ${s.qTotal}`;
      $('#qRound').textContent = s.roundName;
      $('#qText').textContent = q.text;
      const box = $('#qText').parentElement;
      box.style.animation = 'none';
      void box.offsetWidth;
      box.style.animation = '';
      renderMedia($('#qMedia'), q.media);
      buildBody(q);
      $('#qReveal').replaceChildren();
      $('#revealBtn').classList.remove('ready');
      if (!isReveal) SFX.question();
    }

    const ps = players();
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const answeredIds = Object.keys(answers).filter((id) => ps[id]);
    const total = Object.keys(ps).length;
    $('#answered').textContent = `${answeredIds.length} / ${total} antwoorden`;
    if (!isReveal && answeredIds.length > timer.answers) SFX.blip();
    timer.answers = answeredIds.length;
    if (!isReveal && total > 0 && answeredIds.length >= total) $('#revealBtn').classList.add('ready');

    $('#revealBtn').hidden = isReveal;
    $('#boardBtn').hidden = !isReveal;
    $('#timerBox').hidden = isReveal;
    $('#fuse').parentElement.hidden = isReveal;

    if (isReveal) {
      const first = revealBuiltQn !== s.qn;
      if (first || q.type === 'text') {
        revealBuiltQn = s.qn;
        buildReveal(s, answeredIds, answers, first);
      }
    }
    onTick();
  }

  // Het deel onder de vraag, per soort vraag.
  function buildBody(q) {
    const body = $('#qBody');
    if (q.type === 'choice') {
      fill(body, 
        h(
          'div',
          { class: 'options' },
          q.options.map((text) => {
            const el = plaque('div', { class: 'option', orn: true }, text);
            el.append(h('span', { class: 'count' }));
            return el;
          })
        )
      );
    } else if (q.type === 'text') {
      fill(body, 
        q.scramble
          ? h(
              'div',
              { class: 'tiles' },
              q.scramble.split('').map((ch, i) => plaque('div', { class: 'tile', style: `animation-delay:${i * 70}ms` }, ch))
            )
          : null,
        h('p', { class: 'hint' }, 'Typ je antwoord op je gsm')
      );
    } else if (q.type === 'number') {
      fill(body, h('p', { class: 'hint' }, 'Geef je antwoord in op je gsm' + (q.unit ? ` (in ${q.unit})` : '')));
    } else if (q.type === 'location') {
      fill(body, h('div', { class: 'map-wrap' }, buildMap(q.map)));
      $('#qRound').textContent = 'Duid de plek aan op je gsm';
    } else if (q.type === 'order') {
      fill(body, 
        h('p', { class: 'hint' }, 'Zet in de juiste volgorde' + (q.hint ? ': ' + q.hint : '')),
        h('div', { class: 'order-list' }, q.items.map((it) => plaque('div', { class: 'order-item' }, it)))
      );
    }
  }

  const fracClass = (f) => (f >= 1 ? 'ok' : f > 0 ? 'near' : 'no');

  // De onthulling, per soort vraag.
  function buildReveal(s, ids, answers, first) {
    const q = s.question;
    const sol = s.solution || {};
    const ps = players();
    const sc = scores();
    const fracOf = (id) => (sc[id] && sc[id].lastQn === s.qn ? sc[id].frac || 0 : 0);
    const out = $('#qReveal');
    let sparkTarget = null;

    if (q.type === 'choice') {
      document.querySelectorAll('#qBody .option').forEach((el, i) => {
        el.classList.toggle('correct', i === sol.correct);
        el.classList.toggle('dim', i !== sol.correct);
        el.querySelector('.count').textContent = ids.filter((id) => answers[id].v === i).length;
        if (i === sol.correct) sparkTarget = el;
      });
    } else if (q.type === 'text') {
      // Zelfde antwoorden samen nemen
      const groups = new Map();
      for (const id of ids) {
        const key = normalizeText(answers[id].v);
        if (!groups.has(key)) groups.set(key, { text: String(answers[id].v), ids: [], ok: fracOf(id) >= 1 });
        groups.get(key).ids.push(id);
      }
      const list = [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
      const big = plaque('div', { class: 'answer-big correct', orn: true }, sol.answer);
      fill(out, 
        big,
        h(
          'div',
          { class: 'words' + (first ? '' : ' static') },
          list.map((g, i) =>
            h(
              'button',
              {
                class: 'word ' + (g.ok ? 'ok' : 'no') + (g.ids.length > 1 ? ' big' : ''),
                style: `animation-delay:${Math.min(i, 30) * 70}ms`,
                title: 'Klik om dit antwoord goed of fout te rekenen',
                onclick: () => toggleText(g.ids, !g.ok)
              },
              g.text,
              g.ids.length > 1 ? h('small', {}, '×' + g.ids.length) : null
            )
          )
        ),
        list.length ? h('p', { class: 'hint small-text' }, 'Klik op een antwoord om het toch goed of fout te rekenen.') : null
      );
      sparkTarget = big;
    } else if (q.type === 'number') {
      const sorted = ids.slice().sort((a, b) => fracOf(b) - fracOf(a) || Math.abs(answers[a].v - sol.value) - Math.abs(answers[b].v - sol.value));
      const big = plaque('div', { class: 'answer-big correct', orn: true }, fmt(sol.value) + (q.unit ? ' ' + q.unit : ''));
      fill(out, 
        big,
        h(
          'div',
          { class: 'words' },
          sorted.map((id, i) =>
            h('span', { class: 'word ' + fracClass(fracOf(id)), style: `animation-delay:${Math.min(i, 30) * 70}ms` }, ps[id].name, h('small', {}, fmt(answers[id].v)))
          )
        )
      );
      sparkTarget = big;
    } else if (q.type === 'location') {
      const pins = ids.map((id) => ({ lat: answers[id].v.lat, lon: answers[id].v.lon, cls: fracClass(fracOf(id)) }));
      pins.push({ lat: sol.lat, lon: sol.lon, cls: 'sol', label: sol.label });
      const map = buildMap(q.map, pins);
      $('#qBody').replaceChildren(h('div', { class: 'map-wrap' }, map));
      const best = ids.slice().sort((a, b) => (sc[a].detail || 0) - (sc[b].detail || 0))[0];
      fill(out, best ? h('p', { class: 'hint' }, `Dichtst bij: ${ps[best].name} (${fmt(sc[best].detail)} km)`) : null);
      if (first) setTimeout(() => FX.burstAt(map.querySelector('.pin.sol'), 70, 6), 600);
    } else if (q.type === 'order') {
      const full = ids.filter((id) => fracOf(id) >= 1).length;
      const list = h(
        'div',
        { class: 'order-list' },
        sol.items.map((it, i) => {
          const el = plaque('div', { class: 'order-item correct' }, it);
          el.querySelector('.plaque-text').prepend(h('span', { class: 'num' }, i + 1 + '.'));
          return el;
        })
      );
      $('#qBody').replaceChildren(list);
      fill(out, h('p', { class: 'hint' }, `${full} van de ${ids.length} helemaal juist`));
      sparkTarget = list;
    }
    if (first && sparkTarget) FX.burstAt(sparkTarget, 90, 8);
  }

  function renderEnd() {
    showView('v-end');
    if (endBuilt) return;
    endBuilt = true;
    const r = buildRanking(players(), scores(), config());
    const top = (r.teams.length ? r.teams : r.individuals).slice(0, 3);
    const step = (row, place) =>
      row
        ? h(
            'div',
            { class: 'step p' + place },
            h('div', { class: 'who' }, row.name),
            h('div', { class: 'pts' }, fmt(row.total)),
            plaque('div', { class: 'block' }, place)
          )
        : null;
    $('#podium').replaceChildren(...[step(top[1], 2), step(top[0], 1), step(top[2], 3)].filter(Boolean));
    if (top[2]) setTimeout(SFX.drum, 500);
    if (top[1]) setTimeout(SFX.drum, 1700);
    setTimeout(() => {
      SFX.drum();
      SFX.fanfare();
      FX.rain(9);
      FX.burstAt($('.step.p1'), 160, 11);
    }, 3100);
    setTimeout(() => {
      $('#endLists').hidden = false;
      $('#endTeamPanel').hidden = !r.teams.length;
      renderBoard($('#endTeamBoard'), r.teams);
      renderBoard($('#endBoard'), r.individuals);
    }, 4600);
  }
})();
