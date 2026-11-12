// Host-scherm: maakt het spel, beheert groepen, stuurt vragen en telt punten.
//
// Database-structuur onder games/{pin}:
//   createdAt
//   config   { teamMode, teams: { t1: {name}, ... } }
//   players  { playerId: { name, teamId, joinedAt } }      <- geschreven door spelers
//   answers  { q{nr}: { playerId: { choice, ms } } }       <- geschreven door spelers
//   scores   { playerId: { total, last, lastQn, correct } } <- geschreven door host
//   state    { phase, qn, levelId, topicId, qIndex, qTotal, question, startedAt, correct }
//   played   { levelId__topicId: true }
//
// Fases: lobby -> select -> question -> reveal -> (question | select) -> end

(async function () {
  const PIN_KEY = 'quiz-host-pin';
  let pin = null;
  let game = {};
  let lastPhaseKey = '';
  let builtQn = -1;
  let teamSig = '';
  let revealing = false;

  const players = () => game.players || {};
  const state = () => game.state || { phase: 'lobby' };
  const config = () => game.config || {};
  const path = (sub) => 'games/' + pin + (sub ? '/' + sub : '');

  $('#quizTitle').textContent = QUIZ.title;
  document.title = QUIZ.title + ' – Host';

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
  setInterval(onTick, 200);

  // ---------- Spel aanmaken ----------
  async function createGame() {
    for (let i = 0; i < 20; i++) {
      const p = String(Math.floor(100000 + Math.random() * 900000));
      if (await Store.get('games/' + p + '/createdAt')) continue;
      await Store.set('games/' + p, {
        createdAt: Store.now(),
        config: { teamMode: false, teams: makeTeams(2, {}) },
        state: { phase: 'lobby', qn: 0 }
      });
      return p;
    }
    throw new Error('kon geen vrije spelcode vinden');
  }

  function makeTeams(n, old) {
    const teams = {};
    for (let i = 1; i <= n; i++) teams['t' + i] = { name: (old['t' + i] && old['t' + i].name) || 'Team ' + i };
    return teams;
  }

  $('#newGame').onclick = () => {
    if (!confirm('Een nieuw spel starten? Het huidige spel stopt.')) return;
    sessionStorage.removeItem(PIN_KEY);
    location.reload();
  };

  // ---------- Groepen ----------
  const countSel = $('#teamCount');
  for (let i = 2; i <= 8; i++) countSel.append(h('option', { value: i }, i));

  $('#teamMode').onchange = (e) => Store.set(path('config/teamMode'), e.target.checked);

  countSel.onchange = () => {
    const teams = makeTeams(Number(countSel.value), config().teams || {});
    const upd = { 'config/teams': teams };
    // Spelers in een groep die niet meer bestaat, komen terug zonder groep.
    for (const [id, p] of Object.entries(players())) {
      if (p.teamId && !teams[p.teamId]) upd['players/' + id + '/teamId'] = null;
    }
    Store.update(path(), upd);
  };

  $('#shuffleTeams').onclick = () => {
    const ids = Object.keys(players());
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
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

  function startQuestion(level, topic, index) {
    const q = topic.questions[index];
    Store.set(path('state'), {
      phase: 'question',
      qn: (state().qn || 0) + 1,
      levelId: level.id,
      topicId: topic.id,
      levelName: level.name,
      topicName: topic.name,
      qIndex: index,
      qTotal: topic.questions.length,
      question: {
        text: q.text,
        options: q.options,
        media: q.media || null,
        duration: q.duration || DEFAULT_DURATION
      },
      startedAt: Store.now()
    });
  }

  function currentRound() {
    const s = state();
    const level = QUIZ.levels.find((l) => l.id === s.levelId);
    const topic = level && level.topics.find((t) => t.id === s.topicId);
    return { level, topic };
  }

  // Toont het juiste antwoord en telt de punten (één keer per vraag).
  function reveal() {
    const s = state();
    if (s.phase !== 'question' || revealing) return;
    const { topic } = currentRound();
    if (!topic) return;
    revealing = true;
    const q = topic.questions[s.qIndex];
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const scores = game.scores || {};
    const upd = { 'state/phase': 'reveal', 'state/correct': q.correct };
    for (const id of Object.keys(players())) {
      const a = answers[id];
      const ok = !!a && a.choice === q.correct;
      const pts = ok ? calcPoints(a.ms, s.question.duration) : 0;
      upd['scores/' + id] = {
        total: ((scores[id] && scores[id].total) || 0) + pts,
        last: pts,
        lastQn: s.qn,
        correct: ok,
        answered: !!a
      };
    }
    Store.update(path(), upd);
  }

  $('#revealBtn').onclick = reveal;

  $('#nextBtn').onclick = () => {
    const s = state();
    if (s.phase !== 'reveal') return;
    const { level, topic } = currentRound();
    if (topic && s.qIndex + 1 < s.qTotal) {
      startQuestion(level, topic, s.qIndex + 1);
    } else {
      Store.update(path(), {
        ['played/' + s.levelId + '__' + s.topicId]: true,
        state: { phase: 'select', qn: s.qn }
      });
    }
  };

  $('#endBtn').onclick = () => {
    if (confirm('De quiz beëindigen en de eindstand tonen?')) {
      Store.set(path('state'), { phase: 'end', qn: state().qn || 0 });
    }
  };

  function onTick() {
    const s = state();
    if (s.phase !== 'question') return;
    const left = s.question.duration - (Store.now() - s.startedAt) / 1000;
    $('#timer').textContent = Math.max(0, Math.ceil(left));
    if (left <= 0) reveal();
  }

  // ---------- Weergave ----------
  function render() {
    const s = state();
    const key = s.phase + '|' + (s.qn || 0);
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      revealing = false;
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

    $('#pinBig').textContent = pin;
    $('#joinUrl').textContent = location.href.replace(/host\.html.*$/, '').replace(/^https?:\/\//, '');
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

    $('#playerCount').textContent = `(${ids.length} / ${MAX_PLAYERS})`;
    const chip = (id, color) =>
      h(
        'button',
        {
          class: 'chip',
          style: color ? 'border-color:' + color : null,
          title: 'Verwijderen',
          onclick: () => confirm(`${ps[id].name} verwijderen?`) && Store.remove(path('players/' + id))
        },
        ps[id].name
      );
    const list = $('#playerList');
    if (!ids.length) {
      list.replaceChildren(h('p', { class: 'muted' }, 'Wachten op spelers…'));
    } else if (c.teamMode) {
      const groups = teams.map((t) => ({ ...t, ids: ids.filter((id) => ps[id].teamId === t.id) }));
      const loose = ids.filter((id) => !teams.some((t) => t.id === ps[id].teamId));
      if (loose.length) groups.push({ name: 'Nog geen groep', color: '#888', ids: loose });
      list.replaceChildren(
        ...groups.map((g) =>
          h(
            'div',
            { class: 'team-group' },
            h('h3', {}, h('span', { class: 'dot', style: 'background:' + g.color }), `${g.name} (${g.ids.length})`),
            h('div', { class: 'chips' }, g.ids.map((id) => chip(id, g.color)))
          )
        )
      );
    } else {
      list.replaceChildren(h('div', { class: 'chips' }, ids.map((id) => chip(id))));
    }
    $('#startBtn').disabled = !ids.length;
  }

  function renderBoards(teamEl, indEl, limit) {
    const r = buildRanking(players(), game.scores, config());
    const teamCard = teamEl.closest('.card');
    if (teamCard && teamCard !== indEl.closest('.card')) teamCard.hidden = !r.teams.length;
    teamEl.hidden = !r.teams.length;
    renderBoard(teamEl, r.teams);
    renderBoard(indEl, r.individuals, limit);
  }

  function renderSelect() {
    showView('v-select');
    const played = game.played || {};
    $('#rounds').replaceChildren(
      ...QUIZ.levels.map((level) =>
        h(
          'div',
          { class: 'card level' },
          h('h2', {}, level.name),
          h(
            'div',
            { class: 'topics' },
            level.topics.map((topic) => {
              const done = played[level.id + '__' + topic.id];
              return h(
                'button',
                {
                  class: 'btn topic' + (done ? ' done' : ''),
                  disabled: !topic.questions.length,
                  onclick: () => {
                    if (done && !confirm('Deze ronde is al gespeeld. Opnieuw spelen?')) return;
                    startQuestion(level, topic, 0);
                  }
                },
                (done ? '✓ ' : '') + topic.name,
                h('small', {}, topic.questions.length + ' vragen')
              );
            })
          )
        )
      )
    );
    renderBoards($('#selTeamBoard'), $('#selBoard'), 10);
  }

  function renderQuestion(s) {
    showView('v-question');
    const q = s.question;
    const isReveal = s.phase === 'reveal';

    // Vraag en media maar één keer opbouwen, zodat een video niet herstart.
    if (builtQn !== s.qn) {
      builtQn = s.qn;
      $('#qMeta').textContent = `${s.levelName} • ${s.topicName} • Vraag ${s.qIndex + 1}/${s.qTotal}`;
      $('#qText').textContent = q.text;
      renderMedia($('#qMedia'), q.media);
      $('#qOptions').replaceChildren(
        ...q.options.map((text, i) =>
          h(
            'div',
            { class: 'option', style: 'background:' + OPTION_STYLE[i].color },
            h('span', { class: 'shape' }, OPTION_STYLE[i].shape),
            h('span', { class: 'opt-text' }, text),
            h('span', { class: 'opt-count' })
          )
        )
      );
    }

    const ps = players();
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const answeredIds = Object.keys(answers).filter((id) => ps[id]);
    const total = Object.keys(ps).length;
    $('#answered').textContent = `${answeredIds.length} / ${total} antwoorden`;

    document.querySelectorAll('#qOptions .option').forEach((el, i) => {
      el.classList.toggle('correct', isReveal && i === s.correct);
      el.classList.toggle('dim', isReveal && i !== s.correct);
      el.querySelector('.opt-count').textContent = isReveal
        ? answeredIds.filter((id) => answers[id].choice === i).length
        : '';
    });

    if (isReveal) $('#timer').textContent = '';
    $('#revealBtn').hidden = isReveal;
    $('#nextBtn').hidden = !isReveal;
    $('#nextBtn').textContent = s.qIndex + 1 < s.qTotal ? 'Volgende vraag' : 'Einde ronde';
    $('#revealPanel').hidden = !isReveal;
    if (isReveal) renderBoards($('#qTeamBoard'), $('#qBoard'), 5);

    // Iedereen heeft geantwoord: meteen het antwoord tonen.
    if (!isReveal && total > 0 && answeredIds.length >= total) reveal();
  }

  function renderEnd() {
    showView('v-end');
    renderBoards($('#endTeamBoard'), $('#endBoard'));
  }
})();
