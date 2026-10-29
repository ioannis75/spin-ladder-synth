// Αποδίδει τη σύνθεση και ένα loop 16 μέτρων σε WAV (48 kHz, 16-bit) στον φάκελο out/.
const E = require('../src/engine.js'), fs = require('fs'), path = require('path'), sr = 48000;
const out = path.join(__dirname, '..', 'out'); fs.mkdirSync(out, { recursive: true });
const P = E.pieceEvents(1954), [L, R] = E.renderTimeline(P.events, P.total, sr);
fs.writeFileSync(path.join(out, 'dyo-spin-pente-stigmes.wav'), Buffer.from(E.wav(L, R, sr)));
const c = E.defaults(); c.echoSync = 2; const st = E.stepSeconds(c.bpm);
const [gl, gr] = E.renderTimeline(E.grooveEvents(c, 16), 16 * 16 * st, sr);
fs.writeFileSync(path.join(out, `spin-ladder_${c.bpm}bpm_E_16bars.wav`), Buffer.from(E.wav(gl, gr, sr)));
console.log('rendered to out/ (piece', P.total.toFixed(1), 's)');
