# Spin Ladder Synth

A synthesizer whose voices are two nuclear spins. A classical simulation of a two-spin NMR system drives a 4-pole ladder filter and a 145 BPM psytrance groove engine. It is built for public outreach and for live DJ sets, and runs entirely in the browser as one HTML file.

**Play it online:** https://ioannis75.github.io/spin-ladder-synth/ — or open `index.html` in Chrome, Edge, Firefox or Safari. No install, no server. (Fonts load from Google Fonts when online; everything else works offline.)

> Ελληνικά: ένα συνθεσάιζερ με φωνές δύο πυρηνικά σπιν. Μια κλασική προσομοίωση NMR δύο σπιν οδηγεί ένα φίλτρο σκάλας τεσσάρων πόλων και μια μηχανή psytrance στα 145 BPM. Για εκλαΐκευση και live DJ sets. Η διεπαφή είναι στα ελληνικά και στα αγγλικά.

## What you can do

- **Play live.** Space starts and stops. Keys 1–5 load scenes: Clean spin, Echo on the beat, Two beating spins, Bell silence, Studie II.
- **Take the lesson.** The *Lesson* button runs a 96-bar autopilot set (about 2:39) that turns the knobs itself, plays the music, and explains each move. Touching any control pauses it so you can take over. In fullscreen the explanation is drawn on the scope, for projection.
- **Hear the piece.** *Two Spins, Five Moments* (4:05) is an original piece in moment form, inspired by Stockhausen: sine mixtures on the Studie II scale, free induction decay, spin echo, a rhythm→pitch continuum, the Bell silence, and a drop.
- **Export loops.** Renders the current settings to sample-accurate WAV bars, named with BPM, key and seed.
- **Use MIDI.** Notes play the lead (A4 = 435 Hz); CC 1–8 drive the main knobs; *Learn* remaps them. Needs Web MIDI (Chrome or Edge on a computer).
- **Load Studio data.** FID exports from [Quantum Music Studio](https://github.com/pundora333/Quantum_Music_Studio) (format `pundora-fid-v3`) can be loaded as the lead voice.

## The physics

State preparation, with q0 put in |+⟩ and a partner q1 at "temperature" p, then a controlled-R_y(πe) (a CNOT at e = 1):

```
ρ(0) = U (|+⟩⟨+| ⊗ diag(1−p, p)) U†
H/h  = ν₀I_z⁰ + ν₁I_z¹ + J·I_z⁰I_z¹
s_q(t) = 2 Σ_b c_b e^(i2π f_b t′) e^(−t/T₂) e^(−|t′|(1/T₂* − 1/T₂)),   f_b = ν_q + J(½ − b)
echo (π at τ):  t′ = t − 2τ,  c_b → c_b*,   |s(2τ)| = e^(−2τ/T₂)
audio:  y(u) = G · Re[ s(u) · e^(i2π f_c u) ],  audio time = S · physical time
C = (1 − 2p) · sin(πe/2)
```

Simplifications: ideal pulses, Lorentzian static inhomogeneity (so 1/T₂* = 1/T₂ + 1/T₂′), a selective π pulse on the observed spin, no receiver noise.

**A point worth teaching.** After the CNOT the local signal of both spins vanishes for *any* partner temperature, but the state is entangled only when the partner is cold (C = (1−2p)·sin(πe/2)). Local silence is not proof of entanglement. In the instrument the filter only "sings" when C > 0.

### What is physics and what is a design choice

| Physics (from the model) | Design choices (declared) | Classical, no physics |
|---|---|---|
| Each note's shape and fade (T₂, T₂*) | Filter cutoff follows \|s(t)\|: f_c = f_note·2^(bright·\|s\|) | Kick and hi-hat |
| The return at 2τ (spin echo) | Resonance follows concurrence: k = k₀(1−C) + 4.3·C | tanh saturation |
| The two J lines; beating vs. two pitches | Outcomes 00/01/10/11 → root / tritone / tritone below / octave | The small click that excites the filter |
| Silence after the CNOT | | Seeded pseudo-random generator |
| Measurement probabilities (Born rule) | | |

All sound is produced classically from a classical simulation. You are not hearing a quantum computer.

## Verification

`npm test` runs 29 checks of the model against analytical results:

| Check | Expected |
|---|---|
| \|s(T₂*)\| | 1/e |
| Echo peak position and height | 2τ, e^(−2τ/T₂) |
| J beating, spectral lines | zero at 1/(2J); f_c ± J/2 |
| Ladder filter at the cutoff, k = 0 | −12.04 dB |
| Ladder filter self-oscillation | exactly at k = 4 |
| Studie II scale | 111.45 cents per step, f₈₀ ≈ 17 247 Hz |
| Bell state | local signals ≡ 0, C = 1, only 00/11 outcomes |
| Pure partner | M⊥² + C² = 1 |
| Concurrence formula | C = (1−2p)·sin(πe/2) |
| π pulse on populations | p(τ⁺) = 1 − p(τ⁻) |

`python3 test/xcheck.py` (needs numpy) recomputes concurrence, the echo and the filter poles independently. The same table is shown in the app under *Under the hood*.

## Repository

```
src/engine.js        physics + synthesis engine (pure JS, no DOM; runs in browser, worker and Node)
src/page.src.html    the interface (markup, styles, live audio, lesson)
scripts/build.js     assembles index.html
scripts/render.js    renders the piece and a 16-bar loop to out/*.wav
scripts/make-fixture.js  writes a synthetic FID file for the import test
test/verify.js       the 29 checks;  test/xcheck.py  numpy cross-check
docs/DESIGN.md       colors, type, components
index.html           the built instrument (commit it after npm run build)
```

```
npm run all      # fixture + tests + build
npm run render   # out/dyo-spin-pente-stigmes.wav, out/spin-ladder_145bpm_E_16bars.wav
```

No dependencies. Node 18 or newer.

## Credits

- Physics model and conventions (A4 = 435 Hz, s = Tr[ρσ⁻], y = G·Re[s·e^{i2πf u}], q0 left / q1 right) follow the NMR Lab of **Quantum Music Studio** by Panagiota (Giota) Brousali, diploma thesis, School of Applied Mathematical and Physical Sciences (SEMFE), National Technical University of Athens. This repository contains none of the Studio's code or data.
- The piece is original. It borrows ideas from Karlheinz Stockhausen (the Studie II scale 5^(n/25), the rhythm–pitch continuum of *Kontakte*, moment form) and reproduces none of his works.
- Ioannis Theodonis, Quantum Computers & Technologies Lab, SEMFE, NTUA.

## License

See [LICENSE](LICENSE).
