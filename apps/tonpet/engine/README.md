# Tonpet engine tests

`dsp.js` is the exact voice engine embedded in `../index.html`, which runs in an AudioWorklet or falls back to a ScriptProcessor.
- `node stress.js` plays 60 s of random notes and breath. It checks the output for non-finite samples and reports peak levels and the real-time factor.
- `node chk.js 1 1` runs a level and pitch-ratio table across pitch × breath for both bores, untuned.

The same code is meant to move to a microcontroller (Daisy Seed or Teensy) for the physical instrument.
