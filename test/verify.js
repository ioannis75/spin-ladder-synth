// Επαλήθευση σημείων αναφοράς της κάρτας μοντέλου — node verify.js
const E = require('../src/engine.js');
const rows = [];
const chk = (name, expected, got, tol) => { const dev = Math.abs(got - expected); rows.push({ name, expected, got, dev, ok: dev <= tol }); };
const fs = 48000;

// B1  |s(T2*)| = 1/e
{ const P = E.prepare(0, 0), A = E.toAudio({ J: 0, nu0: 0, nu1: 0, T2: 0.4, T2s: 0.05, T1: 1, tau: 1, echo: false, S: 1 });
  const s = E.signalAt(P, A, 0, 0.05); chk('B1 |s(T2*)| = 1/e', Math.exp(-1), Math.hypot(s.re, s.im), 1e-12); }
// B2  ηχώ: μέγιστο στο 2τ, ύψος e^{-2τ/T2}
{ const P = E.prepare(0, 0), tau = 0.03, T2 = 0.4, A = E.toAudio({ J: 7, nu0: 3, nu1: 0, T2, T2s: 0.005, T1: 1, tau, echo: true, S: 1 });
  let best = 0, tb = 0; for (let t = tau + 1e-4; t < 0.2; t += 1e-5) { const s = E.signalAt(P, A, 0, t), r = Math.hypot(s.re, s.im); if (r > best) { best = r; tb = t; } }
  chk('B2a θέση μεγίστου ηχούς (s)', 2 * tau, tb, 2e-5); chk('B2b ύψος ηχούς', Math.exp(-2 * tau / T2), best, 1e-6);
  const sb = E.signalAt(P, A, 0, tau - 1e-6); chk('B2c σήμα λίγο πριν τον π (≈ e^{-τ/T2*})', Math.exp(-tau / 0.005), Math.hypot(sb.re, sb.im), 1e-3); }
// B3  διακρότημα J: μηδέν στο t = 1/(2J_audio), J_audio = J/S
{ const P = E.prepare(0, 0.5);
  for (const S of [150, 15]) { const A = E.toAudio({ J: 150, nu0: 0, nu1: 0, T2: 1e3, T2s: 1e3, T1: 1e3, tau: 1, echo: false, S });
    const tz = 1 / (2 * A.J), s = E.signalAt(P, A, 0, tz);
    chk(`B3 |s| στο 1/(2J) για S=${S} (J_ήχου=${A.J} Hz)`, 0, Math.hypot(s.re, s.im), 1e-9); } }
// B3b φασματικά: S=0,75 → δύο γραμμές f_c ± 100 Hz
{ const P = E.prepare(0, 0.5), A = E.toAudio({ J: 150, nu0: 0, nu1: 0, T2: 1e3, T2s: 1e3, T1: 1e3, tau: 1, echo: false, S: 0.75 });
  const fc = 440, dur = 1, y = E.renderSpinVoice({ freq: fc, dur, prep: P, A, q: 0, bright: 0, kKnob: 0, gain: 1, filter: false }, fs);
  const dft = f => { let r = 0, i = 0; for (let n = 0; n < y.length; n++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / y.length); r += y[n] * w * Math.cos(2 * Math.PI * f * n / fs); i += y[n] * w * Math.sin(2 * Math.PI * f * n / fs); } return Math.hypot(r, i); };
  let bf = 0, bv = 0; for (let f = 400; f <= 600; f += 1) { const v = dft(f); if (v > bv) { bv = v; bf = f; } }
  let bf2 = 0, bv2 = 0; for (let f = 300; f <= 380; f += 1) { const v = dft(f); if (v > bv2) { bv2 = v; bf2 = f; } }
  chk('B3c άνω φασματική γραμμή (Hz)', 540, bf, 1); chk('B3d κάτω φασματική γραμμή (Hz)', 340, bf2, 1);
  chk('B3e λόγος έντασης στο f_c (κενό) / κορυφή', 0, dft(440) / bv, 0.02); }
