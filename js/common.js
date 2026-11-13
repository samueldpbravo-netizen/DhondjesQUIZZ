// Gedeelde hulpfuncties voor host- en spelerscherm.

// Het gratis Firebase-plan laat 100 gelijktijdige verbindingen toe (host inbegrepen).
// Met het Blaze-plan mag dit getal omhoog.
const MAX_PLAYERS = 99;
const DEFAULT_DURATION = 25;
const INTRO_MS = 3600; // "Vraag 3"-aankondiging voor de timer start

const TEAM_COLORS = ['#e8915a', '#7fb7d9', '#e6c65c', '#8fc98a', '#c79be0', '#e58fa8', '#6fcfb8', '#d8a06a'];

// Kaarten voor locatievragen. full = binnen deze afstand (km) volle punten,
// max = vanaf deze afstand 0 punten.
const MAPS = {
  belgie: { src: 'media/maps/belgie.svg', w: 1000, h: 795, lonMin: 2.3, lonMax: 6.65, latMin: 49.4, latMax: 51.6, full: 8, max: 110 },
  europa: { src: 'media/maps/europa.svg', w: 1000, h: 925, lonMin: -11, lonMax: 31, latMin: 35, latMax: 61, full: 60, max: 900 }
};

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

// Een houten plaket zoals in het thema. orn = met ruitjes links en rechts.
function plaque(tag, attrs, ...children) {
  attrs = attrs || {};
  const orn = attrs.orn;
  delete attrs.orn;
  attrs.class = 'plaque ' + (attrs.class || '');
  return h(
    tag,
    attrs,
    orn ? h('span', { class: 'gem left' }, '◆') : null,
    h('span', { class: 'plaque-text' }, children),
    orn ? h('span', { class: 'gem right' }, '◆') : null
  );
}

// Zet een tekst letter per letter in een element, zodat de letters één voor één binnenvallen.
function letters(el, text) {
  el.replaceChildren(
    ...[...String(text)].map((ch, i) => h('span', { class: 'letter', style: `animation-delay:${i * 55}ms` }, ch === ' ' ? '\u00a0' : ch))
  );
}

// De aankondiging voor een vraag of spel: eerst de titel, dan aftellen 3 - 2 - 1.
// remaining = milliseconden tot de start. Geeft true terug zolang de aankondiging zichtbaar is.
let introShown = null;
function introTick(remaining, label, sub) {
  const el = $('#intro');
  if (remaining <= 0) {
    if (!el.hidden) el.hidden = true;
    introShown = null;
    return false;
  }
  const counting = remaining <= 2400;
  const txt = counting ? String(Math.ceil(remaining / 800)) : label;
  if (txt !== introShown) {
    introShown = txt;
    $('#introText').textContent = txt;
    const subEl = $('#introSub');
    if (subEl && sub != null) subEl.textContent = sub;
    el.hidden = false;
    const box = $('#introText').parentElement;
    box.classList.toggle('digit', counting);
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
    if (counting && window.SFX) SFX.tick(txt === '1');
  }
  return true;
}

// Vult een element met kinderen; lege waarden (null/false) worden overgeslagen.
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => {
    const on = v.id === id;
    if (on && v.hidden) {
      v.classList.remove('enter');
      void v.offsetWidth;
      v.classList.add('enter');
    }
    v.hidden = !on;
  });
}

function showBanner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.hidden = false;
}

const fmt = (n) => Number(n).toLocaleString('nl-BE', { maximumFractionDigits: 2 });

// ---------- Kaart ----------
function mapToPct(mapId, lat, lon) {
  const m = MAPS[mapId];
  return {
    x: ((lon - m.lonMin) / (m.lonMax - m.lonMin)) * 100,
    y: ((m.latMax - lat) / (m.latMax - m.latMin)) * 100
  };
}
function pctToMap(mapId, x, y) {
  const m = MAPS[mapId];
  return {
    lat: m.latMax - (y / 100) * (m.latMax - m.latMin),
    lon: m.lonMin + (x / 100) * (m.lonMax - m.lonMin)
  };
}
function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// Bouwt een kaart met speldjes. pins: [{lat, lon, cls, label}]
function buildMap(mapId, pins) {
  const m = MAPS[mapId];
  const box = h('div', { class: 'map', style: `aspect-ratio:${m.w}/${m.h}` }, h('img', { src: m.src, alt: '', draggable: false }));
  (pins || []).forEach((p, i) => box.append(mapPin(mapId, p, i)));
  return box;
}
// Een kaart uit een gewone afbeelding (verstoppertje). Speldjes in procenten: [{x, y, cls, label}]
function buildImageMap(src, pins) {
  const img = h('img', { src, alt: '', draggable: false });
  img.onerror = () => {
    img.onerror = null;
    img.src = MAPS.belgie.src; // nog geen eigen kaart: gebruik de kaart van België
  };
  const box = h('div', { class: 'map' }, img);
  (pins || []).forEach((p, i) => box.append(pctPin(p, i)));
  return box;
}
function pctPin(p, i) {
  return h(
    'div',
    { class: 'pin ' + (p.cls || ''), style: `left:${p.x}%;top:${p.y}%;animation-delay:${Math.min(i || 0, 40) * 40}ms` },
    p.label ? h('span', { class: 'pin-label' }, p.label) : null
  );
}

