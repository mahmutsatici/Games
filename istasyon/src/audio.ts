// Layered WebAudio Synthesizer: evolving station hum, family-specific merge SFX, combo pitch, event stingers, master volume & mute.
import type { FamilyId } from './economy';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layerGains: GainNode[] = [];
  private enabled = true;
  private volume = 0.75;
  private started = false;
  private currentStage = 1;

  init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.applyMasterGain();
      this.masterGain.connect(this.ctx.destination);
      this.startAmbientLayers();
    } catch (e) {
      console.warn('[audio] web audio not supported', e);
    }
  }

  unlock(): void {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private applyMasterGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this.enabled ? this.volume * 0.85 : 0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
    this.applyMasterGain();
    if (val && !this.started) this.startAmbientLayers();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyMasterGain();
  }

  getVolume(): number {
    return this.volume;
  }

  /** Updates the 4 ambient drone layers so the station hum grows richer with milestones. */
  setStationStage(stage: number): void {
    this.currentStage = stage;
    if (!this.ctx || this.layerGains.length === 0) return;
    const now = this.ctx.currentTime;
    const targets = [
      0.06, // Layer 0: 55Hz base reactor hum
      stage >= 2 ? 0.035 : 0, // Layer 1: 110Hz solar wing harmonic
      stage >= 3 ? 0.025 : 0, // Layer 2: 164.8Hz (E3) telemetry fifth
      stage >= 4 ? 0.02 : 0, // Layer 3: 220Hz (A3) habitat shimmer
    ];
    for (let i = 0; i < this.layerGains.length; i++) {
      this.layerGains[i].gain.setTargetAtTime(targets[i] ?? 0, now, 0.4);
    }
  }

  private startAmbientLayers(): void {
    if (!this.ctx || !this.masterGain || this.started) return;
    this.started = true;
    try {
      const freqs = [55, 110, 164.81, 220];
      const types: OscillatorType[] = ['sine', 'triangle', 'sine', 'triangle'];
      for (let i = 0; i < freqs.length; i++) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();

        osc.type = types[i];
        osc.frequency.setValueAtTime(freqs[i], this.ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(160 + i * 90, this.ctx.currentTime);

        g.gain.setValueAtTime(i === 0 ? 0.06 : 0, this.ctx.currentTime);
        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        osc.start();
        this.layerGains.push(g);
      }
      this.setStationStage(this.currentStage);
    } catch {
      /* fallback */
    }
  }

  // --- Family-Specific Merge Sound with Tier + Combo Pitch ---
  playMerge(tier: number, family: FamilyId = 0, combo = 0): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const comboMult = Math.pow(1.06, Math.min(10, combo));
    const baseFreq = 190 * Math.pow(1.075, Math.min(20, tier)) * comboMult;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (family === 0) {
      // Generator: warm turbine power-up sweep
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq * 0.85, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.16);
      osc2.frequency.setValueAtTime(baseFreq * 1.275, now);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.95, now + 0.16);
    } else if (family === 1) {
      // Amplifier: resonant harmonic bell chime
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.18);
      osc2.frequency.setValueAtTime(baseFreq * 2.0, now);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3.0, now + 0.18);
    } else if (family === 2) {
      // Collector: dual-step radar lock chirp
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq * 0.9, now);
      osc1.frequency.setValueAtTime(baseFreq * 1.35, now + 0.06);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.16);
      osc2.frequency.setValueAtTime(baseFreq * 1.8, now);
    } else {
      // Battery: crisp capacitor charge snap
      osc1.type = 'square';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq * 0.75, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.14);
      osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
    }

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(family === 3 ? 0.06 : 0.1, now);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
  }

  // --- Mechanical UI Switch Click ---
  playClick(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // --- Purchase / Upgrade Latch ---
  playBuy(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(783.99, now + 0.05);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // --- Event Stingers (Meteor Shower, Merchant Ship, Solar Flare) ---
  playEvent(kind: 'shower' | 'merchant' | 'flare'): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const notes =
      kind === 'merchant'
        ? [440, 554.37, 659.25, 880]
        : kind === 'flare'
          ? [330, 440, 659.25, 987.77]
          : [587.33, 440, 587.33, 880];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + i * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = kind === 'flare' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.22);
    });
  }

  // --- Coin / Contract / Meteor Chime ---
  playCoin(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + idx * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.22);
    });
  }

  // --- Launch Rumble ---
  playLaunch(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, now);
    osc.frequency.exponentialRampToValueAtTime(170, now + 1.8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, now);
    filter.frequency.linearRampToValueAtTime(650, now + 1.8);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 2.0);
  }
}

export const sound = new SoundManager();