// B4  φίλτρο σκάλας
{ const fc = 1000; let L = new E.Ladder(fs), peak = 0;
  for (let n = 0; n < fs; n++) { const y = L.process(Math.sin(2 * Math.PI * fc * n / fs), fc, 0, false); if (n > fs / 2) peak = Math.max(peak, Math.abs(y)); }
  chk('B4a |H(jω_c)| για k=0 (−12,04 dB)', 0.25, peak, 2e-3);
  const ring = k => { const L = new E.Ladder(fs); let e1 = 0, e2 = 0; for (let n = 0; n < fs; n++) { const y = L.process(n === 0 ? 1 : 0, fc, k, false); if (n > 0.1 * fs && n < 0.2 * fs) e1 = Math.max(e1, Math.abs(y)); if (n > 0.8 * fs) e2 = Math.max(e2, Math.abs(y)); } return e2 / e1; };
  chk('B4b k=4: πλάτος 0,8 s / 0,1 s (αυτοταλάντωση, = 1)', 1, ring(4), 0.01);
  rows.push({ name: 'B4c k=3,9 σβήνει / k=4,1 αυξάνει', expected: '<1 / >1', got: ring(3.9).toExponential(2) + ' / ' + ring(4.1).toExponential(2), dev: '', ok: ring(3.9) < 1 && ring(4.1) > 1 }); }
// B4d αναλυτικό: (1+j)^4 = −4  →  πόλος στο jω_c όταν k = 4
{ const re = (1 + 0) , im = 1; let zr = 1, zi = 0; for (let i = 0; i < 4; i++) { const r = zr * re - zi * im, m = zr * im + zi * re; zr = r; zi = m; }
  chk('B4d (1+j)^4 (πραγματικό μέρος)', -4, zr, 1e-12); }
// B5  κλίμακα Studie II
chk('B5a βήμα (cents)', 111.45, E.STUDIE_CENTS, 0.01); chk('B5b f_80 (Hz)', 17247, E.studieHz(80), 1);
// B6  σιωπή Bell
{ const P = E.prepare(1, 0), A = E.toAudio(E.defaults().phys); let mx = 0; for (let t = 0; t < 0.5; t += 1e-3) { const s = E.signalAt(P, A, 0, t), s1 = E.signalAt(P, A, 1, t); mx = Math.max(mx, Math.hypot(s.re, s.im), Math.hypot(s1.re, s1.im)); }
  chk('B6a max |s_q| για Bell (q0 και q1)', 0, mx, 1e-12); chk('B6b C(Bell)', 1, P.C, 1e-9);
  const pz = E.probs(P.rho, 'Z'), px = E.probs(P.rho, 'X'); chk('B6c P(01)+P(10) Bell, βάση Z', 0, pz[1] + pz[2], 1e-12); chk('B6d P(01)+P(10) Bell, βάση X', 0, px[1] + px[2], 1e-12); }
// B7  ανταλλαγή ήχου–εμπλοκής
{ let worst = 0, worst2 = 0; for (let e = 0; e <= 1; e += 0.05) { const P = E.prepare(e, 0), M = 2 * Math.hypot(P.coh[0][0].re + P.coh[0][1].re, P.coh[0][0].im + P.coh[0][1].im); worst = Math.max(worst, Math.abs(M * M + P.C * P.C - 1)); }
  for (let e = 0; e <= 1; e += 0.1) for (let p = 0; p <= 0.5; p += 0.05) { const P = E.prepare(e, p); worst2 = Math.max(worst2, Math.abs(P.C - (1 - 2 * p) * Math.sin(Math.PI * e / 2))); }
  chk('B7a max |M⊥² + C² − 1| (καθαρός σύντροφος)', 0, worst, 1e-6); chk('B7b max |C − (1−2p)·sin(πe/2)|', 0, worst2, 1e-6); }
