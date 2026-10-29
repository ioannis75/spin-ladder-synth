/* =====================================================================
   Spin Ladder Synth — μηχανή φυσικής και σύνθεσης (καθαρή JavaScript)
   Βασίζεται στο μοντέλο NMR δύο σπιν του Quantum Music Studio
   (Panagiota Brousali, ΣΕΜΦΕ/ΕΜΠ), με τις ίδιες συμβάσεις:
   A4 = 435 Hz, s = Tr[ρ σ⁻] ανά qubit, y = G·Re[s·e^{i2πf_c u}].
   Δεν εξαρτάται από DOM ή Web Audio· τρέχει σε φυλλομετρητή και σε Node.
   ===================================================================== */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;

  /* ---------- μιγαδικοί 4×4 πίνακες: {re: Float64Array(16), im: ...} ---------- */
  function cm(re, im) { return { re: Float64Array.from(re || new Array(16).fill(0)), im: Float64Array.from(im || new Array(16).fill(0)) }; }
  function cmul(A, B) {
    const C = cm();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let r = 0, m = 0;
      for (let k = 0; k < 4; k++) {
        const ar = A.re[4 * i + k], ai = A.im[4 * i + k], br = B.re[4 * k + j], bi = B.im[4 * k + j];
        r += ar * br - ai * bi; m += ar * bi + ai * br;
      }
      C.re[4 * i + j] = r; C.im[4 * i + j] = m;
    }
    return C;
  }
  function cadj(A) { const C = cm(); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { C.re[4 * i + j] = A.re[4 * j + i]; C.im[4 * i + j] = -A.im[4 * j + i]; } return C; }
  function cconj(A) { const C = cm(A.re, A.im); for (let i = 0; i < 16; i++) C.im[i] = -C.im[i]; return C; }
  function kron2(a, b) { // a, b: 2×2 {re:[4], im:[4]}
    const C = cm();
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) {
      const ar = a.re[2 * i + j], ai = a.im[2 * i + j], br = b.re[2 * k + l], bi = b.im[2 * k + l];
      const r = 2 * i + k, c = 2 * j + l;
      C.re[4 * r + c] = ar * br - ai * bi; C.im[4 * r + c] = ar * bi + ai * br;
    }
    return C;
  }
  const m2 = (re, im) => ({ re: re, im: im || [0, 0, 0, 0] });

  /* ---------- προετοιμασία κατάστασης ----------
     ρ(0) = U (|+⟩⟨+| ⊗ diag(1−p, p)) U†,  U = ελεγχόμενη R_y(πe) από q0 σε q1.
     Δείκτης βάσης i = 2·b0 + b1 (q0 το σημαντικότερο ψηφίο).
     e: «εμπλοκή» 0…1 · p: ανάμειξη (θερμοκρασία) του συντρόφου 0…0,5 */
  function prepare(e, p) {
    const plus = m2([0.5, 0.5, 0.5, 0.5]);
    const partner = m2([1 - p, 0, 0, p]);
    const rho0 = kron2(plus, partner);
    const th = Math.PI * e, c = Math.cos(th / 2), s = Math.sin(th / 2);
    const U = cm([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, c, -s, 0, 0, s, c]);
    const rho = cmul(cmul(U, rho0), cadj(U));
    return describe(rho);
  }
  function describe(rho) {
    // συνοχές μονού κβάντου κάθε σπιν, χωρισμένες ανά κατάσταση του γείτονα (γραμμές J)
    const coh0 = [0, 1].map(b => ({ re: rho.re[4 * b + 2 + b], im: rho.im[4 * b + 2 + b] }));       // ρ[(0b),(1b)]
    const coh1 = [0, 1].map(a => ({ re: rho.re[4 * (2 * a) + 2 * a + 1], im: rho.im[4 * (2 * a) + 2 * a + 1] })); // ρ[(a0),(a1)]
    const pop1q0 = rho.re[10] + rho.re[15], pop1q1 = rho.re[5] + rho.re[15];
    return { rho, coh: [coh0, coh1], pop1: [pop1q0, pop1q1], C: concurrence(rho), purity: purity(rho) };
  }
  function purity(rho) { const r2 = cmul(rho, rho); let t = 0; for (let i = 0; i < 4; i++) t += r2.re[5 * i]; return t; }

  /* ---------- concurrence (Wootters 1998) ----------
     ρ̃ = (σy⊗σy) ρ* (σy⊗σy), λ_i = √(ιδιοτιμές του ρρ̃) φθίνουσες,
     C = max(0, λ1 − λ2 − λ3 − λ4). Ιδιοτιμές: Faddeev–LeVerrier + Durand–Kerner. */
  function concurrence(rho) {
    const yy = cm([0, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0]);
    const rt = cmul(cmul(yy, cconj(rho)), yy);
    const { w, V } = jacobiHerm(rho);
    const D = cm(); for (let i = 0; i < 4; i++) D.re[5 * i] = Math.sqrt(Math.max(0, w[i]));
    const sq = cmul(cmul(V, D), cadj(V));                    // √ρ
    const H = cmul(cmul(sq, rt), sq);                        // √ρ ρ̃ √ρ (ερμιτιανός, θετικός)
    const ev = jacobiHerm(H).w.map(x => Math.sqrt(Math.max(0, x))).sort((a, b) => b - a);
    return Math.max(0, ev[0] - ev[1] - ev[2] - ev[3]);
  }
  /* ιδιοτιμές/ιδιοδιανύσματα ερμιτιανού 4×4 με μιγαδικές περιστροφές Jacobi */
  function jacobiHerm(A0) {
    let A = cm(A0.re, A0.im); let V = cm(); for (let i = 0; i < 4; i++) V.re[5 * i] = 1;
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += Math.hypot(A.re[4 * p + q], A.im[4 * p + q]);
      if (off < 1e-15) break;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
        const ar = A.re[4 * p + q], ai = A.im[4 * p + q], r = Math.hypot(ar, ai);
        if (r < 1e-18) continue;
        const ph = Math.atan2(ai, ar), app = A.re[5 * p], aqq = A.re[5 * q];
        const z = (aqq - app) / (2 * r), t = (z >= 0 ? 1 : -1) / (Math.abs(z) + Math.sqrt(1 + z * z));
        const c = 1 / Math.sqrt(1 + t * t), s = t * c;
        const J = cm(); for (let i = 0; i < 4; i++) J.re[5 * i] = 1;
        J.re[5 * p] = c; J.re[4 * p + q] = s;
        J.re[4 * q + p] = -s * Math.cos(ph); J.im[4 * q + p] = s * Math.sin(ph);
        J.re[5 * q] = c * Math.cos(ph); J.im[5 * q] = -c * Math.sin(ph);
        A = cmul(cmul(cadj(J), A), J); V = cmul(V, J);
      }
    }
    return { w: [0, 1, 2, 3].map(i => A.re[5 * i]), V };
  }

  /* ---------- πιθανότητες Born σε βάση ανάγνωσης ---------- */
  const s2 = Math.SQRT1_2;
  const ROT = {
    Z: m2([1, 0, 0, 1]),
    X: m2([s2, s2, s2, -s2]),                          // H
    Y: m2([s2, 0, s2, 0], [0, -s2, 0, s2])             // H·S†
  };
  function probs(rho, basis) {
    const V = kron2(ROT[basis] || ROT.Z, ROT[basis] || ROT.Z);
    const r = cmul(cmul(V, rho), cadj(V));
    const p = [0, 1, 2, 3].map(i => Math.max(0, r.re[5 * i]));
    const s = p.reduce((a, b) => a + b, 0) || 1;
    return p.map(x => x / s); // σειρά: 00, 01, 10, 11
  }

  /* ---------- παράμετροι: φυσικές μονάδες + χρονική διαστολή S ----------
     ακουστικός χρόνος = S · φυσικός χρόνος ·  ακουστική συχνότητα = φυσική / S */
  function toAudio(ph) {
    const S = ph.S;
    let T2 = ph.T2, T2s = Math.min(ph.T2s, ph.T2), T1 = Math.max(ph.T1, ph.T2 / 2);
    return { J: ph.J / S, nu: [ph.nu0 / S, ph.nu1 / S], T2: T2 * S, T2s: T2s * S, T1: T1 * S, tau: ph.tau * S, echo: !!ph.echo };
  }

  /* ---------- τοπικό σήμα FID του σπιν q (ακουστικός χρόνος t) ----------
     s_q(t) = 2 Σ_b c_b · e^{i2π f_b t_eff} · e^{−t/T2} · e^{−|t_eff|(1/T2* − 1/T2)}
     f_b = ν_q + J(½ − b).  Με echo (επιλεκτικός π στο σπιν q τη στιγμή τ):
     για t > τ: c_b → c_b*, t_eff = t − 2τ  (επανεστίαση ν, J και στατικών offsets). */
  function signalAt(prep, A, q, t) {
    const coh = prep.coh[q];
    const after = A.echo && t > A.tau;
    const teff = after ? t - 2 * A.tau : t;
    const inh = Math.max(0, 1 / A.T2s - 1 / A.T2);
    const dec = Math.exp(-t / A.T2) * Math.exp(-Math.abs(teff) * inh);
    let re = 0, im = 0;
    for (let b = 0; b < 2; b++) {
      const f = A.nu[q] + A.J * (0.5 - b);
      const cr = coh[b].re, ci = after ? -coh[b].im : coh[b].im;
      const ph = TAU * f * teff, co = Math.cos(ph), si = Math.sin(ph);
      re += 2 * (cr * co - ci * si); im += 2 * (cr * si + ci * co);
    }
    return { re: re * dec, im: im * dec };
  }
  /* πληθυσμός |1⟩ του σπιν q: T1 προς ισορροπία p_eq = 0· ο π παλμός τον αντιστρέφει */
  function populationAt(prep, A, q, t) {
    const p0 = prep.pop1[q];
    if (!(A.echo && t > A.tau) || q !== 0) return p0 * Math.exp(-t / A.T1);
    const pTau = 1 - p0 * Math.exp(-A.tau / A.T1);
    return pTau * Math.exp(-(t - A.tau) / A.T1);
  }

  /* ---------- φίλτρο σκάλας 4 πόλων, μηδενικής καθυστέρησης ανάδρασης ----------
     Αναλογικό πρότυπο: H(s) = 1 / [(1 + s/ω_c)^4 + k].
     Ψηφιακά: 4 βαθμίδες TPT (Zavalishin), g = tan(π f_c / f_s), λύση της ανάδρασης σε κλειστή μορφή.
     sat = true: κορεσμός tanh στην είσοδο (μη γραμμικός «αναλογικός» χαρακτήρας). */
  function Ladder(fs) { this.fs = fs; this.s = [0, 0, 0, 0]; }
  Ladder.prototype.process = function (x, fc, k, sat) {
    const g = Math.tan(Math.PI * Math.min(fc, 0.45 * this.fs) / this.fs);
    const G = g / (1 + g), B = 1 / (1 + g), s = this.s;
    const Sig = G * G * G * B * s[0] + G * G * B * s[1] + G * B * s[2] + B * s[3];
    const G4 = G * G * G * G;
    const y4est = (G4 * x + Sig) / (1 + k * G4);
    let u = x - k * y4est;
    if (sat) u = Math.tanh(u);
    let inp = u;
    for (let i = 0; i < 4; i++) {
      const v = (inp - s[i]) * G, y = v + s[i];
      s[i] = y + v; inp = y;
    }
    return inp;
  };

  /* ---------- ψευδοτυχαία γεννήτρια (κλασική, με seed — όπως στο Studio) ---------- */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- κουρδίσματα ---------- */
  const A4 = 435;
  const midiHz = (m) => A4 * Math.pow(2, (m - 69) / 12);
  const studieHz = (n) => 100 * Math.pow(5, n / 25);       // κλίμακα Studie II: 81 βήματα, λόγος 5^(1/25)
  const STUDIE_CENTS = 1200 * Math.log2(5) / 25;

  /* ---------- φωνή σπιν: FID → φέρον → φίλτρο σκάλας ----------
     opt: {freq, dur, prep, A, q, bright (οκτάβες), kKnob, gain, sat, exciter}
     cutoff f_c(t) = freq · 2^{bright·|s(t)|} · resonance k = kKnob(1−C) + 4,3·C (δηλωμένη αντιστοίχιση) */
  function renderSpinVoice(o, fs) {
    const n = Math.max(1, Math.round(o.dur * fs));
    const out = new Float32Array(n), lad = new Ladder(fs);
    const k = o.kKnob * (1 - o.prep.C) + 4.3 * o.prep.C;
    const att = 0.005, rel = Math.min(0.02, o.dur / 3);
    for (let i = 0; i < n; i++) {
      const t = i / fs;
      const s = signalAt(o.prep, o.A, o.q || 0, t);
      const r = Math.min(1, Math.hypot(s.re, s.im));
      const ph = TAU * o.freq * t;
      let x = s.re * Math.cos(ph) - s.im * Math.sin(ph);          // Re[s · e^{i2πf t}]
      if (o.exciter && i < 24) x += o.exciter * (1 - i / 24);     // σύντομο κλασικό «χτύπημα» του φίλτρου
      const fc = o.freq * Math.pow(2, o.bright * r);
      let y = o.filter === false ? x : lad.process(x * (o.drive || 1), fc, k, o.sat !== false);
      const env = Math.min(1, t / att, (o.dur - t) / rel);
      out[i] = y * env * o.gain;
    }
    return out;
  }
  /* φωνή πληθυσμού (T1): ημιτονικό drone με πλάτος p(1)(t) — ανάλογο του «Excitation decay» */
  function renderPopVoice(o, fs) {
    const n = Math.round(o.dur * fs), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / fs, p = populationAt(o.prep, o.A, 0, t);
      const env = Math.min(1, t / 0.05, (o.dur - t) / 0.2);
      out[i] = o.gain * p * Math.sin(TAU * o.freq * t) * env;
    }
    return out;
  }
  /* μίγμα ημιτόνων (Studie II): μερικές συχνότητες της κλίμακας, βάρη από πιθανότητες Born,
     περιβάλλουσα = |s(t)| του σπιν (η φυσική ορίζει το σβήσιμο) */
  function renderMixture(o, fs) {
    const n = Math.round(o.dur * fs), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / fs; const s = signalAt(o.prep, o.A, 0, t);
      const r = Math.hypot(s.re, s.im);
      let y = 0; for (let k = 0; k < o.freqs.length; k++) y += o.weights[k] * Math.sin(TAU * o.freqs[k] * t + k);
      const env = Math.min(1, t / 0.01, (o.dur - t) / 0.05);
      out[i] = o.gain * r * y * env;
    }
    return out;
  }
  /* κλασικά κρουστά (δεν είναι κβαντικά — δηλώνεται στη σελίδα) */
  function renderKick(o, fs) {
    const dur = 0.32, n = Math.round(dur * fs), out = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / fs, f = 46 + 120 * Math.exp(-t / 0.032); ph += TAU * f / fs;
      const a = Math.exp(-t / 0.22) * Math.min(1, t / 0.0015);
      out[i] = o.gain * Math.tanh(1.6 * Math.sin(ph)) * a * Math.min(1, (dur - t) / 0.02);
    }
    return out;
  }
  function renderHat(o, fs) {
    const dur = 0.06, n = Math.round(dur * fs), out = new Float32Array(n), rnd = mulberry32(o.seed || 7); let prev = 0;
    for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1, hp = w - prev; prev = w; out[i] = o.gain * hp * Math.exp(-(i / fs) / 0.014); }
    return out;
  }
  /* εισαγωγή εξαγωγής FID του Quantum Music Studio (μορφή pundora-fid-v3) */
  function parseStudioFID(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (!d || !/^pundora-fid/.test(d.format || '') || !Array.isArray(d.timeMs)) throw new Error('not-fid');
    return { tMs: d.timeMs, q: [[d.q0Re, d.q0Im], [d.q1Re, d.q1Im]], windowMs: d.physicalWindowMs || d.timeMs[d.timeMs.length - 1], source: d.source || '', carrierHz: d.carrierHz || [] };
  }
  function fidAt(F, q, tMs) {
    const T = F.tMs, n = T.length; if (tMs <= T[0]) return { re: F.q[q][0][0], im: F.q[q][1][0] };
    if (tMs >= T[n - 1]) return { re: 0, im: 0 };
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= tMs) lo = m; else hi = m; }
    const w = (tMs - T[lo]) / (T[hi] - T[lo]);
    return { re: F.q[q][0][lo] * (1 - w) + F.q[q][0][hi] * w, im: F.q[q][1][lo] * (1 - w) + F.q[q][1][hi] * w };
  }
  /* φωνή από αρχείο: u ακουστικός χρόνος, φυσικός t = u·W/D (εξ. 4.61–4.62 της εργασίας) */
  function renderFidVoice(o, fs) {
    const n = Math.round(o.dur * fs), out = new Float32Array(n), lad = new Ladder(fs);
    const stretch = o.F.windowMs / (o.dur * 1000);
    for (let i = 0; i < n; i++) {
      const u = i / fs, s = fidAt(o.F, o.q || 0, u * 1000 * stretch);
      const r = Math.min(1, Math.hypot(s.re, s.im)), ph = TAU * o.freq * u;
      const x = s.re * Math.cos(ph) - s.im * Math.sin(ph);
      const y = lad.process(x, o.freq * Math.pow(2, o.bright * r), o.kKnob, true);
      out[i] = o.gain * y * Math.min(1, u / 0.005, (o.dur - u) / 0.02);
    }
    return out;
  }

  /* ---------- αλληλουχητής psytrance ----------
     Μπάσο: ίδια φυσική χαλάρωσης, αλλά πάντα χωρίς πύλη σύνδεσης (e = 0), ώστε να μη σβήνει. */
  const OUTCOME_SEMIS = [0, 6, -6, 12];   // 00 → θεμέλιο, 01/10 → τρίτονο (διαφωνία), 11 → οκτάβα (συμφωνία)
  const PATTERNS = {
    rolling: { kick: '1000100010001000', bass: '0111011101110111', hat: '0010001000100010', lead: '1011101011011010' },
    gallop:  { kick: '1000100010001000', bass: '0110011001100110', hat: '0010001000100010', lead: '1010101010101011' },
    half:    { kick: '1000000010000000', bass: '0111011101110111', hat: '0010001000100010', lead: '1000100110001010' },
    none:    { kick: '0000000000000000', bass: '0000000000000000', hat: '0000000000000000', lead: '1010101010101010' },
    riser:   { kick: '0000000000000000', bass: '0000000000000000', hat: '1111111111111111', lead: '1000000010000000' }
  };
  function defaults() {
    return {
      phys: { J: 4, nu0: 0, nu1: 0, T2: 0.4, T2s: 0.05, T1: 1.2, tau: 0.05, echo: false, S: 1 },
      e: 0, p: 0.25, basis: 'Z',
      bpm: 145, rootMidi: 28 /* E1 στο A4=435 */, pattern: 'rolling', density: 0.8, seed: 271828,
      leadOct: 3, bright: 3.5, kKnob: 2.6, bassBright: 2.2,
      mix: { kick: 0.9, bass: 0.6, hat: 0.14, lead: 0.32 }, tuning: 'tet', echoSync: 0
    };
  }
  function stepSeconds(bpm) { return 60 / bpm / 4; }
  /* εφαρμογή «echo sync»: 2τ (ακουστικό) = n δέκατα έκτα */
  function syncedPhys(cfg) {
    const ph = Object.assign({}, cfg.phys);
    if (cfg.echoSync > 0) { ph.echo = true; ph.tau = cfg.echoSync * stepSeconds(cfg.bpm) / 2 / ph.S; }
    return ph;
  }
  function leadFreq(cfg, semis) {
    if (cfg.tuning === 'studie') {
      const base = Math.round(25 * Math.log(midiHz(cfg.rootMidi + 12 * cfg.leadOct) / 100) / Math.log(5));
      const steps = Math.round(semis * 100 / STUDIE_CENTS);
      return studieHz(Math.max(0, Math.min(80, base + steps)));
    }
    return midiHz(cfg.rootMidi + 12 * cfg.leadOct + semis);
  }
  /* επιστρέφει τα γεγονότα ενός βήματος (16ου) */
  function stepEvents(cfg, prep, step, t0, rng, fidF, prepBass) {
    const pat = PATTERNS[cfg.pattern] || PATTERNS.rolling, i = step % 16, st = stepSeconds(cfg.bpm);
    const ph = syncedPhys(cfg), A = toAudio(ph), ev = [];
    if (pat.kick[i] === '1') ev.push({ t: t0, kind: 'kick', gain: cfg.mix.kick });
    if (pat.hat[i] === '1') ev.push({ t: t0, kind: 'hat', gain: cfg.mix.hat, seed: step + 1 });
    if (pat.bass[i] === '1') ev.push({ t: t0, kind: 'spin', freq: midiHz(cfg.rootMidi), dur: st * 0.92, prep: prepBass || prepare(0, cfg.p), A, q: 0, bright: cfg.bassBright, kKnob: 1.2, gain: cfg.mix.bass, exciter: 0, drive: 1.4 });
    if (pat.lead[i] === '1' && rng() < cfg.density) {
      const P = probs(prep.rho, cfg.basis); let u = rng(), o = 0; while (o < 3 && u > P[o]) { u -= P[o]; o++; }
      const dur = Math.min(2.5, Math.max(st * (cfg.hold || 2), A.echo ? 2 * A.tau + 3 * A.T2s : 0));
      const base = { t: t0, freq: leadFreq(cfg, OUTCOME_SEMIS[o]), dur, bright: cfg.bright, kKnob: cfg.kKnob, gain: cfg.mix.lead, outcome: o, pan: (o === 1 ? -0.4 : o === 2 ? 0.4 : 0) };
      ev.push(fidF ? Object.assign(base, { kind: 'fid', F: fidF, q: 0 }) : Object.assign(base, { kind: 'spin', prep, A, q: 0, exciter: 0.35 }));
    }
    return ev;
  }
  function renderEvent(ev, fs) {
    switch (ev.kind) {
      case 'kick': return renderKick(ev, fs);
      case 'hat': return renderHat(ev, fs);
      case 'spin': return renderSpinVoice(ev, fs);
      case 'pop': return renderPopVoice(ev, fs);
      case 'mix': return renderMixture(ev, fs);
      case 'fid': return renderFidVoice(ev, fs);
    }
    return new Float32Array(1);
  }
  /* απόδοση χρονολογίου σε στερεοφωνικό buffer, με ήπιο περιοριστή tanh */
  function renderTimeline(events, total, fs, onProgress) {
    const n = Math.ceil(total * fs), L = new Float32Array(n), R = new Float32Array(n);
    events.forEach((ev, idx) => {
      const buf = renderEvent(ev, fs), off = Math.round(ev.t * fs), pan = ev.pan || 0;
      const gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
      const ch = ev.channel; // 'L' / 'R' για τη στερεοφωνική διάταξη q0/q1
      for (let i = 0; i < buf.length && off + i < n; i++) {
        if (off + i < 0) continue;
        if (ch === 'L') L[off + i] += buf[i]; else if (ch === 'R') R[off + i] += buf[i];
        else { L[off + i] += buf[i] * gl; R[off + i] += buf[i] * gr; }
      }
      if (onProgress && idx % 64 === 0) onProgress(idx / events.length);
    });
    for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * 0.9); R[i] = Math.tanh(R[i] * 0.9); }
    return [L, R];
  }
  function grooveEvents(cfg, bars, t0, fidF) {
    const prep = prepare(cfg.e, cfg.p), prepBass = prepare(0, cfg.p), rng = mulberry32(cfg.seed), st = stepSeconds(cfg.bpm), ev = [];
    for (let s = 0; s < bars * 16; s++) ev.push(...stepEvents(cfg, prep, s, (t0 || 0) + s * st, rng, fidF, prepBass));
    return ev;
  }

  /* ---------- «Δύο σπιν, πέντε στιγμές» — σύνθεση σε μορφή στιγμών ----------
     Ι   Μίγματα ημιτόνων στην κλίμακα Studie II, βάρη Born, σβήσιμο από T2*
     ΙΙ  Ελεύθερη επαγωγική απόσβεση: το T2* μικραίνει σταδιακά
     ΙΙΙ Ηχώ spin: ο ήχος επιστρέφει στο 2τ χωρίς νέο χτύπημα
     IV  Συνέχεια ρυθμού–τόνου: η διαστολή S πέφτει, οι διακροτήματα J γίνονται δύο τόνοι
     V   Σιωπή Bell: η εμπλοκή σβήνει το τοπικό σήμα· μένει το φίλτρο που αυτοταλαντώνεται — και drop */
  function pieceEvents(seed) {
    const ev = [], rng = mulberry32(seed || 1954), marks = [];
    const base = defaults();
    // Ι — 0…40 s
    marks.push({ t: 0, id: 1 });
    for (let t = 0.5; t < 39; ) {
      const e = 0.5 * rng(), prep = prepare(e, 0), P = probs(prep.rho, rng() < 0.5 ? 'Z' : 'X');
      const n0 = 10 + Math.floor(rng() * 40), d = 1 + Math.floor(rng() * 4);
      const A = toAudio({ J: 0, nu0: 0, nu1: 0, T2: 6, T2s: 0.6 + 2.4 * rng(), T1: 8, tau: 1, echo: false, S: 1 });
      const dur = Math.min(6, 4 * A.T2s);
      ev.push({ t, kind: 'mix', dur, prep, A, freqs: [0, 1, 2, 3].map(k => studieHz(Math.min(80, n0 + d * k))), weights: P.map(x => Math.sqrt(x)), gain: 0.28, pan: rng() * 1.4 - 0.7 });
      t += 0.8 + 2.6 * rng();
    }
    // ΙΙ — 40…80 s : μεμονωμένα «νύγματα» σπιν, T2* από 1,2 s σε 0,03 s
    marks.push({ t: 40, id: 2 });
    for (let t = 40, k = 0; t < 79; k++) {
      const frac = (t - 40) / 39, T2s = 1.2 * Math.pow(0.03 / 1.2, frac);
      const A = toAudio({ J: 2.5, nu0: 0, nu1: 0, T2: 1.5, T2s, T1: 3, tau: 1, echo: false, S: 1 });
      const prep = prepare(0, 0.5);
      ev.push({ t, kind: 'spin', freq: midiHz(40 + [0, 7, 12, 1][k % 4]), dur: Math.min(3.5, 5 * T2s + 0.05), prep, A, q: 0, bright: 3, kKnob: 2.2, gain: 0.85, exciter: 0, pan: (k % 2 ? 0.3 : -0.3) });
      t += Math.max(0.25, 2.6 * (1 - frac) + 0.25);
    }
    // ΙΙΙ — 80…120 s : ηχώ — το χτύπημα σβήνει, επιστρέφει στο 2τ· τ μικραίνει ώσπου η ηχώ «κλειδώνει» στο beat
    marks.push({ t: 80, id: 3 });
    for (let t = 80, k = 0; t < 119; k++) {
      const frac = (t - 80) / 39, tau = 0.9 * (1 - frac) + 0.2069 * frac; // στο τέλος 2τ = 1 beat στα 145 BPM
      const A = toAudio({ J: 0, nu0: 0, nu1: 0, T2: 3, T2s: 0.06, T1: 6, tau, echo: true, S: 1 });
      ev.push({ t, kind: 'spin', freq: midiHz(52 + [0, 0, 7, -5][k % 4]), dur: 2 * tau + 0.4, prep: prepare(0, 0), A, q: 0, bright: 3.5, kKnob: 2.8, gain: 0.6, exciter: 0 });
      ev.push({ t, kind: 'pop', freq: midiHz(28), dur: 2 * tau + 0.6, prep: prepare(0, 0), A, gain: 0.26 });
      t += 2 * tau + 0.6 * (1 - frac) + 0.2;
    }
    // IV — 120…160 s : J = 150 Hz σταθερό, η διαστολή S πέφτει από 150 σε 0,75 (ρυθμός → τόνος)
    marks.push({ t: 120, id: 4 });
    const segs = 80;
    for (let k = 0; k < segs; k++) {
      const t = 120 + k * 0.5, S = 150 * Math.pow(0.75 / 150, k / (segs - 1));
      const A = toAudio({ J: 150, nu0: 0, nu1: 0, T2: 400, T2s: 400, T1: 800, tau: 1, echo: false, S });
      ev.push({ t, kind: 'spin', freq: midiHz(45), dur: 0.52, prep: prepare(0, 0.5), A, q: 0, bright: 0, kKnob: 0, gain: 0.3, exciter: 0, filter: false, sat: false, Sval: S });
    }
    // V — 160…190 s : η εμπλοκή ανεβαίνει 0 → 1 (το κανάλι q0 αριστερά, q1 δεξιά)
    marks.push({ t: 160, id: 5 });
    for (let k = 0; k < 60; k++) {
      const t = 160 + k * 0.5, e = Math.min(1, k / 44);
      const prep = prepare(e, 0);
      const A = toAudio({ J: 0, nu0: 0, nu1: 0, T2: 2, T2s: 0.35, T1: 4, tau: 1, echo: false, S: 1 });
      const f = midiHz(52 + (k % 8 < 4 ? 0 : 12));
      if (k >= 52) continue;   // 4 s πραγματικής σιωπής πριν το drop
      ev.push({ t, kind: 'spin', freq: f, dur: 0.5, prep, A, q: 0, bright: 2.5, kKnob: 2.4, gain: 0.55, exciter: 0.35, channel: 'L', e });
      ev.push({ t, kind: 'spin', freq: f * 1.5, dur: 0.5, prep, A, q: 1, bright: 2.5, kKnob: 2.4, gain: 0.55, exciter: 0.35, channel: 'R', e });
    }
    // drop — 190…243 s : το groove με σύμπλεξη στο μέγιστο, μετά λύση
    marks.push({ t: 190, id: 6 });
    const cfg = defaults(); cfg.e = 1; cfg.echoSync = 2; cfg.seed = seed || 1954;
    const st = stepSeconds(cfg.bpm), barsA = 16, barsB = 16;
    ev.push(...grooveEvents(cfg, barsA, 190));
    const cfgB = Object.assign({}, cfg, { e: 0.35, basis: 'X', seed: (seed || 1954) + 1 });
    ev.push(...grooveEvents(cfgB, barsB, 190 + barsA * 16 * st));
    const end = 190 + (barsA + barsB) * 16 * st + 1.5;
    return { events: ev, total: end, marks };
  }

  /* ---------- WAV 16-bit ---------- */
  function wav(L, R, fs) {
    const n = L.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, fs, true); v.setUint32(28, fs * 4, true);
    v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++, o += 4) {
      v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    return buf;
  }

  const api = { prepare, describe, concurrence, probs, toAudio, signalAt, populationAt, Ladder, mulberry32, midiHz, studieHz, STUDIE_CENTS, A4,
    renderSpinVoice, renderPopVoice, renderMixture, renderKick, renderHat, renderFidVoice, parseStudioFID, fidAt,
    PATTERNS, OUTCOME_SEMIS, defaults, stepSeconds, syncedPhys, stepEvents, renderEvent, renderTimeline, grooveEvents, pieceEvents, wav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QSynth = api;
})(typeof self !== 'undefined' ? self : this);
