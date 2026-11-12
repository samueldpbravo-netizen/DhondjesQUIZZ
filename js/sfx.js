// Geluidseffecten, volledig in de browser gemaakt (geen geluidsbestanden nodig).
// De browser laat pas geluid toe na een eerste klik of tik.
(function () {
  let ctx = null;
  let master = null;
  let fire = null;
  let muted = false;
  try {
    muted = localStorage.getItem('quiz-muted') === '1';
  } catch (e) {}

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const unlock = () => ac();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Eén toon. type: sine/triangle/square/sawtooth
  function tone(freq, at, dur, vol, type, slideTo) {
    const c = ac();
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + (at || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noiseBuffer(seconds, brown) {
    const c = ac();
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  // Kort ruisje (houten tik, veeg, knetter)
  function noise(at, dur, vol, freq, q, type) {
    const c = ac();
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + (at || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(Math.max(0.05, dur));
    const f = c.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq || 1200;
    f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Klokje/harp: toon met boventoon
  function bell(freq, at, dur, vol) {
    tone(freq, at, dur, vol || 0.18, 'sine');
    tone(freq * 2, at, dur * 0.6, (vol || 0.18) * 0.35, 'sine');
    tone(freq * 3.01, at, dur * 0.3, (vol || 0.18) * 0.15, 'sine');
  }

  const N = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5 };

  const SFX = {
    // Een naam verschijnt in de lobby
    pop() {
      tone(520 + Math.random() * 260, 0, 0.16, 0.16, 'triangle', 900 + Math.random() * 300);
      noise(0, 0.05, 0.08, 2400, 2);
    },
    // Houten klik (knoppen)
    click() {
      noise(0, 0.06, 0.25, 900, 3);
      tone(180, 0, 0.07, 0.12, 'sine', 90);
    },
    // Een antwoord komt binnen op het grote scherm
    blip() {
      bell(N.E5 + Math.random() * 200, 0, 0.25, 0.06);
    },
    // Nieuwe vraag: veeg + drie tonen omhoog
    question() {
      noise(0, 0.5, 0.12, 600, 0.7);
      [N.G4, N.C5, N.E5].forEach((f, i) => bell(f, 0.1 + i * 0.12, 0.7, 0.14));
      tone(98, 0.1, 0.9, 0.2, 'sine');
    },
    // Start van de timer
    go() {
      bell(N.C5, 0, 0.5, 0.16);
      bell(N.G5, 0.08, 0.6, 0.12);
    },
    // Laatste seconden
    tick(urgent) {
      noise(0, 0.04, urgent ? 0.3 : 0.16, urgent ? 2000 : 1400, 6);
      if (urgent) tone(70, 0, 0.14, 0.25, 'sine', 50);
    },
    // Tijd om
    timeup() {
      tone(196, 0, 0.5, 0.22, 'triangle', 110);
      tone(147, 0.05, 0.6, 0.2, 'sine', 90);
    },
    // Antwoord verstuurd (gsm)
    send() {
      tone(440, 0, 0.1, 0.14, 'triangle', 700);
      tone(700, 0.08, 0.14, 0.12, 'triangle', 1000);
    },
    // Onthulling: tromgeroffel-achtige opbouw + akkoord
    reveal() {
      for (let i = 0; i < 14; i++) noise(i * 0.045, 0.05, 0.05 + i * 0.012, 300 + i * 30, 2);
      [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5].forEach((f, i) => bell(f, 0.62 + i * 0.045, 1.4, 0.12));
      tone(65.4, 0.62, 1.4, 0.25, 'sine');
    },
    good() {
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => bell(f, i * 0.09, 0.6, 0.15));
    },
    almost() {
      [N.E4, N.G4, N.B4].forEach((f, i) => bell(f, i * 0.1, 0.5, 0.13));
    },
    bad() {
      tone(220, 0, 0.3, 0.16, 'sawtooth', 150);
      tone(165, 0.18, 0.45, 0.16, 'sawtooth', 100);
    },
    // Ranglijst
    board() {
      [N.G4, N.B4, N.D5, N.G5].forEach((f, i) => bell(f, i * 0.07, 0.9, 0.12));
    },
    // Plaats op het podium
    drum() {
      tone(110, 0, 0.35, 0.4, 'sine', 45);
      noise(0, 0.2, 0.2, 200, 0.8, 'lowpass');
    },
    // Eindfanfare
    fanfare() {
      const seq = [N.C4, N.C4, N.C4, N.E4, N.G4, N.E4, N.G4, N.C5];
      const times = [0, 0.16, 0.32, 0.48, 0.72, 0.96, 1.12, 1.36];
      seq.forEach((f, i) => {
        tone(f, times[i], i === 7 ? 1.6 : 0.22, 0.13, 'sawtooth');
        tone(f * 2, times[i], i === 7 ? 1.6 : 0.22, 0.07, 'triangle');
        tone(f * 1.5, times[i], i === 7 ? 1.6 : 0.22, 0.05, 'triangle');
      });
      tone(65.4, 1.36, 1.8, 0.3, 'sine');
    },

    // Knetterend haardvuur als achtergrond
    fireOn() {
      const c = ac();
      if (!c || fire) return;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(4, true);
      src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const g = c.createGain();
      g.gain.value = 0.22;
      src.connect(lp).connect(g).connect(master);
      src.start();
      const crackle = () => {
        if (!fire) return;
        if (c.state === 'running') {
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) noise(Math.random() * 0.25, 0.02 + Math.random() * 0.03, 0.05 + Math.random() * 0.12, 1500 + Math.random() * 3500, 4);
        }
        fire.timer = setTimeout(crackle, 120 + Math.random() * 700);
      };
      fire = { src, timer: null };
      crackle();
    },
    fireOff() {
      if (!fire) return;
      clearTimeout(fire.timer);
      try {
        fire.src.stop();
      } catch (e) {}
      fire = null;
    },

    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      try {
        localStorage.setItem('quiz-muted', m ? '1' : '0');
      } catch (e) {}
      if (master) master.gain.value = m ? 0 : 0.9;
    },
    unlock
  };
  window.SFX = SFX;
})();
