// Een draaibare wereldbol op een canvas.
//   const g = Globe.create({ interactive, autoRotate, pins, onPick(lat, lon), onMiss() })
//   g.el          het element om in de pagina te zetten
//   g.setPins([{ lat, lon, cls: 'me' | 'win' | '', label }])
//   g.destroy()
// Globe.isLand(lat, lon) zegt of een punt op land ligt.
//
// Werking: de landkaart wordt één keer plat getekend (lengte x breedte). Voor elk
// beeldpunt van de bol wordt dan berekend welk punt van die platte kaart daar hoort.
(function () {
  const RAD = Math.PI / 180;
  const MW = 1440;
  const MH = 720;
  let mask = null; // rood = land, groen = raster, blauw = kustlijn

  // Land of water? We kijken op de platte kaart, dus het klopt met wat je ziet.
  function isLand(lat, lon) {
    if (!mask) buildMask();
    let u = (lon + 180) / 360;
    u -= Math.floor(u);
    const row = Math.min(MH - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MH)));
    return mask[(row * MW + Math.floor(u * MW)) * 4] > 127;
  }

  function buildMask() {
    const cv = document.createElement('canvas');
    cv.width = MW;
    cv.height = MH;
    const m = cv.getContext('2d', { willReadFrequently: true });
    m.fillStyle = '#000';
    m.fillRect(0, 0, MW, MH);
    m.globalCompositeOperation = 'lighter';
    const X = (lon) => ((lon + 180) / 360) * MW;
    const Y = (lat) => ((90 - lat) / 180) * MH;
    // raster om de 30 graden
    m.strokeStyle = 'rgb(0,255,0)';
    m.lineWidth = 1.2;
    m.beginPath();
    for (let lo = -180; lo <= 180; lo += 30) {
      m.moveTo(X(lo), 0);
      m.lineTo(X(lo), MH);
    }
    for (let la = -60; la <= 60; la += 30) {
      m.moveTo(0, Y(la));
      m.lineTo(MW, Y(la));
    }
    m.stroke();
    // land en kustlijn. Sommige stukken land lopen over de datumgrens (180 graden):
    // daar maken we de lengtegraden doorlopend en tekenen we het stuk drie keer
    // (ook een kaartbreedte naar links en naar rechts), zodat beide helften kloppen.
    for (const poly of window.LAND) {
      const rings = poly.map((ring) => {
        const pts = [[ring[0], ring[1]]];
        for (let i = 2; i < ring.length; i += 2) {
          let lon = ring[i];
          const prev = pts[pts.length - 1][0];
          while (lon - prev > 180) lon -= 360;
          while (lon - prev < -180) lon += 360;
          pts.push([lon, ring[i + 1]]);
        }
        // Een ring die helemaal rond de pool loopt (Antarctica) komt niet terug bij zijn begin.
        const around = Math.abs(pts[pts.length - 1][0] - pts[0][0]) > 180;
        return { pts, around, pole: pts[0][1] < 0 ? -90 : 90 };
      });
      for (const shift of [-360, 0, 360]) {
        m.beginPath();
        for (const r of rings) {
          r.pts.forEach(([lo, la], i) => (i ? m.lineTo(X(lo + shift), Y(la)) : m.moveTo(X(lo + shift), Y(la))));
          if (r.around) {
            m.lineTo(X(r.pts[r.pts.length - 1][0] + shift), Y(r.pole));
            m.lineTo(X(r.pts[0][0] + shift), Y(r.pole));
          }
          m.closePath();
        }
        m.fillStyle = 'rgb(255,0,0)';
        m.fill('evenodd');
        // kustlijn: alleen de echte kust, niet de hulplijnen naar de pool
        m.beginPath();
        for (const r of rings) {
          r.pts.forEach(([lo, la], i) => (i ? m.lineTo(X(lo + shift), Y(la)) : m.moveTo(X(lo + shift), Y(la))));
          if (!r.around) m.closePath();
        }
        m.strokeStyle = 'rgb(0,0,255)';
        m.lineWidth = 1.6;
        m.stroke();
      }
    }
    mask = m.getImageData(0, 0, MW, MH).data;
  }

  function create(opts) {
    opts = opts || {};
    if (!mask) buildMask();
    const canvas = document.createElement('canvas');
    const el = h('div', { class: 'globe' + (opts.interactive ? ' interactive' : '') }, canvas);
    const g = canvas.getContext('2d');
    const buf = document.createElement('canvas');
    const bg = buf.getContext('2d');
    let img = null;
    let lon0 = opts.lon == null ? 10 : opts.lon;
    let lat0 = opts.lat == null ? 25 : opts.lat;
    let zoom = 1;
    let pins = opts.pins || [];
    let size = 0;
    let alive = true;
    let drag = null;
    let last = performance.now();
    let dirty = true;

    function project(lon, lat) {
      const l = (lon - lon0) * RAD;
      const p = lat * RAD;
      const p0 = lat0 * RAD;
      const cp = Math.cos(p);
      return [
        cp * Math.sin(l),
        Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cp * Math.cos(l),
        Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cp * Math.cos(l)
      ];
    }
    // Schermpunt (x naar rechts, y naar boven, in bolstralen) -> breedte en lengte in radialen
    function toSphere(x, y, sp, cp) {
      const z = Math.sqrt(1 - x * x - y * y);
      const Y = y * cp + z * sp;
      const Z = -y * sp + z * cp;
      return [Math.asin(Y), lon0 * RAD + Math.atan2(x, Z), z];
    }
    function unproject(px, py) {
      const R = (size / 2) * 0.94 * zoom;
      const x = (px - size / 2) / R;
      const y = -(py - size / 2) / R;
      if (x * x + y * y > 1) return null;
      const [la, lo] = toSphere(x, y, Math.sin(lat0 * RAD), Math.cos(lat0 * RAD));
      return { lat: la / RAD, lon: ((((lo / RAD + 180) % 360) + 360) % 360) - 180 };
    }

    function draw() {
      const w = el.clientWidth;
      if (!w) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w !== size || canvas.width !== Math.round(w * dpr)) {
        size = w;
        canvas.width = canvas.height = Math.round(w * dpr);
        const N = Math.min(opts.interactive ? 320 : 460, canvas.width);
        buf.width = buf.height = N;
        img = bg.createImageData(N, N);
      }
      const N = buf.width;
      const c = size / 2;
      const R = c * 0.94 * zoom;
      const k = size / N;
      const sp = Math.sin(lat0 * RAD);
      const cp = Math.cos(lat0 * RAD);
      const d = img.data;
      const TWO_PI = Math.PI * 2;
      const lon0r = lon0 * RAD;
      let o = 0;
      for (let j = 0; j < N; j++) {
        const y = -((j + 0.5) * k - c) / R;
        for (let i = 0; i < N; i++, o += 4) {
          const x = ((i + 0.5) * k - c) / R;
          const r2 = x * x + y * y;
          if (r2 > 1) {
            d[o + 3] = 0;
            continue;
          }
          // zelfde berekening als toSphere, maar uitgeschreven voor de snelheid
          const z = Math.sqrt(1 - r2);
          const la = Math.asin(y * cp + z * sp);
          const lo = lon0r + Math.atan2(x, z * cp - y * sp);
          let u = lo / TWO_PI + 0.5;
          u -= Math.floor(u);
          const mi = (Math.min(MH - 1, ((0.5 - la / Math.PI) * MH) | 0) * MW + ((u * MW) | 0)) * 4;
          // licht: donkerder naar de rand, met een zachte glans linksboven
          const dx = x + 0.35;
          const dy = y - 0.4;
          const light = 0.4 + 0.6 * z + Math.max(0, 0.22 - (dx * dx + dy * dy) * 0.3);
          let r;
          let gr;
          let b;
          if (mask[mi + 2] > 110) {
            r = 52; gr = 34; b = 20; // kustlijn
          } else if (mask[mi] > 127) {
            r = 222; gr = 196; b = 146; // land
          } else {
            const grid = mask[mi + 1] > 127 ? 16 : 0;
            r = 34 + grid; gr = 64 + grid; b = 92 + grid; // zee
          }
          d[o] = r * light;
          d[o + 1] = gr * light;
          d[o + 2] = b * light;
          d[o + 3] = 255;
        }
      }
      bg.putImageData(img, 0, 0);

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      g.imageSmoothingEnabled = true;
      g.drawImage(buf, 0, 0, size, size);

      // gloed rond de bol
      g.strokeStyle = 'rgba(255,200,120,0.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(c, c, Math.min(R, c - 1), 0, 7);
      g.stroke();

      // speldjes
      const fontPx = Math.max(11, Math.round(size / 34));
      g.font = `600 ${fontPx}px "Cormorant Garamond", Georgia, serif`;
      g.textBaseline = 'middle';
      for (const p of pins) {
        const [x, y, z] = project(p.lon, p.lat);
        if (z < 0.02) continue;
        const px = c + R * x;
        const py = c - R * y;
        const r = p.cls === 'me' || p.cls === 'win' ? size / 55 + 3 : size / 80 + 2;
        g.beginPath();
        g.arc(px, py, r, 0, 7);
        g.fillStyle = p.cls === 'win' ? '#ffd166' : p.cls === 'me' ? '#f3e3c3' : '#e8836a';
        g.fill();
        g.lineWidth = p.cls === 'me' ? 3 : 2;
        g.strokeStyle = p.cls === 'me' ? '#b3261e' : '#1a0d08';
        g.stroke();
        if (p.label) {
          const tw = g.measureText(p.label).width;
          g.fillStyle = 'rgba(20,10,5,0.85)';
          g.fillRect(px + r + 3, py - fontPx * 0.65, tw + 10, fontPx * 1.3);
          g.fillStyle = p.cls === 'win' ? '#ffd98a' : '#f3e3c3';
          g.fillText(p.label, px + r + 8, py);
        }
      }
    }

    function frame(now) {
      if (!alive) return;
      const dt = Math.min(100, now - last);
      last = now;
      if (opts.autoRotate && !drag) {
        lon0 = (lon0 + dt * (opts.speed || 0.012)) % 360;
        dirty = true;
      }
      if (dirty || el.clientWidth !== size) {
        dirty = false;
        draw();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    if (opts.interactive) {
      canvas.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0, moved: false };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 7) return;
        drag.moved = true;
        const k = 57.3 / ((size / 2) * 0.94 * zoom);
        lon0 = drag.lon - dx * k;
        lat0 = Math.max(-80, Math.min(80, drag.lat + dy * k));
        dirty = true;
      });
      const up = (e) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (d.moved || e.type === 'pointercancel') return;
        const r = canvas.getBoundingClientRect();
        const pos = unproject(e.clientX - r.left, e.clientY - r.top);
        if (pos && isLand(pos.lat, pos.lon)) opts.onPick && opts.onPick(Math.round(pos.lat * 100) / 100, Math.round(pos.lon * 100) / 100);
        else opts.onMiss && opts.onMiss();
      };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      const zoomBtn = (label, f) =>
        h(
          'button',
          {
            class: 'link-btn globe-zoom',
            type: 'button',
            onclick: () => {
              zoom = Math.max(1, Math.min(4, zoom * f));
              dirty = true;
            }
          },
          label
        );
      el.append(h('div', { class: 'globe-buttons' }, zoomBtn('−', 1 / 1.5), zoomBtn('+', 1.5)));
    }

    return {
      el,
      setPins(p) {
        pins = p || [];
        dirty = true;
      },
      destroy() {
        alive = false;
      }
    };
  }

  window.Globe = { create, isLand };
})();
