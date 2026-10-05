// All sounds are synthesized with the Web Audio API — no audio assets needed.
let ctx = null;
let muted = localStorage.getItem('pp-muted') === '1';

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(val) {
  muted = val;
  localStorage.setItem('pp-muted', val ? '1' : '0');
}

function tone({ freq, start = 0, dur = 0.2, type = 'triangle', gain = 0.15, slideTo = null }) {
  const c = ac();
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Wobbly "theremin" voice for the Halloween variants: a tone with an LFO
// bending its pitch, which is what makes it sound like a ghost rather than a beep.
function eerie({ freq, slideTo = null, start = 0, dur = 0.5, gain = 0.1, vibrato = 6, depth = 10, type = 'sine' }) {
  const c = ac();
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const lfo = c.createOscillator();
  lfo.frequency.value = vibrato;
  const lfoGain = c.createGain();
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + dur + 0.05);
  lfo.stop(t0 + dur + 0.05);
}

export const sounds = {
  // Halloween card select: a quick ghostly "woo"
  ghostPop() {
    if (muted) return;
    eerie({ freq: 320, slideTo: 500, dur: 0.22, gain: 0.1, vibrato: 11, depth: 14 });
  },

  // Halloween reveal: low rumble + eerie theremin rise
  hauntedReveal() {
    if (muted) return;
    tone({ freq: 70, dur: 0.75, type: 'sawtooth', gain: 0.05, slideTo: 52 });
    eerie({ freq: 480, slideTo: 980, dur: 0.75, gain: 0.07, vibrato: 7, depth: 16 });
  },

  // Halloween nudge: three slow dungeon-door knocks, then a ghost wail
  doorKnock() {
    if (muted) return;
    [0, 0.4, 0.8].forEach((s) => tone({ freq: 95, start: s, dur: 0.14, type: 'sine', gain: 0.25, slideTo: 58 }));
    eerie({ freq: 440, slideTo: 660, start: 1.15, dur: 0.7, gain: 0.07, vibrato: 5.5, depth: 20 });
    eerie({ freq: 660, slideTo: 392, start: 1.85, dur: 0.6, gain: 0.05, vibrato: 5.5, depth: 20 });
  },

  // Card select: soft pop
  pop() {
    if (muted) return;
    tone({ freq: 520, dur: 0.09, type: 'sine', gain: 0.12 });
    tone({ freq: 780, start: 0.03, dur: 0.08, type: 'sine', gain: 0.08 });
  },

  // Votes revealed: quick sparkle
  reveal() {
    if (muted) return;
    [660, 880, 1100].forEach((f, i) => tone({ freq: f, start: i * 0.07, dur: 0.15, type: 'triangle', gain: 0.1 }));
  },

  // Consensus fanfare: triumphant trumpet-ish riff
  fanfare() {
    if (muted) return;
    const notes = [523, 523, 523, 659, 784, 1047];
    const starts = [0, 0.12, 0.24, 0.36, 0.52, 0.72];
    const durs = [0.1, 0.1, 0.1, 0.14, 0.18, 0.5];
    notes.forEach((f, i) => {
      tone({ freq: f, start: starts[i], dur: durs[i], type: 'sawtooth', gain: 0.09 });
      tone({ freq: f / 2, start: starts[i], dur: durs[i], type: 'square', gain: 0.04 });
    });
  },

  // Disco: funky little bass riff
  disco() {
    if (muted) return;
    const bass = [98, 98, 147, 98, 175, 165, 147, 131];
    bass.forEach((f, i) => tone({ freq: f, start: i * 0.16, dur: 0.13, type: 'sawtooth', gain: 0.1 }));
    [784, 988, 1175, 1568].forEach((f, i) =>
      tone({ freq: f, start: 0.32 + i * 0.16, dur: 0.1, type: 'triangle', gain: 0.05 })
    );
  },

  // Party horn
  party() {
    if (muted) return;
    tone({ freq: 400, dur: 0.5, type: 'sawtooth', gain: 0.09, slideTo: 800 });
    tone({ freq: 600, start: 0.1, dur: 0.5, type: 'square', gain: 0.05, slideTo: 1200 });
    [1047, 1319, 1568].forEach((f, i) => tone({ freq: f, start: 0.5 + i * 0.08, dur: 0.2, type: 'triangle', gain: 0.08 }));
  },

  // Sad trombone: womp womp womp
  womp() {
    if (muted) return;
    const seq = [
      { f: 233, s: 0 },
      { f: 220, s: 0.35 },
      { f: 208, s: 0.7 },
      { f: 196, s: 1.05 },
    ];
    seq.forEach(({ f, s }, i) => {
      const last = i === seq.length - 1;
      tone({ freq: f, start: s, dur: last ? 0.8 : 0.3, type: 'sawtooth', gain: 0.1, slideTo: last ? f * 0.85 : f * 0.94 });
    });
  },

  // Halloween consensus: spooky organ riff (toccata-adjacent, minor key)
  monstermash() {
    if (muted) return;
    const riff = [
      { f: 587, s: 0, d: 0.11 },   // D5
      { f: 523, s: 0.12, d: 0.11 }, // C5
      { f: 587, s: 0.24, d: 0.4 },  // D5
      { f: 440, s: 0.72, d: 0.09 }, // A4
      { f: 415, s: 0.82, d: 0.09 }, // G#4
      { f: 392, s: 0.92, d: 0.09 }, // G4
      { f: 349, s: 1.02, d: 0.09 }, // F4
      { f: 392, s: 1.12, d: 0.5 },  // G4
    ];
    for (const { f, s, d } of riff) {
      tone({ freq: f, start: s, dur: d, type: 'sawtooth', gain: 0.08 });
      tone({ freq: f / 2, start: s, dur: d, type: 'square', gain: 0.05 });
      tone({ freq: f * 2, start: s, dur: d, type: 'triangle', gain: 0.03 });
    }
  },

  // Halloween dissenter: thunderclap (filtered noise burst)
  thunder() {
    if (muted) return;
    const c = ac();
    const dur = 1.4;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.4, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter).connect(g).connect(c.destination);
    src.start();
  },

  // Nudge: cheeky knock-knock
  nudge() {
    if (muted) return;
    tone({ freq: 330, dur: 0.07, type: 'square', gain: 0.12 });
    tone({ freq: 330, start: 0.12, dur: 0.07, type: 'square', gain: 0.12 });
    tone({ freq: 415, start: 0.28, dur: 0.12, type: 'square', gain: 0.1 });
  },
};
