// Speler-scherm: meedoen met een code, groep kiezen, antwoorden.
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
  let me = null;
  let state = null;
  let config = {};
  let scores = {};
  let unsubs = [];
  let builtQn = -1;
  let myAnswer = null; // { qn, choice }

  try {
    myAnswer = JSON.parse(sessionStorage.getItem(ANS_KEY));
  } catch (e) {}

  const path = (sub) => 'games/' + pin + (sub ? '/' + sub : '');

  try {
    await Store.ready;
  } catch (e) {
    $('#loadingText').textContent = e.message;
    return;
  }
  if (Store.mode === 'demo') {
    showBanner('Demo-modus: werkt alleen tussen tabbladen van deze browser.');
  }

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
  if (!resumed) showJoin();

  setInterval(onTick, 200);

  // ---------- Meedoen ----------
  function showJoin(message) {
    $('#playerBar').hidden = true;
    showView('v-join');
    const err = $('#joinError');
    err.hidden = !message;
    err.textContent = message || '';
  }

  $('#joinForm').onsubmit = async (e) => {
    e.preventDefault();
    const p = $('#pinInput').value.trim();
    const name = $('#nameInput').value.trim().slice(0, 16);
    if (!p || !name) return;
    $('#joinBtn').disabled = true;
    try {
      const g = await Store.get('games/' + p);
      const others = (g && g.players) || {};
      if (!g || !g.createdAt) return showJoin('Deze spelcode bestaat niet.');
      if (g.state && g.state.phase === 'end') return showJoin('Deze quiz is al afgelopen.');
      if (Object.keys(others).length >= MAX_PLAYERS) return showJoin('Deze quiz zit vol.');
      if (Object.values(others).some((o) => o.name.toLowerCase() === name.toLowerCase())) {
        return showJoin('Deze naam is al in gebruik. Kies een andere.');
      }
      pin = p;
      await Store.set(path('players/' + pid), { name, joinedAt: Store.now() });
      sessionStorage.setItem(PIN_KEY, pin);
      attach();
    } catch (err) {
      showJoin('Geen verbinding: ' + err.message);
    } finally {
      $('#joinBtn').disabled = false;
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
    showJoin(message);
  }

  // ---------- Antwoorden ----------
  function answer(choice) {
    const s = state;
    if (!s || s.phase !== 'question') return;
    if (myAnswer && myAnswer.qn === s.qn) return;
    const ms = Math.max(0, Store.now() - s.startedAt);
    if (ms > s.question.duration * 1000) return;
    myAnswer = { qn: s.qn, choice };
    sessionStorage.setItem(ANS_KEY, JSON.stringify(myAnswer));
    Store.set(path('answers/q' + s.qn + '/' + pid), { choice, ms });
    render();
  }

  function onTick() {
    const s = state;
    if (!pin || !s || s.phase !== 'question') return;
    const left = s.question.duration - (Store.now() - s.startedAt) / 1000;
    $('#timer').textContent = Math.max(0, Math.ceil(left));
    if (left <= 0 && !(myAnswer && myAnswer.qn === s.qn)) {
      setStatus('Tijd om!');
    }
  }

  function setStatus(text) {
    $('#qOptions').hidden = !!text;
    $('#qStatus').hidden = !text;
    $('#qStatus').textContent = text || '';
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
    $('#meScore').textContent = sc.total || 0;
    const tag = $('#meTeam');
    tag.hidden = !team;
    if (team) {
      tag.textContent = team.name;
      tag.style.background = team.color;
    }

    if (s.phase === 'lobby') renderLobby();
    else if (s.phase === 'select') {
      showView('v-wait');
      $('#waitTitle').textContent = 'Maak je klaar!';
      $('#waitText').textContent = 'De host kiest de volgende ronde…';
    } else if (s.phase === 'question') renderQuestion(s);
    else if (s.phase === 'reveal') renderResult(s, sc);
    else renderEnd(sc, team);
  }

  function renderLobby() {
    showView('v-lobby');
    $('#teamPick').hidden = !config.teamMode;
    if (!config.teamMode) return;
    $('#teamButtons').replaceChildren(
      ...teamList(config).map((t) =>
        h(
          'button',
          {
            class: 'btn team-btn' + (me.teamId === t.id ? ' selected' : ''),
            style: 'background:' + t.color,
            onclick: () => Store.set(path('players/' + pid + '/teamId'), t.id)
          },
          (me.teamId === t.id ? '✓ ' : '') + t.name
        )
      )
    );
  }

  function renderQuestion(s) {
    showView('v-question');
    const q = s.question;
    if (builtQn !== s.qn) {
      builtQn = s.qn;
      $('#qMeta').textContent = `${s.topicName} • Vraag ${s.qIndex + 1}/${s.qTotal}`;
      $('#qText').textContent = q.text;
      renderMedia($('#qMedia'), q.media);
      $('#qOptions').replaceChildren(
        ...q.options.map((text, i) =>
          h(
            'button',
            { class: 'option', style: 'background:' + OPTION_STYLE[i].color, onclick: () => answer(i) },
            h('span', { class: 'shape' }, OPTION_STYLE[i].shape),
            h('span', { class: 'opt-text' }, text)
          )
        )
      );
      setStatus('');
    }
    if (myAnswer && myAnswer.qn === s.qn) setStatus('Antwoord verstuurd! Even wachten op de rest…');
  }

  function renderResult(s, sc) {
    showView('v-result');
    const scored = sc.lastQn === s.qn;
    const ok = scored && sc.correct;
    const answered = scored ? sc.answered : !!(myAnswer && myAnswer.qn === s.qn);
    $('#resultIcon').textContent = ok ? '✓' : '✗';
    $('#resultIcon').className = 'result-icon ' + (ok ? 'good' : 'bad');
    $('#resultTitle').textContent = ok ? 'Juist!' : answered ? 'Helaas, fout' : 'Niet geantwoord';
    $('#resultPoints').textContent = ok ? '+' + sc.last + ' punten' : '';
    $('#resultAnswer').textContent = 'Juiste antwoord: ' + s.question.options[s.correct];
    $('#resultRank').textContent = `Je staat op plaats ${myRank()} met ${sc.total || 0} punten.`;
  }

  function renderEnd(sc, team) {
    showView('v-end');
    $('#endRank').textContent = 'Plaats ' + myRank();
    $('#endScore').textContent = (sc.total || 0) + ' punten';
    $('#endTeam').textContent = team ? 'Groep: ' + team.name : '';
  }
})();
