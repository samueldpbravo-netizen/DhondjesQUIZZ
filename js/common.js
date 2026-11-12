// Gedeelde hulpfuncties voor host- en spelerscherm.

const MAX_PLAYERS = 50;
const DEFAULT_DURATION = 20;

const OPTION_STYLE = [
  { color: '#e21b3c', shape: '▲' },
  { color: '#1368ce', shape: '◆' },
  { color: '#d89e00', shape: '●' },
  { color: '#26890c', shape: '■' }
];
const TEAM_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ffa94d', '#38d9a9', '#f783ac'];

const $ = (sel) => document.querySelector(sel);

// Maakt een element: h('div', {class: 'x', onclick: fn}, 'tekst', kind, ...)
function h(tag, attrs, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else if (k in e && k !== 'list') e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : String(c));
  }
  return e;
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== id));
}

function showBanner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.hidden = false;
}

// Punten: 500 voor een juist antwoord + tot 500 extra voor snelheid.
function calcPoints(ms, durationSec) {
  const frac = Math.min(1, Math.max(0, ms / (durationSec * 1000)));
  return Math.round(500 + 500 * (1 - frac));
}

function teamList(config) {
  const teams = (config && config.teams) || {};
  return Object.keys(teams)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((id, i) => ({ id, name: teams[id].name || 'Team ' + (i + 1), color: TEAM_COLORS[i % TEAM_COLORS.length] }));
}

// Ranglijst voor spelers en (indien groepen aan) voor teams.
// Teamscore = gemiddelde van de leden, zodat ongelijke groepen eerlijk blijven.
function buildRanking(players, scores, config) {
  players = players || {};
  scores = scores || {};
  const individuals = Object.keys(players)
    .map((id) => ({
      id,
      name: players[id].name,
      teamId: players[id].teamId || null,
      total: (scores[id] && scores[id].total) || 0
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let teams = [];
  if (config && config.teamMode) {
    teams = teamList(config)
      .map((t) => {
        const members = individuals.filter((p) => p.teamId === t.id);
        const sum = members.reduce((s, p) => s + p.total, 0);
        return { ...t, count: members.length, total: members.length ? Math.round(sum / members.length) : 0 };
      })
      .sort((a, b) => b.total - a.total);
  }
  return { individuals, teams };
}

function renderBoard(container, rows, limit) {
  container.replaceChildren(
    ...rows.slice(0, limit || rows.length).map((r, i) =>
      h(
        'li',
        { class: 'board-row' },
        h('span', { class: 'board-pos' }, i + 1),
        r.color ? h('span', { class: 'dot', style: 'background:' + r.color }) : null,
        h('span', { class: 'board-name' }, r.name, r.count != null ? h('small', {}, ` (${r.count})`) : null),
        h('span', { class: 'board-score' }, r.total)
      )
    )
  );
}

function renderMedia(container, media) {
  container.replaceChildren();
  container.hidden = !media;
  if (!media) return;
  if (media.type === 'video') {
    container.append(h('video', { src: media.src, controls: true, playsInline: true, preload: 'metadata' }));
  } else if (media.type === 'audio') {
    container.append(h('audio', { src: media.src, controls: true }));
  } else {
    container.append(h('img', { src: media.src, alt: '' }));
  }
}