// B8  T1 και αντιστροφή πληθυσμού στον π παλμό
{ const P = E.prepare(0, 0), A = E.toAudio({ J: 0, nu0: 0, nu1: 0, T2: 0.4, T2s: 0.05, T1: 1, tau: 0.2, echo: true, S: 1 });
  const before = E.populationAt(P, A, 0, 0.2 - 1e-9), after = E.populationAt(P, A, 0, 0.2 + 1e-9); chk('B8 p(τ⁺) = 1 − p(τ⁻)', 1 - before, after, 1e-6); }
// B9  διαστολή S: ηχητικό T2* = S · φυσικό
{ const A = E.toAudio({ J: 10, nu0: 0, nu1: 0, T2: 0.4, T2s: 0.05, T1: 1, tau: 0.01, echo: true, S: 20 }); chk('B9 T2*_ήχου για S=20 (s)', 1.0, A.T2s, 1e-12); }
// B10 συμβάσεις Studio και εισαγωγή FID
chk('B10a C4 στο A4=435 (Hz, ρίζα του Studio)', 258.6525475130918, E.midiHz(60), 1e-9);
try { const F = E.parseStudioFID(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'synthetic-fid.json'), 'utf8'));
  chk('B10b εισαγωγή pundora-fid-v3: q0(0)', 1, E.fidAt(F, 0, 0).re, 1e-6);
  const y = E.renderFidVoice({ F, freq: 258.65, dur: 2, bright: 2, kKnob: 1, gain: 0.5 }, fs); let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
  rows.push({ name: 'B10c απόδοση εισαγόμενου FID (κορυφή, πεπερασμένη)', expected: '0 < x < 1', got: pk.toFixed(3), dev: '', ok: pk > 0 && pk < 1 && Number.isFinite(pk) }); }
catch (e) { rows.push({ name: 'B10b εισαγωγή FID', expected: 'ok', got: String(e), dev: '', ok: false }); }
// B11 αλληλουχητής: ντετερμινιστικός με seed
{ const c = E.defaults(); const a = E.grooveEvents(c, 2).map(e => e.kind + e.t.toFixed(4) + (e.freq || 0).toFixed(2)).join(), b = E.grooveEvents(c, 2).map(e => e.kind + e.t.toFixed(4) + (e.freq || 0).toFixed(2)).join();
  rows.push({ name: 'B11 ίδιο seed → ίδια γεγονότα', expected: 'ίδια', got: a === b ? 'ίδια' : 'διαφέρουν', dev: '', ok: a === b });
  const ce = Object.assign(E.defaults(), { e: 1, p: 0 }), notes = new Set(E.grooveEvents(ce, 16).filter(e => e.outcome !== undefined).map(e => e.outcome));
  rows.push({ name: 'B11b Bell: η μελωδία χρησιμοποιεί μόνο 00/11 (θεμέλιο/οκτάβα)', expected: '0,3', got: [...notes].sort().join(','), dev: '', ok: [...notes].every(o => o === 0 || o === 3) }); }
// B12 echo sync: 2τ_ήχου = n δέκατα έκτα
{ const c = Object.assign(E.defaults(), { echoSync: 2 }); const A = E.toAudio(E.syncedPhys(c)); chk('B12 2τ_ήχου με sync=2 στα 145 BPM (s)', 2 * 60 / 145 / 4, 2 * A.tau, 1e-12); }

const pass = rows.filter(r => r.ok).length;
for (const r of rows) console.log((r.ok ? 'OK  ' : 'FAIL') + ' | ' + r.name + ' | αναμ. ' + (typeof r.expected === 'number' ? +r.expected.toPrecision(8) : r.expected) + ' | αποτ. ' + (typeof r.got === 'number' ? +r.got.toPrecision(8) : r.got) + ' | απόκλ. ' + (typeof r.dev === 'number' ? r.dev.toExponential(1) : r.dev));
console.log(`\n${pass}/${rows.length} έλεγχοι πέρασαν`);
require('fs').writeFileSync(require('path').join(__dirname, 'verify-results.json'), JSON.stringify(rows, null, 1));
process.exit(pass === rows.length ? 0 : 1);
