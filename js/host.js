// Host-scherm (het grote scherm): maakt het spel en de code, beheert spelers,
// toont de vragen en spelletjes en telt de punten.
//
// Database-structuur onder games/{pin}:
//   createdAt, title
//   config   { teamMode, teams: { t1: {name}, ... } }
//   players  { playerId: { name, teamId, joinedAt } }        <- geschreven door spelers
//   answers  { q{nr}: { playerId: { v, ms } } }              <- geschreven door spelers
//   scores   { playerId: { total, last, lastQn, frac, detail, answered, msg } } <- door host
//   state    { phase, qn, roundId, roundName, ... }
//   played   { roundId: true }
//   whois    { hints: { playerId: tekst } }                  <- Wie is het?
//   teampick { playerId: 1 | 2 }                             <- Teamspel
//   hide     { spots: { playerId: {x, y} }, found: { playerId: { anderId: true } } }
//   iq       { group: { playerId: groepId }, req: { naarId: { vanId: true } }, prog: { playerId: {pts, n} } }
//
// Fases: lobby -> select -> (ronde) -> select -> ... -> end
//   quiz:   question -> reveal -> ...
//   whois:  whois-write -> question -> reveal -> ...
//   teams:  teams-pick -> gameresult
//   hide:   hide-place -> hide-seek -> gameresult
//   iq:     iq-group -> iq-play -> gameresult

