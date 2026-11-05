let ctx: AudioContext | null = null;
let master: GainNode;
interface Eng { saw: OscillatorNode; sq: OscillatorNode; am: OscillatorNode; lump: OscillatorNode; whine: OscillatorNode; lp: BiquadFilterNode; lumpAmt: GainNode; whineGain: GainNode; out: GainNode }
let eng: Eng | null = null;
let ufoOsc: OscillatorNode, ufoGain: GainNode;
let muted = false, adMuted = false;

function noiseBuf(c: AudioContext, secs: number) {
  const n = Math.floor(c.sampleRate * secs), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function buildEngine(c: AudioContext): Eng {
  const mix = c.createGain(); mix.gain.value = 0.6;
  // sawtooth + square sub-octave
  const saw = c.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 30;
  const sq = c.createOscillator(); sq.type = 'square'; sq.frequency.value = 15;
  const sawG = c.createGain(); sawG.gain.value = 0.5; const sqG = c.createGain(); sqG.gain.value = 0.22;
  saw.connect(sawG); sq.connect(sqG); sawG.connect(mix); sqG.connect(mix);
  // combustion noise, amplitude-modulated at the firing frequency
  const ns = c.createBufferSource(); ns.buffer = noiseBuf(c, 1); ns.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.8;
  const amG = c.createGain(); amG.gain.value = 0.5;
  const am = c.createOscillator(); am.type = 'sine'; am.frequency.value = 30;
  const amD = c.createGain(); amD.gain.value = 0.5; am.connect(amD); amD.connect(amG.gain);
  const nG = c.createGain(); nG.gain.value = 0.35;
  ns.connect(bp); bp.connect(amG); amG.connect(nG); nG.connect(mix);
  // lumpy idle: slow LFO on the mix level, depth set per frame
  const lump = c.createOscillator(); lump.type = 'sine'; lump.frequency.value = 7;
  const lumpAmt = c.createGain(); lumpAmt.gain.value = 0.2; lump.connect(lumpAmt); lumpAmt.connect(mix.gain);
  // soft distortion
  const sh = c.createWaveShaper(), curve = new Float32Array(257);
  for (let i = 0; i < 257; i++) curve[i] = Math.tanh(((i - 128) / 128) * 2.2);
  sh.curve = curve;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.9;
  const out = c.createGain(); out.gain.value = 0;
  mix.connect(sh); sh.connect(lp); lp.connect(out);
  // quiet intake whine
  const whine = c.createOscillator(); whine.type = 'sine'; whine.frequency.value = 400;
  const whineGain = c.createGain(); whineGain.gain.value = 0; whine.connect(whineGain); whineGain.connect(out);
  out.connect(master);
  [saw, sq, ns, am, lump, whine].forEach(n => n.start());
  return { saw, sq, am, lump, whine, lp, lumpAmt, whineGain, out };
}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination); applyMute();
    eng = buildEngine(ctx);
    ufoOsc = ctx.createOscillator(); ufoOsc.type = 'sine'; ufoGain = ctx.createGain(); ufoGain.gain.value = 0;
    ufoOsc.connect(ufoGain); ufoGain.connect(master); ufoOsc.start();
  } catch { ctx = null; eng = null; }
}
function applyMute() { if (master) master.gain.value = muted || adMuted ? 0 : 0.5; }
export function setMuted(m: boolean) { muted = m; applyMute(); }
export function setAdMuted(m: boolean) { adMuted = m; applyMute(); }
export const isMuted = () => muted;