// Het profiel van "Wie is het?": lievelingskleur, lievelingsdier en eigenschappen.
function profileCard(p) {
  if (!p) return null;
  const items = [];
  if (/^#[0-9a-f]{6}$/i.test(p.color || '')) {
    items.push(h('div', { class: 'prof-item' }, h('span', { class: 'prof-label' }, 'Lievelingskleur'), h('span', { class: 'swatch', style: 'background:' + p.color })));
  }
  if (p.animal) items.push(h('div', { class: 'prof-item' }, h('span', { class: 'prof-label' }, 'Lievelingsdier'), h('strong', {}, p.animal)));
  const traits = p.traits || [];
  if (!items.length && !traits.length) return null;
  return h(
    'div',
    { class: 'profile' },
    items.length ? h('div', { class: 'prof-row' }, items) : null,
    traits.length ? h('div', { class: 'prof-traits' }, traits.map((t, i) => h('span', { class: 'trait on', style: `animation-delay:${i * 120}ms` }, t))) : null
  );
}

// Tijd als m:ss
function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

// Vast willekeurig getal tussen 0 en 1 op basis van een tekst (voor vaste posities).
function hash01(str, salt) {
  let x = 2166136261 ^ (salt || 0);
  for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619);
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

function mapPin(mapId, p, i) {
  const pos = mapToPct(mapId, p.lat, p.lon);
  return h(
    'div',
    { class: 'pin ' + (p.cls || ''), style: `left:${pos.x}%;top:${pos.y}%;animation-delay:${Math.min(i || 0, 40) * 40}ms` },
    p.label ? h('span', { class: 'pin-label' }, p.label) : null
  );
}

// ---------- Antwoorden beoordelen ----------
function normalizeText(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
// Juist als het (op kleine typfouten na) overeenkomt met een goedgekeurd antwoord.
function textMatches(input, answers) {
  const a = normalizeText(input).replace(/ /g, '');
  if (!a) return false;
  return (answers || []).some((ans) => {
    const b = normalizeText(ans).replace(/ /g, '');
    const slack = b.length >= 9 ? 2 : b.length >= 5 ? 1 : 0;
    return levenshtein(a, b) <= slack;
  });
}

// Geeft { frac, detail } terug: frac 1 = helemaal juist, 0 = fout, ertussen = deels.
function judgeAnswer(q, v) {
  if (v == null) return { frac: 0 };
  switch (q.type || 'choice') {
    case 'choice':
    case 'who':
      return { frac: q.allCorrect || v === q.correct ? 1 : 0 };
    case 'text':
      return { frac: textMatches(v, q.answers) ? 1 : 0 };
    case 'number': {
      const diff = Math.abs(Number(v) - q.correct);
      if (!isFinite(diff)) return { frac: 0 };
      const tol = q.tolerance || Math.max(1, Math.abs(q.correct) * 0.5);
      return { frac: diff === 0 ? 1 : Math.max(0, 1 - diff / tol) * 0.9, detail: diff };
    }
    case 'location': {
      const m = MAPS[q.map];
      const km = distanceKm(v, q);
      const frac = km <= m.full ? 1 : Math.max(0, 1 - (km - m.full) / (m.max - m.full)) * 0.9;
      return { frac, detail: Math.round(km) };
    }
    case 'order': {
      const arr = Array.isArray(v) ? v : [];
      const good = q.items.filter((it, i) => arr[i] === it).length;
      return { frac: good / q.items.length, detail: good };
    }
  }
  return { frac: 0 };
}

// Punten: de helft voor juistheid + de helft voor snelheid, maal hoe juist het was.
// max = het maximum voor deze vraag (standaard 1000).
function calcPoints(frac, ms, durationSec, max) {
  if (frac <= 0) return 0;
  max = max || 1000;
  const t = Math.min(1, Math.max(0, ms / (durationSec * 1000)));
  return Math.round(frac * (max / 2 + (max / 2) * (1 - t)));
}

// Het juiste antwoord als tekst (voor het spelerscherm).
function solutionText(question, sol) {
  if (!sol) return '';
  switch (question.type) {
    case 'choice':
      return sol.all ? 'elk antwoord was goed!' : question.options[sol.correct];
    case 'text':
      return sol.answer;
    case 'number':
      return fmt(sol.value) + (question.unit ? ' ' + question.unit : '');
    case 'location':
      return sol.label;
    case 'order':
      return sol.items.join(' → ');
    case 'who':
      return sol.name;
  }
  return '';
}

// ---------- Groepen en ranglijst ----------
function teamList(config) {
  const teams = (config && config.teams) || {};
  return Object.keys(teams)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((id, i) => ({ id, name: teams[id].name || 'Groep ' + (i + 1), color: TEAM_COLORS[i % TEAM_COLORS.length] }));
}

// Groepsscore = gemiddelde van de leden, zodat ongelijke groepen eerlijk blijven.
function buildRanking(players, scores, config) {
  players = players || {};
  scores = scores || {};
  const individuals = Object.keys(players)
    .map((id) => ({
      id,
      name: players[id].name,
      teamId: players[id].teamId || null,
      total: (scores[id] && scores[id].total) || 0,
      last: (scores[id] && scores[id].last) || 0
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

function renderBoard(container, rows, limit, animate) {
  container.replaceChildren(
    ...rows.slice(0, limit || rows.length).map((r, i) => {
      const score = h('span', { class: 'board-score' }, fmt(r.total));
      if (animate && window.FX) FX.countUp(score, Math.max(0, r.total - (r.last || 0)), r.total, 900 + i * 60);
      return h(
        'li',
        { class: 'board-row' + (animate ? ' slide' : ''), style: `animation-delay:${i * 90}ms` },
        h('span', { class: 'board-pos' }, i + 1),
        r.color ? h('span', { class: 'dot', style: 'background:' + r.color }) : null,
        h('span', { class: 'board-name' }, r.name, r.count != null ? h('small', {}, ` (${r.count})`) : null),
        score
      );
    })
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

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
