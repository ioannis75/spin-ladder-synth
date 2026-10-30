/* =====================================================================
   Spin Ladder — song specs (shared by the CLI, the page's lessons and live sets)
   A song is JSON: { title, bpm, seed, set, sections: [ { name, bars, set, ramp, el, en, focus } ] }
   - set:   values applied at the start of the section (knobs and switches, see KNOBS / SWITCHES)
   - ramp:  { key: [target, overBars] } — the knob moves smoothly to target, like the lesson autopilot
   Works in the browser (window.SpinSong) and in Node (require).
   ===================================================================== */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.QSynth;

  // knob ranges: identical to the instrument's knobs, so a ramp sounds the same in the CLI and the page
  const KNOBS = {
    T2s: { min: 0.004, max: 1, log: true, path: ['phys', 'T2s'], unit: 's', doc: 'T2*: how fast each note fades (bell → pluck)' },
    T2: { min: 0.05, max: 4, log: true, path: ['phys', 'T2'], unit: 's', doc: 'T2: true coherence time; limits the echo height' },
    J: { min: 0, max: 300, curve: 2.2, path: ['phys', 'J'], unit: 'Hz', doc: 'J coupling: two lines J apart (slow = pulse, fast = two pitches)' },
    S: { min: 0.25, max: 200, log: true, path: ['phys', 'S'], unit: '×', doc: 'time stretch: audio time = S × physical time' },
    tau: { min: 0.002, max: 0.5, log: true, path: ['phys', 'tau'], unit: 's', doc: 'echo: π pulse at τ, the note returns at 2τ' },
    e: { min: 0, max: 1, path: ['e'], unit: '', doc: 'CNOT strength (1 = Bell state when p = 0)' },
    p: { min: 0, max: 0.5, path: ['p'], unit: '', doc: 'partner temperature (0 cold → entanglement possible, 0.5 hot)' },
    bright: { min: 0, max: 6, path: ['bright'], unit: 'oct', doc: 'lead filter brightness (spin mode)' },
    kKnob: { min: 0, max: 3.9, path: ['kKnob'], unit: '', doc: 'ladder resonance (spin mode)' },
    bassBright: { min: 0, max: 5, path: ['bassBright'], unit: 'oct', doc: 'bass filter brightness (spin mode)' },
    density: { min: 0, max: 1, path: ['density'], unit: '', doc: 'share of lead steps that play (melody "born")' },
    leadOct: { min: 1, max: 4, step: 1, path: ['leadOct'], unit: '', doc: 'lead octave above the key root' },
    duty: { min: 0.125, max: 0.5, path: ['duty'], unit: '', doc: '8-bit pulse width: 0.125 thin, 0.25 nasal, 0.5 square' },
    mkick: { min: 0, max: 1.2, path: ['mix', 'kick'], unit: '', doc: 'kick level' },
    mbass: { min: 0, max: 1.2, path: ['mix', 'bass'], unit: '', doc: 'bass level' },
    mhat: { min: 0, max: 0.5, path: ['mix', 'hat'], unit: '', doc: 'hi-hat level' },
    mlead: { min: 0, max: 1, path: ['mix', 'lead'], unit: '', doc: 'lead level' },
    mchord: { min: 0, max: 1.2, path: ['mix', 'chord'], unit: '', doc: 'power-chord level' },
    msnare: { min: 0, max: 0.8, path: ['mix', 'snare'], unit: '', doc: 'snare level' }
  };
  const SWITCHES = {
    mode: { values: ['spin', 'chip'], doc: 'spin = smooth spin tones through the ladder filter; chip = 8-bit NES-style voices' },
    pattern: { values: Object.keys(E.PATTERNS), doc: 'drum/bass/lead step pattern' },
    song: { values: [false, true], doc: 'true = follow the 8-bar progression E E F G | E E D F (relative to the key)' },
    melody: { values: ['born', 'hook'], doc: 'born = one measurement per note; hook = the Born rule picks a 2-bar phrase' },
    chords: { values: ['off', 'chug', 'ring'], doc: 'power chords: palm-muted 16ths or one ringing chord per bar' },
    snare: { values: [false, true], doc: 'snare on beats 2 and 4' },
    basis: { values: ['Z', 'X', 'Y'], doc: 'measurement basis for the Born rule' },
    echo: { values: [false, true], doc: 'spin echo on/off' },
    echoSync: { values: [0, 1, 2, 3, 4], doc: '2τ locked to n sixteenths (0 = free)' },
    tuning: { values: ['tet', 'studie'], doc: '12-TET at A4 = 435 Hz, or Stockhausen Studie II scale' },
    hold: { values: 'number of 16ths', doc: 'minimum lead note length' },
    key: { values: ['E', 'F', 'F#', 'G', 'A', 'D'], doc: 'key root' }
  };
  const KEY_MIDI = { E: 28, F: 29, 'F#': 30, G: 31, A: 33, D: 26 };

  const getPath = (o, p) => p.reduce((a, k) => a[k], o);
  const setPath = (o, p, v) => { const last = p[p.length - 1]; p.slice(0, -1).reduce((a, k) => a[k], o)[last] = v; };
  const toN = (d, v) => d.log ? Math.log(v / d.min) / Math.log(d.max / d.min) : d.curve ? Math.pow(Math.max(0, (v - d.min) / (d.max - d.min)), 1 / d.curve) : (v - d.min) / (d.max - d.min);
  const fromN = (d, n) => { n = Math.max(0, Math.min(1, n)); let v = d.log ? d.min * Math.pow(d.max / d.min, n) : d.curve ? d.min + (d.max - d.min) * Math.pow(n, d.curve) : d.min + (d.max - d.min) * n; return d.step ? Math.round(v / d.step) * d.step : v; };
  const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

  function applySet(cfg, set) {
    for (const k in set || {}) {
      const v = set[k];
      if (KNOBS[k]) setPath(cfg, KNOBS[k].path, v);
      else if (k === 'echo') cfg.phys.echo = !!v;
      else if (k === 'key') cfg.rootMidi = KEY_MIDI[v] != null ? KEY_MIDI[v] : cfg.rootMidi;
      else if (k === 'T1') cfg.phys.T1 = v;
      else cfg[k] = v;
    }
    cfg.phys.T2s = Math.min(cfg.phys.T2s, cfg.phys.T2);
    cfg.phys.T1 = Math.max(cfg.phys.T1, cfg.phys.T2 / 2);
    if (cfg.echoSync > 0) cfg.phys.echo = true;
  }

  // spec checks an agent can rely on: unknown keys, out-of-range values, wrong types
  function validate(spec) {
    const errs = [], warn = [];
    if (!spec || !Array.isArray(spec.sections) || !spec.sections.length) errs.push('sections: need a non-empty array');
    if (spec.bpm != null && !(spec.bpm >= 60 && spec.bpm <= 220)) errs.push('bpm: must be 60–220');
    const chkSet = (where, set) => {
      for (const k in set || {}) {
        const v = set[k];
        if (KNOBS[k]) { const d = KNOBS[k]; if (typeof v !== 'number' || v < d.min - 1e-9 || v > d.max + 1e-9) errs.push(`${where}.${k}: ${v} outside ${d.min}–${d.max}`); }
        else if (SWITCHES[k]) { const s = SWITCHES[k]; if (Array.isArray(s.values) && !s.values.includes(v)) errs.push(`${where}.${k}: ${JSON.stringify(v)} not one of ${JSON.stringify(s.values)}`); }
        else if (k !== 'T1') errs.push(`${where}.${k}: unknown key`);
      }
    };
    chkSet('set', spec.set);
    (spec.sections || []).forEach((s, i) => {
      const w = `sections[${i}]${s.name ? ' (' + s.name + ')' : ''}`;
      if (!(Number.isInteger(s.bars) && s.bars > 0 && s.bars <= 256)) errs.push(`${w}.bars: integer 1–256`);
      chkSet(w + '.set', s.set);
      for (const k in s.ramp || {}) {
        const r = s.ramp[k];
        if (!KNOBS[k]) errs.push(`${w}.ramp.${k}: only knobs can ramp`);
        else if (!Array.isArray(r) || typeof r[0] !== 'number' || r[0] < KNOBS[k].min - 1e-9 || r[0] > KNOBS[k].max + 1e-9) errs.push(`${w}.ramp.${k}: [target within ${KNOBS[k].min}–${KNOBS[k].max}, bars]`);
      }
    });
    const bars = (spec.sections || []).reduce((a, s) => a + (s.bars || 0), 0);
    if (bars > 400) warn.push(`${bars} bars is long (over 11 minutes at 145 BPM)`);
    return { ok: !errs.length, errors: errs, warnings: warn, bars };
  }

  // a timeline of sections with absolute bar positions
  function layout(spec) { let b = 0; return spec.sections.map(s => { const o = Object.assign({}, s, { start: b }); b += s.bars; return o; }); }

  /* all events of a song; `only` keeps one voice group (drums, bass, chords, lead) for stems */
  function songEvents(spec, opts) {
    opts = opts || {};
    const cfg = E.defaults(); if (spec.bpm) cfg.bpm = spec.bpm; if (spec.seed != null) cfg.seed = spec.seed;
    applySet(cfg, spec.set);
    const secs = layout(spec), st = E.stepSeconds(cfg.bpm), rng = E.mulberry32(cfg.seed), ev = [], marks = [];
    let start = {};
    for (const s of secs) {
      applySet(cfg, s.set);
      start = {}; for (const k in s.ramp || {}) start[k] = toN(KNOBS[k], getPath(cfg, KNOBS[k].path));
      marks.push({ name: s.name || '', t: s.start * 16 * st, bar: s.start });
      for (let j = 0; j < s.bars * 16; j++) {
        const barF = j / 16;
        for (const k in s.ramp || {}) {
          const [to, over] = s.ramp[k], u = Math.max(0, Math.min(1, barF / (over || s.bars)));
          setPath(cfg, KNOBS[k].path, fromN(KNOBS[k], start[k] + (toN(KNOBS[k], to) - start[k]) * ease(u)));
        }
        cfg.phys.T2s = Math.min(cfg.phys.T2s, cfg.phys.T2);
        const step = s.start * 16 + j, prep = E.prepare(cfg.e, cfg.p), pB = E.prepare(0, cfg.p);
        for (const e of E.stepEvents(cfg, prep, step, step * st, rng, null, pB)) if (!opts.only || e.voice === opts.only) ev.push(e);
      }
      for (const k in s.ramp || {}) setPath(cfg, KNOBS[k].path, s.ramp[k][0]);
    }
    const total = secs.reduce((a, s) => a + s.bars, 0) * 16 * st;
    return { events: ev, total, marks, bpm: cfg.bpm };
  }

  /* render: tail = seconds after the end; loop = fold the tail back onto the start (seamless game loop) */
  function render(spec, opts) {
    opts = opts || {};
    const sr = opts.sr || 44100, S = songEvents(spec, opts), tail = opts.loop ? 3 : (opts.tail != null ? opts.tail : 2);
    const [L, R] = E.renderTimeline(S.events, S.total + tail, sr, opts.onProgress);
    if (!opts.loop) return { L, R, sr, marks: S.marks, total: S.total + tail };
    const n = Math.round(S.total * sr), Lo = L.slice(0, n), Ro = R.slice(0, n);
    for (let i = n; i < L.length; i++) { Lo[i - n] += L[i]; Ro[i - n] += R[i]; }
    return { L: Lo, R: Ro, sr, marks: S.marks, total: S.total };
  }

  /* ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks, absolute and relative gates) */
  function biquad(x, b, a) {
    const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0]; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  }
  function kWeight(x, sr) {
    let w = 2 * Math.PI * 1500 / sr, A = Math.pow(10, 4 / 40), al = Math.sin(w) / (2 * Math.SQRT1_2), c = Math.cos(w);
    const sh = biquad(x, [A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al)],
      [(A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al]);
    w = 2 * Math.PI * 38 / sr; al = Math.sin(w) / (2 * 0.5); c = Math.cos(w);
    return biquad(sh, [(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al]);
  }
  function loudness(L, R, sr) {
    const kl = kWeight(L, sr), kr = kWeight(R, sr), B = Math.round(0.4 * sr), H = Math.round(0.1 * sr), z = [];
    for (let s = 0; s + B <= kl.length; s += H) { let a = 0; for (let i = s; i < s + B; i++) a += kl[i] * kl[i] + kr[i] * kr[i]; z.push(a / B); }
    const lk = m => -0.691 + 10 * Math.log10(m);
    const abs = z.filter(m => lk(m) > -70); if (!abs.length) return -Infinity;
    const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const g = abs.filter(m => lk(m) > rel);
    return lk(g.reduce((a, b) => a + b, 0) / g.length);
  }
  function peakDb(L, R) { let p = 0; for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); return 20 * Math.log10(p || 1e-12); }

  /* master: gain to the target loudness, then a soft limiter with its ceiling at −1 dBFS */
  function master(L, R, sr, target) {
    const ceil = Math.pow(10, -1 / 20), thr = 0.8 * ceil;
    const lim = v => { const a = Math.abs(v); return a <= thr ? v : Math.sign(v) * (thr + (ceil - thr) * Math.tanh((a - thr) / (ceil - thr))); };
    let g = Math.pow(10, (target - loudness(L, R, sr)) / 20);
    for (let pass = 0; pass < 2; pass++) {
      const l2 = L.map(v => lim(v * g)), r2 = R.map(v => lim(v * g)), lu = loudness(l2, r2, sr);
      if (pass === 1 || Math.abs(lu - target) < 0.2) return { L: l2, R: r2, lufs: lu, gainDb: 20 * Math.log10(g) };
      g *= Math.pow(10, (target - lu) / 20);
    }
  }

  /* a report an agent can read: loudness, peak, per-section level, contrast between loudest and quietest */
  function report(L, R, sr, marks, total) {
    const secs = marks.map((m, i) => {
      const a = Math.round(m.t * sr), b = Math.round((i + 1 < marks.length ? marks[i + 1].t : total) * sr);
      let s = 0; for (let j = a; j < b && j < L.length; j++) s += L[j] * L[j] + R[j] * R[j];
      return { name: m.name, startBar: m.bar, rmsDb: +(10 * Math.log10(s / Math.max(1, 2 * (b - a)) + 1e-12)).toFixed(1) };
    });
    const r = secs.map(s => s.rmsDb).filter(Number.isFinite);
    return { seconds: +(L.length / sr).toFixed(2), lufs: +loudness(L, R, sr).toFixed(1), peakDbfs: +peakDb(L, R).toFixed(1), sections: secs, dynamicRangeDb: +(Math.max(...r) - Math.min(...r)).toFixed(1) };
  }

  function wav24(L, R, sr) {
    const n = L.length, buf = new ArrayBuffer(44 + n * 6), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 6, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 6, true); v.setUint16(32, 6, true); v.setUint16(34, 24, true); w(36, 'data'); v.setUint32(40, n * 6, true);
    for (let i = 0, o = 44; i < n; i++) for (const x of [L[i], R[i]]) {
      const s = Math.round(Math.max(-1, Math.min(1, x)) * 8388607);
      v.setUint8(o++, s & 255); v.setUint8(o++, (s >> 8) & 255); v.setUint8(o++, (s >> 16) & 255);
    }
    return buf;
  }

  const api = { KNOBS, SWITCHES, KEY_MIDI, applySet, validate, layout, songEvents, render, loudness, peakDb, master, report, wav24, toN, fromN, ease };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SpinSong = api;
})(typeof self !== 'undefined' ? self : this);