const IDLE_RPM = 900, REDLINE_RPM = 6500;
const GEARS = [0, 0.18, 0.38, 0.6, 0.8, 1.0001]; // wheel-speed boundaries of 5 gears
let gear = 0;
/** wheelSpeed01: wheel speed 0..1 (drives virtual gearbox -> RPM). throttle: 0..1 (boolean accepted). */
export function engine(wheelSpeed01: number, throttle: number | boolean, on: boolean) {
  if (!ctx || !eng) return;
  const t = ctx.currentTime;
  const th = Math.min(1, Math.max(0, typeof throttle === 'boolean' ? (throttle ? 1 : 0) : (throttle || 0)));
  const s = Math.min(1, Math.max(0, wheelSpeed01 || 0));
  while (gear < 4 && s > GEARS[gear + 1]) gear++;
  while (gear > 0 && s < GEARS[gear] - 0.03) gear--;
  const frac = Math.min(1, Math.max(0, (s - GEARS[gear]) / (GEARS[gear + 1] - GEARS[gear])));
  const lo = gear === 0 ? IDLE_RPM : 2400;
  let rpm = lo + frac * (REDLINE_RPM - lo);
  rpm = Math.max(rpm, IDLE_RPM + th * 1400); // revving at standstill
  const rr = (rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM);
  const fire = rpm / 60 * 2;
  const tc = 0.07;
  eng.saw.frequency.setTargetAtTime(fire, t, tc);
  eng.sq.frequency.setTargetAtTime(fire / 2, t, tc);
  eng.am.frequency.setTargetAtTime(fire, t, tc);
  eng.whine.frequency.setTargetAtTime(fire * 5, t, tc);
  eng.whineGain.gain.setTargetAtTime(on ? 0.05 * rr * (0.3 + th) : 0, t, 0.1);
  eng.lp.frequency.setTargetAtTime((300 + rr * 900 + th * 1600) * (th > 0.05 ? 1 : 0.7), t, 0.08);
  const idle = Math.max(0, 1 - rr * 3) * (1 - th * 0.6);
  eng.lumpAmt.gain.setTargetAtTime(0.1 + 0.3 * idle, t, 0.2);
  eng.lump.frequency.setTargetAtTime(5 + rr * 4, t, 0.2);
  eng.out.gain.setTargetAtTime(on ? 0.035 + 0.06 * th + 0.02 * rr : 0, t, 0.09);
}
let windSrc: AudioBufferSourceNode | null = null, windGain: GainNode | null = null;
export function wind(level: number) {
  if (!ctx) return;
  if (!windSrc) {
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0; windSrc.connect(f); f.connect(windGain); windGain.connect(master); windSrc.start();
  }
  windGain!.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.4);
}
export function ufoHum(on: boolean, p = 0) {
  if (!ctx) return; const t = ctx.currentTime;
  ufoOsc.frequency.setTargetAtTime(180 + Math.sin(t * 7) * 20 + p * 60, t, 0.05);
  ufoGain.gain.setTargetAtTime(on ? 0.07 : 0, t, 0.15);
}
function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.2, freq = 800, delay = 0, type: BiquadFilterType = 'lowpass') {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export const sfx = {
  click: () => tone(660, 0.08, 'square', 0.08),
  thump: (v = 1) => { tone(90, 0.12, 'sine', 0.25 * v, -50); noise(0.08, 0.12 * v, 500); },
  knock: (v = 1) => { tone(180 + Math.random() * 60, 0.07, 'triangle', 0.16 * v, -80); noise(0.04, 0.08 * v, 1800); },
  glass: () => { noise(0.25, 0.3, 6000); [1800, 2400, 3100].forEach((f, i) => tone(f, 0.25, 'sine', 0.06, -300, i * 0.03)); },
  whistle: () => { tone(1500, 1.55, 'sine', 0.05, -1200); },
  energy: () => { tone(440, 0.12, 'square', 0.08, 440); tone(880, 0.2, 'square', 0.08, 440, 0.08); },
  drop: () => { tone(300, 0.35, 'triangle', 0.2, -220); },
  coin: () => { tone(988, 0.07, 'square', 0.07); tone(1319, 0.14, 'square', 0.07, 0, 0.06); },
  boom: () => { noise(0.6, 0.5, 400); tone(70, 0.5, 'sine', 0.4, -40); },
  whoosh: () => { tone(900, 1.4, 'sawtooth', 0.04, -700); },
  splat: () => { noise(0.18, 0.25, 1500); tone(200, 0.15, 'sine', 0.15, 200); },
  squash: () => { noise(0.12, 0.2, 2000); tone(520, 0.12, 'square', 0.1, 300); },
  land: (v = 1) => { tone(110, 0.18, 'sine', 0.15 + 0.25 * v, -60); noise(0.12, 0.08 + 0.15 * v, 400); },
  shield: () => { tone(500, 0.4, 'sine', 0.2, 500); tone(1000, 0.4, 'sine', 0.1, -500, 0.05); },
  turbo: () => { noise(0.5, 0.15, 3000); tone(200, 0.5, 'sawtooth', 0.08, 400); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, 0, i * 0.12)); },
  fail: () => { [400, 330, 260, 190].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.1, 0, i * 0.14)); },
  shatter: () => {
    noise(0.05, 0.3, 2500, 0, 'bandpass'); noise(0.12, 0.25, 1200, 0.02, 'bandpass');
    for (let i = 0; i < 5; i++) { const d = 0.01 + i * 0.03 + Math.random() * 0.02; tone(250 + Math.random() * 500, 0.04, 'square', 0.07, -100, d); noise(0.03, 0.14, 1500 + Math.random() * 2500, d, 'bandpass'); }
    tone(110, 0.12, 'triangle', 0.2, -50);
    for (let i = 0; i < 7; i++) noise(0.025, 0.07, 900 + Math.random() * 2000, 0.18 + i * 0.045 + Math.random() * 0.03, 'bandpass');
  },
  latch: () => { noise(0.1, 0.22, 900); tone(320, 0.12, 'sine', 0.2, -200); tone(180, 0.1, 'sine', 0.1, 220, 0.06); tone(420, 0.05, 'sine', 0.06, 200, 0.14); },
  alien: () => { tone(900, 0.09, 'sine', 0.1, 700); tone(1700, 0.1, 'sine', 0.09, -900, 0.09); tone(1000, 0.08, 'triangle', 0.06, 600, 0.2); },
  star: (i = 0) => tone(660 + i * 220, 0.3, 'triangle', 0.2),
  // UI: physical button press/release, pop-ins, short whoosh for transitions, coin counter tick, purchase ding
  press: () => { tone(320, 0.05, 'triangle', 0.12, -120); noise(0.03, 0.06, 1800); },
  release: () => { tone(620, 0.06, 'triangle', 0.1, 180); },
  pop: () => { tone(420, 0.09, 'sine', 0.18, 520); },
  swoosh: () => { noise(0.22, 0.12, 900, 0, 'bandpass'); tone(500, 0.2, 'sine', 0.04, -260); },
  tick: () => tone(1500, 0.03, 'square', 0.04),
  ding: () => { tone(1047, 0.25, 'triangle', 0.16); tone(1568, 0.35, 'triangle', 0.12, 0, 0.07); },
};
