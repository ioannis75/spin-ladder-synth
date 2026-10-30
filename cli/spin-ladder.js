#!/usr/bin/env node
/* Spin Ladder command line — made for people and for AI agents.
   Every command prints JSON on stdout, so an agent can read the result and decide what to do next.

   spin-ladder describe                         the song-spec format: every knob and switch, with ranges
   spin-ladder validate <song.json>             check a spec without rendering
   spin-ladder render <song.json> [options]     render a mastered 24-bit WAV and a report
       --out <file.wav>     output path (default: <song>.wav)
       --loop               seamless loop for games: the release tail is folded onto the start
       --stems              also write one WAV per voice group (drums, bass, chords, lead) for adaptive music
       --lufs <n>           loudness target (default -14, streaming); --no-master leaves levels raw
       --sr <hz>            sample rate (default 44100)
*/
'use strict';
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js'), S = require('../src/song.js');

const out = o => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
const fail = (msg, extra) => { out(Object.assign({ ok: false, error: msg }, extra || {})); process.exit(1); };
const args = process.argv.slice(2), cmd = args[0];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const has = name => args.includes('--' + name);

function load(file) {
  if (!file) fail('give a song spec: spin-ladder ' + cmd + ' <song.json>');
  let spec; try { spec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail('cannot read ' + file + ': ' + e.message); }
  const v = S.validate(spec); if (!v.ok) fail('invalid song spec', { errors: v.errors });
  return { spec, v };
}

if (!cmd || cmd === 'help' || cmd === '--help') {
  out({ ok: true, usage: ['describe', 'validate <song.json>', 'render <song.json> [--out f.wav] [--loop] [--stems] [--lufs -14] [--no-master] [--sr 44100]'],
    examples: ['songs/simple-song.json', 'songs/level-1-loop.json', 'songs/live-set.json'] });
} else if (cmd === 'describe') {
  out({ ok: true,
    format: { title: 'string', bpm: '60–220 (default 145)', seed: 'integer: same seed, same song', set: '{key: value} applied at the start',
      sections: [{ name: 'string', bars: 'integer 1–256', set: '{key: value} applied when the section starts', ramp: '{knob: [target, overBars]} smooth move', el: '{t, h, x} lesson text (Greek), optional', en: '{t, h, x} lesson text (English), optional', focus: 'controls to highlight in the lesson, optional' }] },
    knobs: Object.fromEntries(Object.entries(S.KNOBS).map(([k, d]) => [k, { min: d.min, max: d.max, unit: d.unit, scale: d.log ? 'log' : d.curve ? 'curve' : 'linear', doc: d.doc }])),
    switches: S.SWITCHES,
    physics: 'Each note is the transverse magnetisation of a nuclear spin: it fades with T2*, returns at 2τ with the echo, beats at J, and goes silent when the CNOT entangles it (Bell state). Measurement outcomes (Born rule) pick notes or 2-bar phrases.',
    rules: ['Write original material: the instrument has its own progression and motif; do not transcribe existing songs.', 'Render, then read the report: aim for lufs ≈ -14, peakDbfs ≤ -1, and a dynamicRangeDb that matches the intent (≥ 4 dB between quiet and loud sections).'] });
} else if (cmd === 'validate') {
  const { v } = load(args[1]); out({ ok: true, bars: v.bars, warnings: v.warnings });
} else if (cmd === 'render') {
  const file = args[1], { spec } = load(file);
  const sr = +opt('sr', 44100), loop = has('loop'), target = +opt('lufs', -14);
  const dest = opt('out', file.replace(/\.json$/i, '') + (loop ? '-loop' : '') + '.wav');
  const t0 = Date.now(), r = S.render(spec, { sr, loop });
  let L = r.L, R = r.R, mastered = null;
  if (!has('no-master')) { mastered = S.master(L, R, sr, target); L = mastered.L; R = mastered.R; }
  fs.writeFileSync(dest, Buffer.from(S.wav24(L, R, sr)));
  const files = [dest];
  if (has('stems')) {
    const g = mastered ? Math.pow(10, mastered.gainDb / 20) : 1;
    for (const voice of ['drums', 'bass', 'chords', 'lead']) {
      const st = S.render(spec, { sr, loop, only: voice });
      const f = dest.replace(/\.wav$/i, '') + '.' + voice + '.wav';
      fs.writeFileSync(f, Buffer.from(S.wav24(st.L.map(v => v * g), st.R.map(v => v * g), sr))); files.push(f);
    }
  }
  out(Object.assign({ ok: true, files, loop, renderSeconds: +((Date.now() - t0) / 1000).toFixed(1), gainDb: mastered ? +mastered.gainDb.toFixed(1) : 0 },
    S.report(L, R, sr, r.marks, r.total)));
} else fail('unknown command: ' + cmd + ' (try: help)');
