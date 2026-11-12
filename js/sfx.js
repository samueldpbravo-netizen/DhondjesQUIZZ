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


  // ---------- Muziek ----------
  // Een klein jazzcombo dat zichzelf speelt: lopende bas, bekkens, piano-akkoorden
  // en af en toe een melodietje. Alles wordt per achtste noot ingepland.
  let music = null;
  let bus = null;
  const QUAL = { m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], M7: [0, 4, 7, 11], m: [0, 3, 7, 12] };
  const MODES = {
    lounge: { bpm: 88, swing: true, vol: 1, prog: [[38, 'm7'], [43, '7'], [36, 'M7'], [33, '7']] },
    tense: { bpm: 118, swing: false, vol: 0.9, prog: [[38, 'm'], [38, 'm'], [34, 'M7'], [33, '7']] }
  };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function stopMusic() {
    if (!music) return;
    clearInterval(music.timer);
    music = null;
  }

  function mTone(freq, at, dur, vol, type) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
  let hatBuf = null;
  function mHat(at, dur, vol, freq) {
    if (!hatBuf) hatBuf = noiseBuffer(0.4);
    const src = ctx.createBufferSource();
    src.buffer = hatBuf;
    const f = ctx.createBiquadFilter();
    f.type = freq ? 'bandpass' : 'highpass';
    f.frequency.value = freq || 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  function schedule() {
    if (!music || !ctx) return;
    if (ctx.state !== 'running') {
      music.next = 0;
      return;
    }
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = 0.55;
      bus.connect(master);
    }
    const M = MODES[music.mode];
    const beat = 60 / M.bpm;
    if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.08;
    while (music.next < ctx.currentTime + 0.3) {
      playStep(M, music.step, music.next, beat);
      const even = music.step % 2 === 0;
      music.next += M.swing ? beat * (even ? 0.64 : 0.36) : beat / 2;
      music.step++;
    }
  }

  function playStep(M, step, at, beat) {
    const bar = Math.floor(step / 8) % M.prog.length;
    const pos = step % 8;
    const [root, q] = M.prog[bar];
    const iv = QUAL[q];
    const nextRoot = M.prog[(bar + 1) % M.prog.length][0];
    const v = M.vol;
    if (M.swing) {
      // lopende bas op elke tel
      if (pos % 2 === 0) {
        const walk = [root, root + iv[1], root + iv[2], nextRoot + (Math.random() < 0.5 ? 1 : -1)];
        mTone(hz(walk[pos / 2]), at, beat * 0.95, 0.2 * v, 'triangle');
      }
      // bekken: ding, ding-a-ding
      if ([0, 2, 3, 4, 6, 7].includes(pos)) mHat(at, 0.09, pos % 2 ? 0.02 : 0.035);
      // piano-akkoord
      if ((pos === 0 || pos === 3) && Math.random() < 0.8) {
        iv.forEach((n, i) => mTone(hz(root + 24 + n), at + i * 0.012, beat * 1.3, 0.035 * v, 'sine'));
      }
      // melodie
      if (Math.random() < 0.28) {
        const pool = [...iv, 14, 12 + iv[1]];
        const n = root + 36 + pool[Math.floor(Math.random() * pool.length)];
        mTone(hz(n), at, beat * 0.9, 0.05 * v, 'sine');
        mTone(hz(n) * 2, at, beat * 0.3, 0.012 * v, 'sine');
      }
    } else {
      // stuwende bas op elke achtste
      mTone(hz(root + (pos % 2 ? 12 : 0)), at, beat * 0.42, 0.17 * v, 'triangle');
      mHat(at, 0.05, pos % 2 ? 0.018 : 0.03);
      if (pos === 2 || pos === 6) mHat(at, 0.12, 0.05, 1800);
      if (pos === 0 || pos === 5) iv.slice(0, 3).forEach((n) => mTone(hz(root + 24 + n), at, beat * 0.5, 0.03 * v, 'sine'));
      if (Math.random() < 0.14) mTone(hz(root + 36 + iv[Math.floor(Math.random() * 3)]), at, beat * 0.6, 0.04 * v, 'sine');
    }
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

    // Zacht geknetter van het haardvuur (alleen de vonkjes, geen ruis)
    fireOn() {
      const c = ac();
      if (!c || fire) return;
      const crackle = () => {
        if (!fire) return;
        if (c.state === 'running' && Math.random() < 0.6) {
          noise(Math.random() * 0.2, 0.02 + Math.random() * 0.03, 0.03 + Math.random() * 0.05, 1500 + Math.random() * 3500, 4);
        }
        fire.timer = setTimeout(crackle, 250 + Math.random() * 1100);
      };
      fire = { timer: null };
      crackle();
    },
    fireOff() {
      if (!fire) return;
      clearTimeout(fire.timer);
      fire = null;
    },

    // Achtergrondmuziek: 'lounge' = rustige jazz, 'tense' = spannender tijdens vragen
    music(mode) {
      if (!mode) return stopMusic();
      if (music && music.mode === mode) return;
      stopMusic();
      const c = ac();
      if (!c) return;
      music = { mode, step: 0, next: 0, timer: setInterval(schedule, 70) };
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