(async function () {
  const PIN_KEY = 'quiz-host-pin';
  const DYN_KEY = 'quiz-host-dyn';
  const TIMED = ['whois-write', 'hide-place', 'hide-seek', 'iq-play'];
  let pin = null;
  let game = {};
  let lastPhaseKey = '';
  let builtQn = -1;
  let revealBuiltQn = -1;
  let gameKey = '';
  let teamSig = '';
  let selectSig = '';
  let busy = false;
  let stage = 'answer'; // tijdens reveal/gameresult: 'answer' of 'board'
  let endBuilt = false;
  let dialogId = null;
  let opened = false;
  let dyn = null; // de vragen van "Wie is het?", gemaakt uit de hints
  const known = new Set();
  const iqEls = new Map();
  const timer = { started: false, timeup: false, lastSec: null, answers: 0, grouped: 0 };

  try {
    dyn = JSON.parse(sessionStorage.getItem(DYN_KEY));
  } catch (e) {}

  const players = () => game.players || {};
  const state = () => game.state || { phase: 'lobby' };
  const config = () => game.config || {};
  const scores = () => game.scores || {};
  const path = (sub) => 'games/' + pin + (sub ? '/' + sub : '');
  const findRound = (id) => (dyn && dyn.id === id ? dyn : QUIZ.rounds.find((r) => r.id === id));
  const baseRound = (id) => QUIZ.rounds.find((r) => r.id === id) || {};
  const nameOf = (id) => (players()[id] ? players()[id].name : '?');
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));

  $('#quizTitle').textContent = QUIZ.title;
  $('#curtainTitle').textContent = QUIZ.title;
  document.title = QUIZ.title + ' – Host';

  // ---------- Startscherm, geluid en muziek ----------
  function setMusic() {
    if (!opened) return;
    const p = state().phase;
    SFX.music(['question', 'hide-seek', 'iq-play'].includes(p) ? 'tense' : 'lounge');
  }
  $('#openBtn').onclick = () => {
    SFX.unlock();
    SFX.fireOn();
    SFX.question();
    opened = true;
    setMusic();
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
    const btn = !opened ? $('#openBtn') : [...document.querySelectorAll('.btn-next')].find((b) => visible(b) && !b.disabled);
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
    sessionStorage.removeItem(DYN_KEY);
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

  // ---------- Vaste groepen (lobby) ----------
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

  // ---------- Start ----------
  $('#startBtn').onclick = () => {
    const upd = { state: { phase: 'select', qn: 0 } };
    if (config().teamMode) {
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

  function startRound(round) {
    if (round.kind === 'whois') startWhois(round);
    else if (round.kind === 'teams') startTeams(round);
    else if (round.kind === 'hide') startHide(round);
    else if (round.kind === 'iq') startIq(round);
    else startQuestion(round, 0);
  }

  const baseState = (round, phase, extra) => ({ phase, qn: state().qn || 0, roundId: round.id, roundName: round.name, ...extra });

  // ================= VRAGEN =================
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
    if (type === 'who') {
      pub.label = 'Profiel';
      pub.profile = q.profile || null;
      pub.names = Object.keys(players())
        .sort(byName)
        .map((id) => ({ id, name: nameOf(id) }));
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
    return round && round.questions ? round.questions[s.qIndex] : null;
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
      case 'who':
        return { id: q.correct, name: players()[q.correct] ? nameOf(q.correct) : q.correctName };
    }
  }

  // Toont het juiste antwoord en telt de punten (één keer per vraag).
  function reveal() {
    const s = state();
    const q = currentQuestion();
    if (s.phase !== 'question' || busy || !q) return;
    busy = true;
    const round = findRound(s.roundId);
    const max = q.maxPoints || round.maxPoints || 1000;
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const upd = { 'state/phase': 'reveal', 'state/solution': solutionOf(q) };
    for (const id of Object.keys(players())) {
      const prev = (scores()[id] && scores()[id].total) || 0;
      if (q.type === 'who' && id === q.correct) {
        // Wie geraden moet worden, krijgt zelf geen punten.
        upd['scores/' + id] = { total: prev, last: 0, lastQn: s.qn, frac: 0, answered: false, msg: 'Dat was jouw profiel!' };
        continue;
      }
      const a = answers[id];
      const res = a ? judgeAnswer(q, a.v) : { frac: 0 };
      let pts = a ? calcPoints(res.frac, a.ms, s.question.duration, max) : 0;
      if (a && res.frac <= 0) pts = round.wrongPoints || 0; // troostpunten
      upd['scores/' + id] = {
        total: prev + pts,
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
    const round = findRound(s.roundId);
    const max = (round && round.maxPoints) || 1000;
    const answers = (game.answers && game.answers['q' + s.qn]) || {};
    const upd = {};
    for (const id of ids) {
      const sc = scores()[id];
      if (!sc || sc.lastQn !== s.qn || !answers[id]) continue;
      const pts = makeOk ? calcPoints(1, answers[id].ms, s.question.duration, max) : 0;
      upd['scores/' + id] = { ...sc, total: sc.total - sc.last + pts, last: pts, frac: makeOk ? 1 : 0 };
    }
    Store.update(path(), upd);
  }

  function showBoard() {
    const s = state();
    stage = 'board';
    showView('v-board');
    SFX.board();
    const r = buildRanking(players(), scores(), config());
    $('#boardTeamsWrap').hidden = !r.teams.length;
    renderBoard($('#boardTeams'), r.teams, 8, true);
    renderBoard($('#boardPlayers'), r.individuals, r.teams.length ? 5 : 8, true);
    const more = s.phase === 'reveal' && s.qIndex + 1 < s.qTotal;
    $('#nextBtn .plaque-text').textContent = more ? 'Volgende vraag' : 'Einde ronde';
  }

  function nextStep() {
    const s = state();
    if (s.phase !== 'reveal' && s.phase !== 'gameresult') return;
    const round = findRound(s.roundId);
    if (s.phase === 'reveal' && round && s.qIndex + 1 < s.qTotal) {
      startQuestion(round, s.qIndex + 1);
    } else {
      Store.update(path(), { ['played/' + s.roundId]: true, state: { phase: 'select', qn: s.qn } });
    }
  }

  $('#boardBtn').onclick = () => {
    const s = state();
    if (s.phase !== 'reveal') return;
    const round = findRound(s.roundId);
    // Snelle rondes (Wie is het?) tonen de stand pas op het einde.
    if (round && round.fast && s.qIndex + 1 < s.qTotal) nextStep();
    else showBoard();
  };
  $('#nextBtn').onclick = nextStep;

  $('#endBtn').onclick = () => {
    if (confirm('De quiz beëindigen en de eindstand tonen?')) {
      Store.set(path('state'), { phase: 'end', qn: state().qn || 0 });
    }
  };

  // Geeft iedereen punten voor een spelletje. fn(id) -> { pts, frac, msg, detail, answered }
  function awardAll(qn, fn) {
    const upd = {};
    for (const id of Object.keys(players())) {
      const r = fn(id) || {};
      const pts = Math.max(0, Math.round(r.pts || 0));
      upd['scores/' + id] = {
        total: ((scores()[id] && scores()[id].total) || 0) + pts,
        last: pts,
        lastQn: qn,
        frac: r.frac == null ? (pts > 0 ? 1 : 0) : r.frac,
        detail: r.detail == null ? null : r.detail,
        answered: r.answered !== false,
        msg: r.msg || null
      };
    }
    return upd;
  }

  // ================= WIE IS HET? =================
  function startWhois(round) {
    Store.update(path(), {
      whois: null,
      state: baseState(round, 'whois-write', {
        startedAt: Store.now(),
        duration: round.writeSeconds || 120,
        traits: round.traits || [],
        maxTraits: round.maxTraits || 4
      })
    });
  }

  function whoisHints() {
    const hints = (game.whois && game.whois.hints) || {};
    return Object.keys(hints).filter((id) => players()[id] && hints[id] && typeof hints[id] === 'object');
  }
  const whoisCount = (round) => Math.max(1, Math.ceil(Object.keys(players()).length * (round.share || 0.5)));

  function startGuessing() {
    const s = state();
    const round = baseRound(s.roundId);
    const ids = whoisHints();
    if (!ids.length) return;
    const chosen = shuffled(ids).slice(0, whoisCount(round));
    const max = Math.min(1000, Math.round((round.totalPoints || 12000) / chosen.length / 10) * 10);
    dyn = {
      id: round.id,
      name: round.name,
      kind: 'whois',
      fast: true,
      maxPoints: max,
      wrongPoints: Math.round(max * (round.wrongShare || 0)),
      questions: chosen.map((id) => ({
        type: 'who',
        text: String(game.whois.hints[id].text || '').trim() || 'Wie is dit?',
        profile: {
          color: game.whois.hints[id].color || null,
          animal: game.whois.hints[id].animal || null,
          traits: game.whois.hints[id].traits || [],
          k: game.whois.hints[id].k || null
        },
        correct: id,
        correctName: nameOf(id),
        duration: round.guessSeconds || 20
      }))
    };
    sessionStorage.setItem(DYN_KEY, JSON.stringify(dyn));
    startQuestion(dyn, 0);
  }

  // ================= TEAMSPEL =================
  function startTeams(round) {
    Store.update(path(), {
      teampick: null,
      state: baseState(round, 'teams-pick', { teamNames: round.teamNames || ['Team 1', 'Team 2'] })
    });
  }

  function finishTeams(winner) {
    const s = state();
    const round = baseRound(s.roundId);
    const picks = game.teampick || {};
    const names = round.teamNames || ['Team 1', 'Team 2'];
    const qn = (s.qn || 0) + 1;
    const upd = awardAll(qn, (id) => {
      if (!picks[id]) return { pts: 0, frac: 0, answered: false, msg: 'Je koos geen team' };
      const won = picks[id] === winner;
      return {
        pts: won ? round.winPoints : round.losePoints,
        frac: won ? 1 : 0.5,
        msg: won ? 'Jouw team wint!' : 'Jouw team verliest'
      };
    });
    upd.state = baseState(round, 'gameresult', { qn, game: 'teams', winner, title: names[winner - 1] + ' wint!' });
    SFX.reveal();
    setTimeout(() => Store.update(path(), upd), 650);
  }

  // ================= VERSTOPPERTJE =================
  function startHide(round) {
    Store.update(path(), {
      hide: null,
      state: baseState(round, 'hide-place', { map: round.map, startedAt: Store.now(), duration: round.placeSeconds || 60 })
    });
  }
  const hideSpots = () => (game.hide && game.hide.spots) || {};
  const hideFound = () => (game.hide && game.hide.found) || {};
  const foundCount = (id) => Object.keys(hideFound()[id] || {}).filter((t) => players()[t]).length;

  function startSeek() {
    const s = state();
    const round = baseRound(s.roundId);
    Store.set(
      path('state'),
      baseState(round, 'hide-seek', {
        map: round.map,
        radius: round.radius || 4,
        startedAt: Store.now() + INTRO_MS,
        duration: round.seekSeconds || 300,
        intro: 'Zoeken!'
      })
    );
  }

  function finishHide() {
    const s = state();
    const round = baseRound(s.roundId);
    const qn = (s.qn || 0) + 1;
    const upd = awardAll(qn, (id) => {
      const n = foundCount(id);
      return { pts: n * (round.findPoints || 200), frac: n ? 1 : 0, detail: n, msg: n + (n === 1 ? ' persoon gevonden' : ' personen gevonden') };
    });
    upd.state = baseState(round, 'gameresult', { qn, game: 'hide', map: round.map, title: 'Hier zat iedereen verstopt' });
    SFX.reveal();
    setTimeout(() => Store.update(path(), upd), 650);
  }

  // ================= IQ-TEST =================
  function startIq(round) {
    Store.update(path(), { iq: null, state: baseState(round, 'iq-group', { groupMax: round.groupMax || 3 }) });
  }

  function startIqPlay() {
    const s = state();
    const round = baseRound(s.roundId);
    Store.set(
      path('state'),
      baseState(round, 'iq-play', {
        groupMax: round.groupMax || 3,
        startedAt: Store.now() + INTRO_MS,
        duration: round.seconds || 300,
        intro: 'IQ-test'
      })
    );
  }

  // Groepjes: spelers met dezelfde groepId horen samen. Wie alleen is, vormt zijn eigen groep.
  function iqClusters() {
    const g = (game.iq && game.iq.group) || {};
    const map = new Map();
    for (const id of Object.keys(players())) {
      const gid = g[id] || 'solo-' + id;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid).push(id);
    }
    return [...map.entries()].map(([gid, ids]) => ({ gid: ids.length > 1 ? gid : 'solo-' + ids[0], ids: ids.sort(byName) }));
  }
  const iqProg = (id) => (game.iq && game.iq.prog && game.iq.prog[id]) || { pts: 0, n: 0 };

  function finishIq() {
    const s = state();
    const round = baseRound(s.roundId);
    const qn = (s.qn || 0) + 1;
    const avgOf = {};
    for (const c of iqClusters()) {
      const avg = Math.round(c.ids.reduce((sum, id) => sum + iqProg(id).pts, 0) / c.ids.length);
      c.ids.forEach((id) => (avgOf[id] = { avg, size: c.ids.length }));
    }
    const upd = awardAll(qn, (id) => {
      const own = iqProg(id).pts;
      const { avg, size } = avgOf[id];
      return {
        pts: avg,
        frac: avg > 0 ? 1 : 0,
        detail: own,
        msg: size > 1 ? `Groepsgemiddelde (jij haalde ${fmt(own)})` : 'Jouw IQ-score'
      };
    });
    upd.state = baseState(round, 'gameresult', { qn, game: 'iq', title: 'Resultaat van de IQ-test' });
    SFX.reveal();
    setTimeout(() => Store.update(path(), upd), 650);
  }

  // ---------- Timer ----------
  function onTick() {
    const s = state();
    const intro = $('#intro');
    const now = Store.now();
    if (s.phase === 'question') {
      const dur = s.question.duration;
      if (now < s.startedAt) {
        if (intro.hidden) {
          $('#introText').textContent = (s.question.label || 'Vraag') + ' ' + (s.qIndex + 1);
          $('#introSub').textContent = s.roundName;
          intro.hidden = false;
        }
        $('#timer').textContent = dur;
        $('#fuse').style.width = '100%';
        return;
      }
      intro.hidden = true;
      countdown(dur - (now - s.startedAt) / 1000, dur, $('#timer'), $('#timerBox'), $('#revealBtn'), 5, false);
      $('#fuse').style.width = Math.max(0, ((dur - (now - s.startedAt) / 1000) / dur) * 100) + '%';
    } else if (TIMED.includes(s.phase)) {
      if (now < s.startedAt) {
        if (intro.hidden) {
          $('#introText').textContent = s.intro || s.roundName;
          $('#introSub').textContent = s.roundName;
          intro.hidden = false;
        }
        $('#gTimer').textContent = clock(s.duration);
        return;
      }
      intro.hidden = true;
      countdown(s.duration - (now - s.startedAt) / 1000, s.duration, $('#gTimer'), $('#gTimerBox'), $('#gBtn'), 10, true);
    } else {
      intro.hidden = true;
    }
  }

  function countdown(left, dur, label, box, readyBtn, urgentFrom, asClock) {
    if (!timer.started) {
      timer.started = true;
      SFX.go();
    }
    const sec = Math.max(0, Math.ceil(left));
    label.textContent = asClock ? clock(left) : sec;
    box.classList.toggle('urgent', sec <= urgentFrom && left > 0);
    if (sec !== timer.lastSec) {
      timer.lastSec = sec;
      if (sec <= 5 && sec > 0) SFX.tick(sec <= 3);
    }
    if (left <= 0 && !timer.timeup) {
      timer.timeup = true;
      SFX.timeup();
      readyBtn.classList.add('ready');
    }
  }

  // ---------- Weergave ----------
  function render() {
    const s = state();
    const key = s.phase + '|' + (s.qn || 0);
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      busy = false;
      if (s.phase !== 'reveal' && s.phase !== 'gameresult') stage = 'answer';
      if (s.phase !== 'question' && s.phase !== 'reveal') Object.assign(timer, { started: false, timeup: false, lastSec: null, answers: 0 });
      setMusic();
    }
    $('#pinSmall').textContent = s.phase === 'lobby' ? '' : 'Code: ' + pin;
    if (s.phase === 'lobby') renderLobby();
    else if (s.phase === 'select') renderSelect();
    else if (s.phase === 'question' || s.phase === 'reveal') renderQuestion(s);
    else if (s.phase === 'end') renderEnd();
    else renderGame(s);
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
          const isQuiz = !round.kind || round.kind === 'quiz';
          const n = isQuiz ? round.questions.length : 1;
          const done = played[round.id];
          return plaque(
            'button',
            {
              class: 'round' + (done ? ' done' : ''),
              orn: true,
              style: `animation-delay:${i * 110}ms`,
              disabled: !n,
              onclick: () => {
                if (done && !confirm('Deze ronde is al gespeeld. Opnieuw spelen?')) return;
                startRound(round);
              }
            },
            `${i + 1}. ${round.name}`,
            h('small', {}, done ? 'gespeeld' : !n ? 'binnenkort' : isQuiz ? n + ' vragen' : round.desc || '')
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
    const round = findRound(s.roundId) || {};

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
    const total = Object.keys(ps).length - (q.type === 'who' ? 1 : 0);
    $('#answered').textContent = `${answeredIds.length} / ${total} antwoorden`;
    if (!isReveal && answeredIds.length > timer.answers) SFX.blip();
    timer.answers = answeredIds.length;
    if (!isReveal && total > 0 && answeredIds.length >= total) $('#revealBtn').classList.add('ready');

    $('#revealBtn').hidden = isReveal;
    $('#boardBtn').hidden = !isReveal;
    $('#boardBtn .plaque-text').textContent = round.fast && s.qIndex + 1 < s.qTotal ? 'Volgende' : 'Stand';
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
      fill(
        body,
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
      fill(
        body,
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
      fill(
        body,
        h('p', { class: 'hint' }, 'Zet in de juiste volgorde' + (q.hint ? ': ' + q.hint : '')),
        h('div', { class: 'order-list' }, q.items.map((it) => plaque('div', { class: 'order-item' }, it)))
      );
    } else if (q.type === 'who') {
      fill(body, profileCard(q.profile), h('p', { class: 'hint' }, 'Wie is dit? Kies de juiste naam op je gsm.'));
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
    const delay = (i) => `animation-delay:${Math.min(i, 30) * 70}ms`;

    if (q.type === 'choice') {
      document.querySelectorAll('#qBody .option').forEach((el, i) => {
        el.classList.toggle('correct', i === sol.correct);
        el.classList.toggle('dim', i !== sol.correct);
        el.querySelector('.count').textContent = ids.filter((id) => answers[id].v === i).length;
        if (i === sol.correct) sparkTarget = el;
      });
    } else if (q.type === 'text') {
      const groups = new Map();
      for (const id of ids) {
        const key = normalizeText(answers[id].v);
        if (!groups.has(key)) groups.set(key, { text: String(answers[id].v), ids: [], ok: fracOf(id) >= 1 });
        groups.get(key).ids.push(id);
      }
      const list = [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
      const big = plaque('div', { class: 'answer-big correct', orn: true }, sol.answer);
      fill(
        out,
        big,
        h(
          'div',
          { class: 'words' + (first ? '' : ' static') },
          list.map((g, i) =>
            h(
              'button',
              {
                class: 'word ' + (g.ok ? 'ok' : 'no') + (g.ids.length > 1 ? ' big' : ''),
                style: delay(i),
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
    } else if (q.type === 'who') {
      // Op wie werd er gestemd?
      const votes = new Map();
      for (const id of ids) votes.set(answers[id].v, (votes.get(answers[id].v) || 0) + 1);
      const list = [...votes.entries()].sort((a, b) => b[1] - a[1]);
      const big = plaque('div', { class: 'answer-big correct', orn: true }, sol.name);
      fill(
        out,
        big,
        h(
          'div',
          { class: 'words' },
          list.map(([target, n], i) =>
            h('span', { class: 'word ' + (target === sol.id ? 'ok' : 'no') + (n > 1 ? ' big' : ''), style: delay(i) }, nameOf(target), h('small', {}, '×' + n))
          )
        )
      );
      sparkTarget = big;
    } else if (q.type === 'number') {
      const sorted = ids.slice().sort((a, b) => fracOf(b) - fracOf(a) || Math.abs(answers[a].v - sol.value) - Math.abs(answers[b].v - sol.value));
      const big = plaque('div', { class: 'answer-big correct', orn: true }, fmt(sol.value) + (q.unit ? ' ' + q.unit : ''));
      fill(
        out,
        big,
        h(
          'div',
          { class: 'words' },
          sorted.map((id, i) => h('span', { class: 'word ' + fracClass(fracOf(id)), style: delay(i) }, ps[id].name, h('small', {}, fmt(answers[id].v))))
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

  // ================= WEERGAVE VAN DE SPELLETJES =================
  function setGame(o) {
    $('#gName').textContent = o.name;
    $('#gTitle').textContent = o.title || '';
    $('#gTitle').hidden = !o.title;
    $('#gSub').textContent = o.sub || '';
    $('#gFoot').textContent = '';
    $('#gTimerBox').hidden = !o.timer;
    $('#gTimerBox').classList.remove('urgent');
    const btn = $('#gBtn');
    btn.hidden = !o.btn;
    btn.classList.remove('ready');
    btn.disabled = false;
    btn.querySelector('.plaque-text').textContent = o.btn || '';
    btn.onclick = o.onBtn || null;
  }
  const timeOver = (s) => Store.now() >= s.startedAt + s.duration * 1000;

  function renderGame(s) {
    if (s.phase === 'gameresult' && stage === 'board') return;
    showView('v-game');
    const key = s.phase + '|' + (s.qn || 0) + '|' + s.roundId;
    const first = key !== gameKey;
    gameKey = key;
    const round = baseRound(s.roundId);
    const body = $('#gBody');
    const ps = players();
    const total = Object.keys(ps).length;

    if (s.phase === 'whois-write') {
      const ids = whoisHints();
      if (first) {
        setGame({
          name: s.roundName,
          title: 'Maak een mysterieus profiel van jezelf',
          sub: 'Kies op je gsm je lievelingskleur, je lievelingsdier en wat bij je past, en schrijf een kleine hint. Verklap niet te veel!',
          btn: 'Start het raden',
          onBtn: startGuessing,
          timer: true
        });
      }
      fill(
        body,
        plaque('div', { class: 'answer-big' }, `${ids.length} / ${total} profielen binnen`),
        h('div', { class: 'names' }, ids.sort(byName).map((id) => plaque('div', { class: 'name' }, nameOf(id)))),
        h('p', { class: 'hint' }, `Niet iedereen komt aan bod: we raden ${Math.min(whoisCount(round), Math.max(1, ids.length))} profielen.`)
      );
      $('#gBtn').disabled = !ids.length;
      if (total && ids.length >= total) $('#gBtn').classList.add('ready');
    } else if (s.phase === 'teams-pick') {
      const picks = game.teampick || {};
      const names = round.teamNames || ['Team 1', 'Team 2'];
      if (first) {
        setGame({
          name: s.roundName,
          title: 'Kies je team',
          sub: `Kies op je gsm. Het winnende team krijgt ${fmt(round.winPoints)} punten, het andere ${fmt(round.losePoints)}.`
        });
      }
      const col = (t) => {
        const ids = Object.keys(ps)
          .filter((id) => picks[id] === t)
          .sort(byName);
        return h(
          'div',
          { class: 'panel team-col' },
          h('h2', {}, `${names[t - 1]} (${ids.length})`),
          h('div', { class: 'names' }, ids.map((id) => plaque('div', { class: 'name' }, nameOf(id)))),
          plaque('button', { class: 'win-btn', onclick: () => confirm(names[t - 1] + ' wint. Punten uitdelen?') && finishTeams(t) }, names[t - 1] + ' wint')
        );
      };
      const none = Object.keys(ps)
        .filter((id) => !picks[id])
        .sort(byName);
      fill(body, h('div', { class: 'columns' }, col(1), col(2)), none.length ? h('p', { class: 'hint' }, 'Nog niet gekozen: ' + none.map(nameOf).join(', ')) : null);
    } else if (s.phase === 'hide-place') {
      if (first) {
        setGame({
          name: s.roundName,
          title: 'Verstop je op de kaart',
          sub: 'Tik op je gsm op de plek waar je je verstopt. Daarna gaat iedereen zoeken.',
          btn: 'Start het zoeken',
          onBtn: startSeek,
          timer: true
        });
        fill(body, h('div', { class: 'map-wrap wide-map' }, buildImageMap(s.map)));
      }
      const n = Object.keys(hideSpots()).filter((id) => ps[id]).length;
      $('#gFoot').textContent = `${n} / ${total} verstopt`;
      if (total && n >= total) $('#gBtn').classList.add('ready');
    } else if (s.phase === 'hide-seek') {
      if (first) {
        setGame({
          name: s.roundName,
          title: 'Zoek de anderen!',
          sub: `Tik op je gsm op de kaart waar je iemand vermoedt. Elke gevonden persoon is ${fmt(round.findPoints)} punten waard.`,
          btn: 'Stop en toon alles',
          onBtn: () => (timeOver(s) || confirm('De tijd is nog niet om. Toch stoppen?')) && finishHide(),
          timer: true
        });
        fill(
          body,
          h('div', { class: 'columns' }, h('div', { class: 'map-wrap wide-map grow' }, buildImageMap(s.map)), h('div', { class: 'panel' }, h('h2', {}, 'Beste speurders'), h('ol', { class: 'board compact', id: 'seekBoard' })))
        );
      }
      const rows = Object.keys(ps)
        .map((id) => ({ name: nameOf(id), total: foundCount(id) }))
        .filter((r) => r.total)
        .sort((a, b) => b.total - a.total);
      renderBoard($('#seekBoard'), rows, 8);
      const all = rows.reduce((sum, r) => sum + r.total, 0);
      if (all > timer.answers) SFX.blip();
      timer.answers = all;
    } else if (s.phase === 'iq-group' || s.phase === 'iq-play') {
      const playing = s.phase === 'iq-play';
      if (first) {
        setGame(
          playing
            ? {
                name: s.roundName,
                sub: 'Los zoveel mogelijk puzzels op. Kun je er eentje niet? Sla ze over!',
                btn: 'Toon resultaat',
                onBtn: () => (timeOver(s) || confirm('De tijd is nog niet om. Toch stoppen?')) && finishIq(),
                timer: true
              }
            : {
                name: s.roundName,
                title: 'Vorm een groepje (of speel alleen)',
                sub: `Vraag op je gsm iemand om samen te spelen, met maximaal ${s.groupMax}. Iedereen puzzelt op zijn eigen gsm; je krijgt het gemiddelde van je groepje.`,
                btn: 'Start de IQ-test',
                onBtn: startIqPlay
              }
        );
        if (!body.querySelector('.iq-board')) {
          iqEls.clear();
          fill(body, h('div', { class: 'iq-board' }));
        }
      }
      layoutIq(body.querySelector('.iq-board'), playing);
    } else if (s.phase === 'gameresult') {
      if (!first) return;
      setGame({ name: s.roundName, title: s.title, btn: 'Stand', onBtn: showBoard });
      if (s.game === 'teams') {
        const picks = game.teampick || {};
        const winners = Object.keys(ps)
          .filter((id) => picks[id] === s.winner)
          .sort(byName);
        const names = h('div', { class: 'names' }, winners.map((id) => plaque('div', { class: 'name pop' }, nameOf(id))));
        fill(body, h('p', { class: 'hint' }, `+${fmt(round.winPoints)} punten voor de winnaars, +${fmt(round.losePoints)} voor het andere team`), names);
        FX.burstAt($('#gTitle'), 140, 10);
        SFX.fanfare();
      } else if (s.game === 'hide') {
        const pins = Object.keys(hideSpots())
          .filter((id) => ps[id])
          .map((id) => ({ x: hideSpots()[id].x, y: hideSpots()[id].y, cls: 'near', label: nameOf(id) }));
        const rows = Object.keys(ps)
          .map((id) => ({ name: nameOf(id), total: foundCount(id) }))
          .sort((a, b) => b.total - a.total);
        fill(
          body,
          h('div', { class: 'columns' }, h('div', { class: 'map-wrap wide-map grow' }, buildImageMap(s.map, pins)), h('div', { class: 'panel' }, h('h2', {}, 'Gevonden'), h('ol', { class: 'board compact', id: 'seekBoard' })))
        );
        renderBoard($('#seekBoard'), rows, 10);
      } else if (s.game === 'iq') {
        const rows = iqClusters()
          .map((c) => ({
            name: c.ids.map(nameOf).join(' + '),
            total: Math.round(c.ids.reduce((sum, id) => sum + iqProg(id).pts, 0) / c.ids.length)
          }))
          .sort((a, b) => b.total - a.total);
        const list = h('ol', { class: 'board' });
        fill(body, list);
        renderBoard(list, rows, 10, false);
        list.querySelectorAll('.board-row').forEach((el, i) => {
          el.classList.add('slide');
          el.style.animationDelay = i * 120 + 'ms';
        });
        FX.burstAt($('#gTitle'), 100, 9);
      }
    }
    onTick();
  }

  // Zet de namen op het IQ-bord: iedereen op een vaste willekeurige plek,
  // groepjes schuiven naar elkaar toe.
  function layoutIq(board, playing) {
    if (!board) return;
    const clusters = iqClusters();
    const seen = new Set();
    let grouped = 0;
    for (const c of clusters) {
      const inGroup = c.ids.length > 1;
      const anchor = inGroup ? c.gid : c.ids[0];
      const x = 9 + hash01(anchor, 1) * 82;
      const y = 6 + hash01(anchor, 2) * (inGroup ? 62 : 80);
      const color = TEAM_COLORS[Math.floor(hash01(anchor, 3) * TEAM_COLORS.length)];
      c.ids.forEach((id, i) => {
        seen.add(id);
        if (inGroup) grouped++;
        let el = iqEls.get(id);
        if (!el) {
          el = plaque('div', { class: 'name iq-name pop' }, '');
          iqEls.set(id, el);
          board.append(el);
        }
        const n = iqProg(id).n;
        el.querySelector('.plaque-text').textContent = nameOf(id) + (playing && n ? ' · ' + n : '');
        el.style.left = x + '%';
        el.style.top = `calc(${y}% + ${i * 2.5}em)`;
        el.classList.toggle('grouped', inGroup);
        el.style.setProperty('--group', inGroup ? color : 'transparent');
      });
    }
    for (const [id, el] of iqEls) {
      if (!seen.has(id)) {
        el.remove();
        iqEls.delete(id);
      }
    }
    if (grouped > timer.grouped) SFX.pop();
    timer.grouped = grouped;
    const solved = Object.keys(players()).reduce((sum, id) => sum + iqProg(id).n, 0);
    if (playing) {
      $('#gFoot').textContent = solved + ' puzzels opgelost';
      if (solved > timer.answers) SFX.blip();
      timer.answers = solved;
    } else {
      const groups = clusters.filter((c) => c.ids.length > 1).length;
      $('#gFoot').textContent = groups + (groups === 1 ? ' groepje' : ' groepjes');
    }
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
