/** Synthesised WebAudio sounds (no audio files): toy tower sounds, wind-up ratchet, dust pops, horn, jingle, UI clicks. */
let ctx: AudioContext | null = null, master: GainNode | null = null, muted = false, adMuted = false;
export function initAudio() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; } try { ctx = new AudioContext(); master = ctx.createGain(); master.connect(ctx.destination); apply(); } catch { ctx = null; } }
const apply = () => { if (master) master.gain.value = muted || adMuted ? 0 : 0.7; };
export const setMuted = (m: boolean) => { muted = m; apply(); }; export const isMuted = () => muted; export const setAdMuted = (m: boolean) => { adMuted = m; apply(); };
let lastAt: Record<string, number> = {};
/** rate-limit a sound so 150 enemies don't make 150 pops per frame */
const ok = (k: string, gap: number) => { if (!ctx) return false; const n = ctx.currentTime; if ((lastAt[k] ?? -1) > n - gap) return false; lastAt[k] = n; return true; };
function tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.2, slide = 0, delay = 0) {
  if (!ctx || !master) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
let nb: AudioBuffer | null = null;
function noise(d: number, v = 0.2, f = 1200, type: BiquadFilterType = 'bandpass', delay = 0) {
  if (!ctx || !master) return; if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const a = nb.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; fl.type = type; fl.frequency.value = f; fl.Q.value = 1.2;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
}
export const sfx = {
  press: () => { tone(380, 0.05, 'triangle', 0.12, -140); noise(0.03, 0.08, 2600); },
  release: () => { tone(720, 0.05, 'triangle', 0.1, 160); },
  cork: () => { if (ok('cork', 0.05)) { noise(0.05, 0.18, 1800); tone(900, 0.06, 'square', 0.05, -500); } },
  clack: () => { if (ok('clack', 0.08)) { tone(520, 0.05, 'square', 0.1, -200); noise(0.04, 0.15, 3000); tone(380, 0.05, 'square', 0.08, -100, 0.05); } },
  blub: () => { if (ok('blub', 0.06)) tone(300, 0.12, 'sine', 0.14, 500); },
  twang: () => { if (ok('twang', 0.08)) { tone(180, 0.25, 'sawtooth', 0.08, -60); tone(360, 0.18, 'triangle', 0.06, -120); } },
  whoosh: () => { if (ok('whoosh', 0.08)) noise(0.2, 0.12, 900, 'bandpass'); },
  ratchet: () => { for (let i = 0; i < 6; i++) { noise(0.02, 0.18, 3500, 'highpass', i * 0.05); tone(1400, 0.02, 'square', 0.03, 0, i * 0.05); } },
  pop: () => { if (ok('pop', 0.04)) { tone(260 + Math.random() * 120, 0.08, 'sine', 0.16, 300); noise(0.06, 0.08, 800); } },
  coin: () => { if (ok('coin', 0.05)) { tone(1320, 0.06, 'square', 0.05); tone(1760, 0.1, 'square', 0.05, 0, 0.05); } },
  horn: () => { tone(196, 0.5, 'sawtooth', 0.09, 0); tone(247, 0.5, 'sawtooth', 0.07, 0, 0.05); },
  leak: () => { if (ok('leak', 0.2)) tone(330, 0.3, 'triangle', 0.14, -180); },
  boom: () => { noise(0.4, 0.4, 300, 'lowpass'); tone(80, 0.4, 'sine', 0.3, -40); },
  flash: () => { tone(880, 0.6, 'sine', 0.1, 600); tone(1320, 0.5, 'sine', 0.06, 400, 0.05); },
  jingle: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, 0, i * 0.11)); },
  sad: () => { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, -20, i * 0.18)); },
  star: (i = 0) => tone(660 + i * 220, 0.3, 'triangle', 0.18),
  tick: () => tone(1500, 0.03, 'square', 0.04),
  slap: () => { noise(0.08, 0.25, 1400); tone(500, 0.12, 'triangle', 0.1, 400, 0.05); },
};
