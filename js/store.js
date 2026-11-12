// Datalaag: één API, twee achterkanten.
//  - Firebase Realtime Database (als FIREBASE_CONFIG is ingevuld)
//  - Demo-modus via localStorage (alleen tabbladen in dezelfde browser)
//
// API: Store.ready (Promise), Store.mode, Store.get(pad), Store.set(pad, waarde),
//      Store.update(pad, {subpad: waarde}), Store.remove(pad),
//      Store.on(pad, callback) -> stopfunctie, Store.now() (servertijd in ms)
(function () {
  const cfg = window.FIREBASE_CONFIG;
  const Store = { mode: cfg ? 'firebase' : 'demo' };
  window.Store = Store;

  // Firebase weigert `undefined`; dit haalt die eruit.
  const clean = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

  if (cfg) {
    const V = '10.14.1';
    const base = `https://www.gstatic.com/firebasejs/${V}/`;
    const load = (src) =>
      new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error('Kon Firebase niet laden. Controleer je internetverbinding.'));
        document.head.appendChild(s);
      });
    let db;
    let offset = 0;
    Store.ready = load(base + 'firebase-app-compat.js')
      .then(() => load(base + 'firebase-database-compat.js'))
      .then(() => {
        firebase.initializeApp(cfg);
        db = firebase.database();
        if (cfg.emulator) db.useEmulator(cfg.emulator.host, cfg.emulator.port);
        db.ref('.info/serverTimeOffset').on('value', (s) => (offset = s.val() || 0));
      });
    Store.get = (p) => db.ref(p).get().then((s) => s.val());
    Store.set = (p, v) => db.ref(p).set(clean(v));
    Store.update = (p, v) => db.ref(p).update(clean(v));
    Store.remove = (p) => db.ref(p).remove();
    Store.on = (p, cb) => {
      const r = db.ref(p);
      const h = r.on('value', (s) => cb(s.val()));
      return () => r.off('value', h);
    };
    Store.now = () => Date.now() + offset;
    return;
  }

  // ---------------- Demo-modus ----------------
  const KEY = 'quiz-demo-db';
  const listeners = [];
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  const parts = (p) => p.split('/').filter(Boolean);
  const getAt = (tree, p) => {
    let n = tree;
    for (const k of parts(p)) {
      if (n == null || typeof n !== 'object') return null;
      n = n[k];
    }
    if (n === undefined) return null;
    if (n && typeof n === 'object' && !Object.keys(n).length) return null;
    return n;
  };
  const setAt = (tree, p, v) => {
    const ks = parts(p);
    const last = ks.pop();
    let n = tree;
    for (const k of ks) {
      if (n[k] == null || typeof n[k] !== 'object') n[k] = {};
      n = n[k];
    }
    if (v === null) delete n[last];
    else n[last] = v;
  };
  const notify = () => {
    const tree = read();
    for (const l of listeners.slice()) {
      const v = getAt(tree, l.path);
      const j = JSON.stringify(v);
      if (j !== l.last) {
        l.last = j;
        l.cb(v);
      }
    }
  };
  const write = (fn) => {
    const tree = read();
    fn(tree);
    localStorage.setItem(KEY, JSON.stringify(tree));
    setTimeout(notify, 0);
    return Promise.resolve();
  };
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) notify();
  });

  Store.ready = Promise.resolve();
  Store.get = (p) => Promise.resolve(getAt(read(), p));
  Store.set = (p, v) => write((t) => setAt(t, p, clean(v)));
  Store.update = (p, obj) =>
    write((t) => {
      for (const k of Object.keys(obj)) setAt(t, p + '/' + k, clean(obj[k]));
    });
  Store.remove = (p) => Store.set(p, null);
  Store.on = (p, cb) => {
    const l = { path: p, cb, last: undefined };
    listeners.push(l);
    setTimeout(() => {
      if (!listeners.includes(l) || l.last !== undefined) return;
      const v = getAt(read(), p);
      l.last = JSON.stringify(v);
      cb(v);
    }, 0);
    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  };
  Store.now = () => Date.now();
})();
