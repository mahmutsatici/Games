let ctx: AudioContext | null = null;
let master: GainNode;
let engOsc: OscillatorNode, engGain: GainNode, ufoOsc: OscillatorNode, ufoGain: GainNode;
let muted = false, adMuted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination); applyMute();
    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engGain = ctx.createGain(); engGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    engOsc.connect(lp); lp.connect(engGain); engGain.connect(master); engOsc.start();
    ufoOsc = ctx.createOscillator(); ufoOsc.type = 'sine'; ufoGain = ctx.createGain(); ufoGain.gain.value = 0;
    ufoOsc.connect(ufoGain); ufoGain.connect(master); ufoOsc.start();
  } catch { ctx = null; }
}
function applyMute() { if (master) master.gain.value = muted || adMuted ? 0 : 0.5; }
export function setMuted(m: boolean) { muted = m; applyMute(); }
export function setAdMuted(m: boolean) { adMuted = m; applyMute(); }
export const isMuted = () => muted;

/** wheelSpeed01: wheel angular speed normalised to 0..1, pitch follows it */
export function engine(wheelSpeed01: number, gas: boolean, on: boolean) {
  if (!ctx) return;
  const t = ctx.currentTime;
  engOsc.frequency.setTargetAtTime(42 + wheelSpeed01 * 120 + (gas ? 14 : 0), t, 0.06);
  engGain.gain.setTargetAtTime(on ? (gas ? 0.09 : 0.035) : 0, t, 0.1);
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
function noise(dur: number, vol = 0.2, freq = 800, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
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
  star: (i = 0) => tone(660 + i * 220, 0.3, 'triangle', 0.2),
};
