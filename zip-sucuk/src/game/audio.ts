// Zip Sucuk audio: all sounds synthesized with WebAudio, no assets.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let adMuted = false;
let failed = false;

// charge nodes
let chOsc: OscillatorNode | null = null;
let chOsc2: OscillatorNode | null = null;
let chGain: GainNode | null = null;
let chFilt: BiquadFilterNode | null = null;

// music state
let musicOn = false;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let nextStep = 0;
let stepIdx = 0;

const BPM = 100;
const STEP = 60 / BPM / 2; // eighth notes
const STEPS = 64; // 8 bars of 8 eighths

function applyMaster(): void {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(muted || adMuted ? 0 : 0.5, ctx.currentTime, 0.02);
}

export function initAudio(): void {
  try {
    if (failed) return;
    if (!ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) { failed = true; return; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted || adMuted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  } catch {
    failed = true;
    ctx = null;
    master = null;
  }
}

export function setMuted(m: boolean): void { muted = m; applyMaster(); }
export function setAdMuted(m: boolean): void { adMuted = m; applyMaster(); }
export const isMuted = (): boolean => muted;

function ok(): boolean { return !!ctx && !!master && ctx.state !== 'closed'; }

function noise(): AudioBuffer {
  if (!noiseBuf) {
    const c = ctx as AudioContext;
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Envelope: attack then exponential decay. */
function env(g: GainNode, t: number, peak: number, dur: number, att = 0.005): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(
  type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number,
  dest?: AudioNode, att = 0.005,
): void {
  const c = ctx as AudioContext;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, vol, dur, att);
  o.connect(g).connect(dest ?? (master as GainNode));
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(
  t: number, dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1: number, q = 1, att = 0.005,
): void {
  const c = ctx as AudioContext;
  const s = c.createBufferSource();
  s.buffer = noise();
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = ftype;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  env(g, t, vol, dur, att);
  s.connect(f).connect(g).connect(master as GainNode);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

// ---------- charge (stretch) ----------
function buildCharge(): void {
  const c = ctx as AudioContext;
  chGain = c.createGain();
  chGain.gain.value = 0;
  chFilt = c.createBiquadFilter();
  chFilt.type = 'lowpass';
  chFilt.frequency.value = 900;
  chFilt.Q.value = 6;
  chOsc = c.createOscillator();
  chOsc.type = 'sawtooth';
  chOsc.frequency.value = 160;
  chOsc2 = c.createOscillator();
  chOsc2.type = 'triangle';
  chOsc2.frequency.value = 162;
  // wobble for rubbery feel
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.frequency.value = 9;
  lfoG.gain.value = 6;
  lfo.connect(lfoG);
  lfoG.connect(chOsc.frequency);
  lfoG.connect(chOsc2.frequency);
  chOsc.connect(chFilt);
  chOsc2.connect(chFilt);
  chFilt.connect(chGain).connect(master as GainNode);
  chOsc.start(); chOsc2.start(); lfo.start();
}

export function charge(level01: number, on: boolean): void {
  if (!ok()) return;
  try {
    if (!chGain) buildCharge();
    const c = ctx as AudioContext;
    const t = c.currentTime;
    const l = Math.min(1, Math.max(0, level01));
    const f = 150 * Math.pow(2, l * 2.6);
    (chOsc as OscillatorNode).frequency.setTargetAtTime(f, t, 0.05);
    (chOsc2 as OscillatorNode).frequency.setTargetAtTime(f * 1.012, t, 0.05);
    (chFilt as BiquadFilterNode).frequency.setTargetAtTime(500 + l * 2200, t, 0.05);
    (chGain as GainNode).gain.setTargetAtTime(on ? 0.12 : 0, t, on ? 0.03 : 0.06);
  } catch { /* ignore */ }
}

// ---------- music ----------
// Notes in semitones above C4; -99 = rest. C major pentatonic-ish, bouncy.
const MEL: number[] = [
  // bar1-2
  0, -99, 4, -99, 7, -99, 4, -99, 9, -99, 7, -99, 4, 2, 0, -99,
  // bar3-4
  2, -99, 5, -99, 9, -99, 5, -99, 7, -99, 4, -99, 2, -99, 0, -99,
  // bar5-6
  0, 4, 7, 12, 9, 7, 4, 7, 5, 9, 12, 9, 7, 5, 4, 2,
  // bar7-8
  4, -99, 7, -99, 9, 7, 5, 4, 2, -99, 4, -99, 0, -99, -99, -99,
];
const BASS_ROOTS = [0, 0, 5, 7, 0, 5, 7, 0]; // semitones below, per bar (C F G pattern)

const mtof = (s: number): number => 261.63 * Math.pow(2, s / 12);

function playStep(i: number, t: number): void {
  const dest = musicGain as GainNode;
  const n = MEL[i % STEPS];
  if (n > -99) tone('square', mtof(n), mtof(n), t, STEP * 0.8, 0.5, dest, 0.004);
  if (i % 2 === 0) {
    const bar = Math.floor(i / 8) % 8;
    const root = BASS_ROOTS[bar] - 24;
    const pat = (i % 8) / 2; // 0..3
    const semi = root + (pat === 2 ? 7 : 0);
    tone('triangle', mtof(semi), mtof(semi), t, STEP * 1.6, 0.9, dest, 0.006);
  }
  if (i % 4 === 2) burst(t, 0.04, 0.08, 'highpass', 6000, 7000, 1, 0.002); // tick
}

function schedule(): void {
  if (!musicOn || !ctx) return;
  const lookahead = 0.25;
  while (nextStep < ctx.currentTime + lookahead) {
    playStep(stepIdx, nextStep);
    nextStep += STEP;
    stepIdx = (stepIdx + 1) % STEPS;
  }
}

export function music(on: boolean): void {
  if (!ok()) return;
  try {
    const c = ctx as AudioContext;
    if (on) {
      if (musicOn) return;
      if (!musicGain) {
        musicGain = c.createGain();
        musicGain.gain.value = 0;
        musicGain.connect(master as GainNode);
      }
      musicOn = true;
      musicGain.gain.setTargetAtTime(0.09, c.currentTime, 0.2);
      nextStep = c.currentTime + 0.05;
      stepIdx = 0;
      if (musicTimer === null) musicTimer = window.setInterval(schedule, 80);
      schedule();
    } else {
      musicOn = false;
      if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
      musicGain?.gain.setTargetAtTime(0, c.currentTime, 0.15);
    }
  } catch { /* ignore */ }
}

// ---------- sfx ----------
function run(fn: (t: number) => void): void {
  if (!ok()) return;
  try { fn((ctx as AudioContext).currentTime + 0.001); } catch { /* ignore */ }
}

export const sfx = {
  jump(power01: number): void {
    run((t) => {
      const p = Math.min(1, Math.max(0, power01));
      tone('sine', 220 + p * 120, 520 + p * 500, t, 0.18 + p * 0.1, 0.35);
      tone('triangle', 330, 90, t + 0.02, 0.22, 0.15);
      burst(t, 0.15 + p * 0.15, 0.1 + p * 0.12, 'bandpass', 600, 2500 + p * 2000, 1.5, 0.03);
    });
  },
  stick(): void {
    run((t) => {
      burst(t, 0.14, 0.4, 'lowpass', 1800, 250, 3, 0.003);
      tone('sine', 260, 90, t, 0.14, 0.35);
      tone('sine', 420, 160, t + 0.05, 0.08, 0.15);
    });
  },
  land(v01: number): void {
    run((t) => {
      const v = Math.min(1, Math.max(0, v01));
      tone('sine', 150, 55, t, 0.12, 0.2 + v * 0.35);
      burst(t, 0.08, 0.1 + v * 0.2, 'lowpass', 900, 200, 1, 0.002);
    });
  },
  bounce(): void {
    run((t) => {
      tone('sine', 180, 620, t, 0.28, 0.4);
      tone('triangle', 360, 1240, t, 0.28, 0.12);
      tone('sine', 620, 300, t + 0.2, 0.15, 0.15);
    });
  },
  slip(): void {
    run((t) => {
      tone('sawtooth', 1500, 2400, t, 0.09, 0.1, undefined, 0.01);
      burst(t, 0.09, 0.08, 'bandpass', 3000, 4500, 6, 0.01);
    });
  },
  sizzle(): void {
    run((t) => {
      burst(t, 0.6, 0.35, 'highpass', 3500, 6500, 0.7, 0.02);
      for (let i = 0; i < 5; i++) {
        burst(t + Math.random() * 0.5, 0.025, 0.25, 'bandpass', 2500 + Math.random() * 3000, 1500, 4, 0.001);
      }
      tone('square', 400, 80, t, 0.18, 0.15);
    });
  },
  respawn(): void {
    run((t) => {
      tone('sine', 300, 80, t, 0.06, 0.3);
      tone('square', 400, 400, t + 0.08, 0.07, 0.12);
      tone('square', 600, 600, t + 0.15, 0.07, 0.12);
      tone('square', 900, 900, t + 0.22, 0.12, 0.12);
    });
  },
  coin(): void {
    run((t) => {
      tone('square', 988, 988, t, 0.07, 0.15);
      tone('square', 1319, 1319, t + 0.07, 0.22, 0.15);
    });
  },
  checkpoint(): void {
    run((t) => {
      tone('triangle', 659, 659, t, 0.16, 0.3);
      tone('triangle', 988, 988, t + 0.13, 0.3, 0.3);
    });
  },
  win(): void {
    run((t) => {
      const ns = [523, 659, 784, 1047];
      ns.forEach((f, i) => {
        const d = i === 3 ? 0.6 : 0.16;
        tone('square', f, f, t + i * 0.15, d, 0.14);
        tone('triangle', f / 2, f / 2, t + i * 0.15, d, 0.25);
      });
    });
  },
  click(): void {
    run((t) => {
      tone('square', 700, 500, t, 0.04, 0.12, undefined, 0.002);
    });
  },
  star(i: number): void {
    run((t) => {
      const f = 660 * Math.pow(2, (Math.max(0, i) * 3) / 12);
      tone('triangle', f, f * 1.5, t, 0.3, 0.3);
      tone('sine', f * 2, f * 2, t, 0.25, 0.1);
    });
  },
  splash(): void {
    run((t) => {
      burst(t, 0.5, 0.4, 'lowpass', 3000, 300, 0.8, 0.01);
      for (let k = 0; k < 4; k++) {
        const f = 300 + Math.random() * 500;
        tone('sine', f, f * 2, t + 0.1 + k * 0.08 + Math.random() * 0.04, 0.07, 0.18);
      }
    });
  },
};
