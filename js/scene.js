// Tekent de achtergrond: een chalet met haardvuur, boekenkast, raam en kaarsen.
// Staat er een foto media/achtergrond.jpg, dan wordt die gebruikt in plaats van de tekening.
(function () {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const r = (x, y, w, h, fill, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra || ''}/>`;

  // Boekenkast
  function shelf(x, y, w, rows) {
    let s = r(x - 14, y - 14, w + 28, rows * 96 + 22, '#1c0f08') + r(x, y, w, rows * 96 - 6, '#0f0704');
    const cols = ['#5b2e22', '#3d4a3a', '#6b4b2a', '#2f3b4d', '#7a5a34', '#4a2a2a', '#584a36', '#34262e'];
    for (let row = 0; row < rows; row++) {
      const base = y + row * 96 + 84;
      let bx = x + 8;
      while (bx < x + w - 30) {
        if (rnd() < 0.08) {
          bx += 26; // lege plek
          continue;
        }
        const bw = 12 + rnd() * 16;
        const bh = 52 + rnd() * 26;
        const col = pick(cols);
        s += r(bx.toFixed(1), (base - bh).toFixed(1), bw.toFixed(1), bh.toFixed(1), col);
        if (rnd() < 0.5) s += r(bx.toFixed(1), (base - bh + 8).toFixed(1), bw.toFixed(1), 3, '#c9965a', 'opacity=".5"');
        bx += bw + 1.5;
      }
      s += r(x - 6, base, w + 12, 9, '#2a160c');
    }
    return s;
  }

  // Stenen van de schouw
  function stones(x, y, w, h) {
    let s = r(x, y, w, h, '#2a1f18');
    const cols = ['#4a3a2e', '#3d3027', '#54433a', '#463529', '#3a2c24'];
    let sy = y + 4;
    while (sy < y + h) {
      const sh = 34 + rnd() * 20;
      let sx = x + 4 - rnd() * 30;
      while (sx < x + w) {
        const sw = 50 + rnd() * 60;
        const x0 = Math.max(x + 4, sx);
        const x1 = Math.min(x + w - 4, sx + sw);
        if (x1 - x0 > 12) s += `<rect x="${x0.toFixed(0)}" y="${sy.toFixed(0)}" width="${(x1 - x0).toFixed(0)}" height="${(sh - 5).toFixed(0)}" rx="9" fill="${pick(cols)}"/>`;
        sx += sw + 5;
      }
      sy += sh;
    }
    return s;
  }

  function pine(x, base, hgt, col) {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const w = hgt * (0.42 - i * 0.08);
      const top = base - hgt * (0.38 + i * 0.2);
      const bot = base - hgt * (i * 0.2);
      s += `<path d="M${x} ${top} L${x + w} ${bot} L${x - w} ${bot} Z" fill="${col}"/>`;
    }
    return s;
  }

  function candle(x, base, hgt) {
    return (
      `<ellipse cx="${x}" cy="${base - hgt - 14}" rx="46" ry="46" fill="url(#candleGlow)" class="sc-candle-glow"/>` +
      r(x - 9, base - hgt, 18, hgt, '#e9dcc0', 'rx="3"') +
      `<path class="sc-candle" d="M${x} ${base - hgt - 26} C${x + 8} ${base - hgt - 12} ${x + 5} ${base - hgt - 2} ${x} ${base - hgt - 2} C${x - 5} ${base - hgt - 2} ${x - 8} ${base - hgt - 12} ${x} ${base - hgt - 26} Z" fill="#ffd27a"/>`
    );
  }

  function flame(cx, base, w, hgt, cls, fill) {
    return `<path class="sc-flame ${cls}" style="transform-origin:${cx}px ${base}px" d="M${cx} ${base - hgt} C${cx + w * 0.9} ${base - hgt * 0.45} ${cx + w} ${base - hgt * 0.1} ${cx} ${base} C${cx - w} ${base - hgt * 0.1} ${cx - w * 0.7} ${base - hgt * 0.5} ${cx} ${base - hgt} Z" fill="${fill}"/>`;
  }

  function build() {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a170d"/><stop offset="1" stop-color="#3a2012"/></linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b170c"/><stop offset="1" stop-color="#120804"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16263b"/><stop offset="1" stop-color="#31476a"/></linearGradient>
  <linearGradient id="fl1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a1a"/><stop offset=".6" stop-color="#ffb030"/><stop offset="1" stop-color="#ffe9a0"/></linearGradient>
  <linearGradient id="fl2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e2491a"/><stop offset="1" stop-color="#ff9a2a"/></linearGradient>
  <radialGradient id="fireGlow"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".75"/><stop offset=".45" stop-color="#ff7a20" stop-opacity=".28"/><stop offset="1" stop-color="#ff7a20" stop-opacity="0"/></radialGradient>
  <radialGradient id="candleGlow"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
  <radialGradient id="shade" cx="78%" cy="72%" r="85%"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
  <pattern id="plaid" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="#5a2019"/><rect width="12" height="36" fill="#2c1410" opacity=".7"/><rect width="36" height="12" fill="#2c1410" opacity=".7"/><rect x="22" width="3" height="36" fill="#c9965a" opacity=".35"/><rect y="22" width="36" height="3" fill="#c9965a" opacity=".35"/></pattern>
</defs>`;
    // Muur van planken
    s += r(0, 0, 1600, 900, 'url(#wall)');
    for (let x = 0; x < 1600; x += 118) s += r(x, 0, 3, 760, '#000', 'opacity=".28"');
    // Raam met besneeuwd bos
    s += r(48, 96, 330, 470, '#170b05') + r(66, 114, 294, 434, 'url(#sky)');
    s += `<circle cx="300" cy="180" r="22" fill="#e8e3cf" opacity=".85"/>`;
    for (let i = 0; i < 26; i++) s += `<circle cx="${(70 + rnd() * 286).toFixed(0)}" cy="${(120 + rnd() * 200).toFixed(0)}" r="${(0.8 + rnd() * 1.2).toFixed(1)}" fill="#fff" opacity="${(0.3 + rnd() * 0.5).toFixed(2)}"/>`;
    s += pine(120, 560, 300, '#0c1722') + pine(215, 570, 380, '#08111a') + pine(305, 560, 260, '#0c1722') + pine(170, 575, 190, '#050b11');
    s += r(66, 500, 294, 48, '#0a121b');
    s += r(206, 114, 14, 434, '#170b05') + r(66, 318, 294, 14, '#170b05') + r(30, 560, 366, 22, '#22110a');
    // Boekenkast en wereldbol
    s += shelf(470, 70, 560, 3);
    s += `<circle cx="1000" cy="118" r="30" fill="#6b4b2a"/><path d="M972 108 q28 -22 56 0 M972 128 q28 18 56 0" stroke="#3a2412" stroke-width="3" fill="none"/>` + r(994, 146, 12, 10, '#2a160c') + r(980, 152, 40, 6, '#2a160c');
    // Klimop
    for (let i = 0; i < 3; i++) {
      const ix = 440 + i * 26;
      const len = 150 + rnd() * 130;
      s += `<path d="M${ix} 0 q${-16 + rnd() * 32} ${len / 2} ${-8 + rnd() * 16} ${len}" stroke="#24391f" stroke-width="3" fill="none"/>`;
      for (let y = 20; y < len; y += 22) s += `<ellipse cx="${(ix + (rnd() - 0.5) * 34).toFixed(0)}" cy="${y}" rx="11" ry="6" fill="${pick(['#2f4a27', '#3a5a2e', '#263d20'])}" transform="rotate(${(rnd() * 90 - 45).toFixed(0)} ${ix} ${y})"/>`;
    }
    // Schouw
    s += stones(1120, 250, 440, 650);
    s += r(1086, 232, 508, 40, '#2a160c') + r(1086, 232, 508, 8, '#4a2a16');
    s += `<path d="M1206 840 V560 q0 -70 134 -70 q134 0 134 70 V840 Z" fill="#070302"/>`;
    s += `<ellipse cx="1340" cy="720" rx="330" ry="300" fill="url(#fireGlow)" class="sc-glow"/>`;
    s += `<g transform="rotate(-9 1340 800)">${r(1244, 786, 196, 30, '#2a1509', 'rx="14"')}</g><g transform="rotate(8 1340 812)">${r(1236, 800, 204, 32, '#1e0f06', 'rx="15"')}</g>`;
    s += `<g class="sc-fire">` + flame(1290, 800, 44, 150, 'f2', 'url(#fl2)') + flame(1392, 802, 40, 135, 'f3', 'url(#fl2)') + flame(1340, 800, 58, 215, 'f1', 'url(#fl1)') + flame(1312, 802, 30, 120, 'f4', 'url(#fl1)') + flame(1372, 802, 28, 105, 'f5', '#ffe9a0') + `</g>`;
    s += r(1180, 838, 320, 16, '#1a0e08');
    // Schilderij boven de schouw
    s += r(1240, 70, 220, 150, '#8a6a34') + r(1250, 80, 200, 130, '#22303f');
    s += `<path d="M1250 210 L1310 130 L1345 170 L1385 110 L1450 210 Z" fill="#3c4a57"/><path d="M1372 127 L1385 110 L1399 132 L1386 126 Z" fill="#dfe3e6"/>` + r(1250, 196, 200, 14, '#1c2a22');
    // Kaarsen op de schouwmantel
    s += candle(1140, 232, 44) + candle(1176, 232, 62) + candle(1540, 232, 50);
    // Vloer en tapijt
    s += r(0, 760, 1600, 140, 'url(#floor)');
    for (let x = -40; x < 1600; x += 190) s += `<path d="M${x} 900 L${x + 90} 760" stroke="#000" stroke-width="2" opacity=".3"/>`;
    s += `<path d="M520 900 L640 800 H1130 L1250 900 Z" fill="#4a1c16"/><path d="M560 900 L664 814 H1106 L1210 900 Z" fill="none" stroke="#c9965a" stroke-width="3" opacity=".45"/><path d="M640 900 L712 838 H1058 L1130 900 Z" fill="#2c2433" opacity=".7"/>`;
    // Zetel met geruit deken
    s += `<path d="M-30 900 V560 q0 -70 90 -70 h110 q90 0 96 80 l20 330 Z" fill="#3a1711"/><path d="M-30 900 V690 q150 -34 320 -6 l14 216 Z" fill="#4a1f17"/>`;
    s += `<path d="M-10 600 q90 -60 210 -30 q50 90 60 330 H-10 Z" fill="url(#plaid)" opacity=".9"/>`;
    // Bijzettafel met mok en kaars
    s += r(330, 786, 190, 14, '#2a160c') + r(350, 800, 12, 100, '#1c0f08') + r(488, 800, 12, 100, '#1c0f08');
    s += r(366, 736, 44, 50, '#d9d0bd', 'rx="5"') + `<path d="M410 748 q22 4 0 28" stroke="#d9d0bd" stroke-width="7" fill="none"/>` + `<path d="M376 770 L388 750 L400 770 Z" fill="#3d5a44"/>`;
    s += candle(462, 786, 30);
    // Lamp
    s += `<ellipse cx="20" cy="210" rx="120" ry="120" fill="url(#candleGlow)"/><path d="M-30 150 L50 150 L80 230 L-60 230 Z" fill="#b98a4e" opacity=".9"/>`;
    // Alles wat donkerder, zodat de plaketten goed leesbaar blijven
    s += r(0, 0, 1600, 900, 'url(#shade)');
    return s + '</svg>';
  }

  function init() {
    const bg = document.querySelector('.bg');
    if (!bg) return;
    const holder = document.createElement('div');
    holder.className = 'scene';
    holder.innerHTML = build();
    bg.append(holder);
    // Eigen foto aanwezig? Dan die tonen en de tekening verbergen.
    const img = new Image();
    img.onload = () => {
      bg.style.background = 'url(media/achtergrond.jpg) center / cover no-repeat';
      bg.classList.add('has-photo');
    };
    img.src = 'media/achtergrond.jpg';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
