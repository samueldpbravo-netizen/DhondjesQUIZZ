// Visuele effecten: opstijgende vonken van het haardvuur, vonkenregens en tellers.
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'fx';
  document.addEventListener('DOMContentLoaded', () => document.body.prepend(canvas));
  const g = canvas.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0;
  let H = 0;
  const embers = [];
  const sparks = [];

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
  }
  addEventListener('resize', resize);
  resize();

  function newEmber(anywhere) {
    return {
      x: W * (0.45 + Math.random() * 0.6),
      y: anywhere ? Math.random() * H : H + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.25 + Math.random() * 0.9,
      vx: -0.5 + Math.random() * 0.5,
      phase: Math.random() * 6.28,
      life: 0.4 + Math.random() * 0.6
    };
  }
  const EMBERS = reduce ? 0 : Math.min(70, Math.round(innerWidth / 18));
  for (let i = 0; i < EMBERS; i++) embers.push(newEmber(true));

  const COLORS = ['#ffd27a', '#ffb347', '#ff8a3c', '#fff1c4', '#e8a04a'];

  // Vonkenregen vanaf een punt (x, y in schermpixels)
  function burst(x, y, count, power) {
    if (reduce) return;
    for (let i = 0; i < (count || 60); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (power || 7) * (0.3 + Math.random());
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2,
        r: 1 + Math.random() * 2.6,
        life: 1,
        decay: 0.008 + Math.random() * 0.014,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
  }
  function burstAt(el, count, power) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, count, power);
  }
  // Gouden regen van bovenaf (einde van de quiz)
  let rainTimer = null;
  function rain(seconds) {
    if (reduce) return;
    clearInterval(rainTimer);
    const end = Date.now() + (seconds || 6) * 1000;
    rainTimer = setInterval(() => {
      if (Date.now() > end) return clearInterval(rainTimer);
      for (let i = 0; i < 6; i++) {
        sparks.push({
          x: Math.random() * W,
          y: -10,
          vx: -1 + Math.random() * 2,
          vy: 1 + Math.random() * 3,
          r: 1.5 + Math.random() * 3,
          life: 1,
          decay: 0.004 + Math.random() * 0.004,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }, 50);
  }

  function frame(t) {
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.vy;
      e.x += e.vx + Math.sin(t / 900 + e.phase) * 0.35;
      if (e.y < -10 || e.x < -10) Object.assign(e, newEmber(false));
      const a = e.life * (0.55 + 0.45 * Math.sin(t / 300 + e.phase)) * Math.min(1, e.y / (H * 0.5));
      g.fillStyle = `rgba(255,${150 + Math.round(60 * e.life)},70,${Math.max(0, a)})`;
      g.beginPath();
      g.arc(e.x, e.y, e.r, 0, 6.28);
      g.fill();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.12;
      s.vx *= 0.985;
      s.life -= s.decay;
      if (s.life <= 0 || s.y > H + 20) {
        sparks.splice(i, 1);
        continue;
      }
      g.globalAlpha = Math.max(0, s.life);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, 6.28);
      g.fill();
    }
    g.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Laat een getal oplopen
  function countUp(el, from, to, ms) {
    if (reduce || from === to) {
      el.textContent = Number(to).toLocaleString('nl-BE');
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / (ms || 800));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased).toLocaleString('nl-BE');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Kort schudden (fout antwoord)
  function shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  window.FX = { burst, burstAt, rain, countUp, shake };
})();
