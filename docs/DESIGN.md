# DESIGN.md — Spin Ladder Synth

An instrument panel for dark rooms: lecture halls with a projector, and DJ booths. The page is operated more than read, so the design favours legibility at a distance, clear state, and one strong visual (the scope).

Direction: a dual-trace oscilloscope on an analog synth front panel. It is derived from the subject (oscilloscope channel colours, synth panel legends), not from reference websites. No UXKIN comparison was made.

## Color

Single dark theme by choice (live use in the dark). Set `color-scheme: dark` on `:root`.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#0d1016` | Page background, sticky bar, safe-area band |
| `--panel` | `#151a23` | Modules, stage, lesson bar, piece block |
| `--panel-2` | `#1c2230` | Inputs, knob bodies, timeline cells, equations |
| `--line` | `#2a3243` | Borders, grid, knob tracks, idle progress |
| `--ink` | `#e7eaf0` | Primary text, knob pointers, C ring |
| `--ink-dim` | `#9ba4b6` | Secondary text, captions, units |
| `--ch1` | `#ffc53d` | Spin q0, CH1 / left trace, primary action (Play), active values, lesson focus |
| `--ch2` | `#4fd8e0` | Spin q1, CH2 / right trace, Lesson button, selected segment, focus ring |
| `--live` | `#ff6b5a` | MIDI-learn armed state only |

Rules: on the stage and in readouts, amber and cyan always mean q0 and q1 (the scope convention CH1 yellow / CH2 cyan). In controls, amber marks the primary action and whatever is changing now; cyan marks selection and the lesson. Never use either for decoration. Contrast on `--panel` (measured): ink 14.5:1, ink-dim 7.0:1, ch1 11.1:1, ch2 10.2:1.

## Typography

| Token | Family | Use |
|---|---|---|
| `--f-display` | Advent Pro 600/700 | Brand, module headings (uppercase, +0.16em), knob labels, lesson titles |
| `--f-body` | Commissioner 400/500/600 | Running text, captions, buttons |
| `--f-mono` | JetBrains Mono 400/600 | All numbers and units, readouts, step outcomes |

All three cover Greek. Numbers use `tabular-nums`; Greek UI uses a decimal comma.

Scale (px): 11 · 12.5 · 13.5 · 15 (body) · 18 · 22 · 24 · 30 (brand). Canvas text is drawn at 24/26/52 px on a 1280×800 canvas so it survives projection.

## Spacing and layout

- 4-based: 4 · 6 · 8 · 10 · 14 · 18 · 24.
- Content max-width 1380 px; side gutter `max(16px, env(safe-area-inset-*))`.
- Main grid: stage 1.25fr + rack 1fr; stacks below 960 px. Rack is `auto-fit, minmax(250px, 1fr)`.

## Shape and depth

- Radius: 6 (inputs, timeline), 8 (buttons), 10 (`--r`, modules), 999 (chips, Play).
- One shadow only: the fixed lesson bar (`0 -10px 30px`). Everything else is flat with 1 px borders.

## Components

- **Play / Lesson**: pill, outline at rest, filled when `aria-pressed="true"`. Play is amber, Lesson cyan.
- **Knob**: 56 px SVG dial over a hidden range input (keyboard + screen reader). Drag vertically (Shift = fine), wheel, double-click to reset. Amber value arc, ink pointer, label in display face, value in mono.
- **Chip / segmented control**: pill, `--ch2` border and text when selected.
- **Module**: panel with an uppercase display heading and a one-line dim subtitle that says what the module does physically.
- **Stage**: canvas with the spin disc (q0 amber / q1 cyan arrows, C ring), dual-trace scope, and the 16-step strip with Born outcomes.
- **Lesson bar**: fixed to the bottom with safe-area padding; segmented progress (one segment per cue, width ∝ bars), title, explanation, a live line of the knob values being turned, and Pause / Next / Exit. The same title, hint and live line are drawn in a band at the top of the canvas so they show in fullscreen.
- **Focus highlight**: knobs and controls the autopilot is turning pulse amber (`@keyframes pulse`); their module gets an amber border. With reduced motion the pulse becomes a static ring.

## Imagery

No photos or icon set. All visuals are drawn from the live model on canvas. The only glyphs are text characters (⟳, ✓, ❚❚).
