import type { VoiceId } from '../physics/Types';

type Formant = [number, number, number];

const VOWELS: Record<string, Formant> = {
  a: [800, 1200, 2500],
  e: [500, 1800, 2500],
  i: [300, 2250, 3000],
  o: [500, 850, 2400],
  u: [350, 700, 2400],
  uh: [620, 1100, 2450],
};

const VOICE_PITCH: Record<VoiceId, number> = {
  slade: 150,
  freckles: 190,
  ninjabot: 210,
  frecklebot: 78,
};

export type GruntType = 'hah' | 'take' | 'pain' | 'ko' | 'hyah';
export type MusicTrack = 'title' | 'stage' | 'facility' | 'boss' | 'versus' | 'victory';

interface TrackDef {
  bpm: number;
  root: number;
  bass: (number | null)[];
  lead: (number | null)[];
  kick: string;
  snare: string;
  hat: string;
  stab: (number[] | null)[];
  wave: OscillatorType;
  leadWave: OscillatorType;
}

const r = null;
const TRACKS: Record<MusicTrack, TrackDef> = {
  title: {
    bpm: 96,
    root: 45,
    bass: [0, r, r, r, 0, r, r, r, 3, r, r, r, 5, r, 3, r, -2, r, r, r, -2, r, r, r, 0, r, r, r, 7, r, 5, r],
    lead: [12, r, r, 15, r, r, 19, r, r, r, 17, r, 15, r, r, r, 10, r, r, 14, r, r, 17, r, 15, r, 14, r, 12, r, r, r],
    kick: 'x.......x.......x.......x.......',
    snare: '........x...............x.......',
    hat: '..x...x...x...x...x...x...x...x.',
    stab: [[0, 3, 7], r, r, r, r, r, r, r, r, r, r, r, r, r, r, r, [-2, 2, 5], r, r, r, r, r, r, r, r, r, r, r, r, r, r, r],
    wave: 'triangle',
    leadWave: 'sine',
  },
  stage: {
    bpm: 136,
    root: 40,
    bass: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 10, 12, 10, 5, 5, 17, 5, 5, 17, 5, 15, 3, 3, 15, 3, 7, 10, 14, 12],
    lead: [r, r, 24, r, 22, r, 19, r, r, r, 22, r, 24, r, 27, r, r, r, 29, r, 27, r, 24, r, 22, r, 19, r, 22, r, r, r],
    kick: 'x...x...x...x...x...x...x...x.x.',
    snare: '....x.......x.......x.......x..x',
    hat: 'x.xxx.xxx.xxx.xxx.xxx.xxx.xxx.xx',
    stab: [[12, 15, 19], r, r, r, r, r, r, r, r, r, r, r, r, r, r, r, [17, 20, 24], r, r, r, r, r, r, r, [15, 19, 22], r, r, r, r, r, r, r],
    wave: 'sawtooth',
    leadWave: 'square',
  },
  facility: {
    bpm: 128,
    root: 38,
    bass: [0, r, 0, 12, r, 0, 13, r, 0, r, 0, 12, r, 10, 7, r, 0, r, 0, 12, r, 0, 13, r, 3, r, 3, 15, r, 13, 10, 7],
    lead: [r, r, r, r, 24, r, 25, r, r, r, r, r, 22, r, 19, r, r, r, r, r, 24, r, 25, r, 27, r, 25, r, 22, r, 19, r],
    kick: 'x..x..x.x..x..x.x..x..x.x..x.xx.',
    snare: '....x.......x.......x.......x...',
    hat: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    stab: [[12, 13, 19], r, r, r, r, r, r, r, r, r, r, r, r, r, r, r, [15, 18, 22], r, r, r, r, r, r, r, r, r, r, r, r, r, r, r],
    wave: 'square',
    leadWave: 'sawtooth',
  },
  boss: {
    bpm: 148,
    root: 38,
    bass: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 5, 5, 3, 1, 0, 0, 0, 0, 1, 1, 0, 0, -2, -2, -2, -2, -4, -4, -5, -5],
    lead: [12, r, 13, r, 15, r, 13, r, 12, r, r, r, 19, r, 17, 15, 12, r, 13, r, 15, r, 17, r, 18, r, 17, r, 15, r, 13, r],
    kick: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxxx',
    snare: '....x.......x.......x.......x.xx',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
    stab: [[0, 3, 7, 12], r, r, r, r, r, r, r, [1, 5, 8, 13], r, r, r, r, r, r, r, [0, 3, 7, 12], r, r, r, r, r, r, r, [-2, 2, 5, 10], r, r, r, [-4, 0, 3, 8], r, r, r],
    wave: 'sawtooth',
    leadWave: 'sawtooth',
  },
  versus: {
    bpm: 142,
    root: 43,
    bass: [0, r, 0, 0, 10, r, 0, r, 0, r, 0, 0, 7, r, 10, r, -4, r, -4, -4, 5, r, -4, r, -2, r, -2, -2, 7, r, 10, r],
    lead: [19, r, 17, r, 15, r, 14, r, 15, r, r, r, 12, r, r, r, 15, r, 14, r, 12, r, 10, r, 12, r, 14, r, 15, r, 17, r],
    kick: 'x...x...x...x...x...x...x...x.x.',
    snare: '....x.......x.......x.......x...',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xx',
    stab: [[12, 15, 19], r, r, r, r, r, r, r, r, r, r, r, r, r, r, r, [8, 12, 15], r, r, r, r, r, r, r, [10, 14, 17], r, r, r, r, r, r, r],
    wave: 'sawtooth',
    leadWave: 'square',
  },
  victory: {
    bpm: 120,
    root: 48,
    bass: [0, r, r, r, 7, r, r, r, 5, r, r, r, 7, r, r, r, 0, r, r, r, 7, r, r, r, 12, r, r, r, r, r, r, r],
    lead: [12, r, 16, r, 19, r, 24, r, 21, r, 19, r, 17, r, 19, r, 24, r, 23, r, 24, r, 26, r, 28, r, r, r, r, r, r, r],
    kick: 'x.......x.......x.......x.......',
    snare: '....x.......x.......x.......x...',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
    stab: [[0, 4, 7], r, r, r, r, r, r, r, [5, 9, 12], r, r, r, r, r, r, r, [0, 4, 7], r, r, r, r, r, r, r, [7, 11, 14], r, r, r, r, r, r, r],
    wave: 'triangle',
    leadWave: 'square',
  },
};

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Fully procedural Web Audio synthesizer. Every sound in the game is generated here; no audio files are loaded.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private comp!: DynamicsCompressorNode;
  muted = false;
  private musicTimer: number | null = null;
  private track: TrackDef | null = null;
  private trackName: MusicTrack | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private lastPlayed = new Map<string, number>();

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.sfxBus.connect(this.comp);
      this.musicBus.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      if (this.trackName) {
        const t = this.trackName;
        this.trackName = null;
        this.startMusic(t);
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  /** Prevents the same effect stacking into a wall of noise when many hits land on one frame. */
  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? 0;
    if (now - last < ms) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private envGain(t: number, attack: number, decay: number, peak: number, dest: AudioNode): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    t = this.now,
    dest: AudioNode = this.sfxBus,
    detune = 0,
  ): OscillatorNode | null {
    if (!this.ctx) return null;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.envGain(t, 0.004, dur, vol, dest);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noise(
    dur: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    vol: number,
    t = this.now,
    dest: AudioNode = this.sfxBus,
    attack = 0.003,
  ): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const bq = this.ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.envGain(t, attack, dur, vol, dest);
    src.connect(bq);
    bq.connect(g);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- combat SFX

  playHitLight(): void {
    if (!this.ctx || !this.throttle('hitL', 30)) return;
    const t = this.now;
    this.tone('square', 1100 + Math.random() * 200, 180, 0.08, 0.22, t);
    this.noise(0.05, 'highpass', 3000, 1500, 0.7, 0.25, t);
  }

  playHitHeavy(): void {
    if (!this.ctx || !this.throttle('hitH', 40)) return;
    const ctx = this.ctx;
    const t = this.now;
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(140, t);
    carrier.frequency.exponentialRampToValueAtTime(38, t + 0.32);
    const mod = ctx.createOscillator();
    mod.frequency.value = 55;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(90, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 0.3);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    const g = this.envGain(t, 0.004, 0.34, 0.55, this.sfxBus);
    carrier.connect(g);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + 0.4);
    mod.stop(t + 0.4);
    this.noise(0.16, 'lowpass', 2400, 300, 0.8, 0.5, t);
    this.tone('square', 420, 90, 0.06, 0.12, t);
  }

  playSlash(): void {
    if (!this.ctx || !this.throttle('slash', 35)) return;
    const t = this.now;
    this.noise(0.16, 'bandpass', 7000, 1400, 9, 0.5, t, this.sfxBus, 0.01);
    this.noise(0.08, 'highpass', 5000, 3000, 1, 0.12, t + 0.02);
  }

  playWhiff(): void {
    if (!this.ctx || !this.throttle('whiff', 40)) return;
    this.noise(0.1, 'bandpass', 1800, 600, 3, 0.18, this.now, this.sfxBus, 0.015);
  }

  playMagic(): void {
    if (!this.ctx || !this.throttle('magic', 60)) return;
    const t = this.now;
    const notes = [659, 880, 1109, 1319, 1760];
    notes.forEach((f, i) => {
      const at = t + i * 0.045;
      this.tone('sine', f, f * 1.01, 0.22, 0.09, at, this.sfxBus, -7);
      this.tone('sine', f, f * 1.01, 0.22, 0.09, at, this.sfxBus, 7);
    });
    this.noise(0.3, 'highpass', 8000, 5000, 1, 0.05, t);
  }

  playJump(): void {
    if (!this.ctx || !this.throttle('jump', 50)) return;
    this.tone('triangle', 190, 620, 0.13, 0.16);
  }

  playLand(): void {
    if (!this.ctx || !this.throttle('land', 50)) return;
    this.tone('sine', 120, 50, 0.08, 0.2);
    this.noise(0.06, 'lowpass', 900, 200, 1, 0.14);
  }

  playDash(): void {
    if (!this.ctx || !this.throttle('dash', 60)) return;
    this.noise(0.22, 'bandpass', 600, 2600, 2, 0.22, this.now, this.sfxBus, 0.03);
  }

  playSpecial(): void {
    if (!this.ctx || !this.throttle('special', 120)) return;
    const ctx = this.ctx;
    const t = this.now;
    this.tone('sine', 110, 28, 0.9, 0.7, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 12;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(4200, t + 0.35);
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.8);
    const g = this.envGain(t, 0.02, 0.8, 0.28, this.sfxBus);
    lp.connect(g);
    for (const d of [-12, 12]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = d;
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(440, t + 0.5);
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.9);
    }
    this.noise(0.5, 'lowpass', 3000, 120, 1, 0.4, t + 0.01);
  }

  playShock(): void {
    if (!this.ctx || !this.throttle('shock', 60)) return;
    const t = this.now;
    for (let i = 0; i < 5; i++) this.tone('square', 1800 - i * 200, 300, 0.04, 0.06, t + i * 0.025);
    this.noise(0.25, 'bandpass', 4000, 800, 4, 0.25, t);
  }

  playCharge(): void {
    if (!this.ctx || !this.throttle('charge', 200)) return;
    this.tone('sawtooth', 80, 700, 0.55, 0.1);
    this.tone('square', 81, 705, 0.55, 0.05);
  }

  playShuriken(): void {
    if (!this.ctx || !this.throttle('shuriken', 40)) return;
    const t = this.now;
    this.noise(0.12, 'bandpass', 5000, 9000, 12, 0.2, t);
    this.tone('triangle', 2400, 3200, 0.08, 0.05, t);
  }

  playClank(): void {
    if (!this.ctx || !this.throttle('clank', 40)) return;
    const t = this.now;
    this.tone('square', 1900, 1700, 0.12, 0.1, t);
    this.tone('square', 2530, 2400, 0.1, 0.07, t);
    this.noise(0.05, 'highpass', 6000, 4000, 1, 0.12, t);
  }

  playBlock(): void {
    if (!this.ctx || !this.throttle('block', 40)) return;
    this.tone('square', 500, 300, 0.06, 0.12);
    this.noise(0.05, 'bandpass', 2000, 1500, 2, 0.15);
  }

  playSmoke(): void {
    if (!this.ctx || !this.throttle('smoke', 80)) return;
    this.noise(0.35, 'lowpass', 2500, 300, 1, 0.3, this.now, this.sfxBus, 0.02);
    this.tone('sine', 300, 900, 0.1, 0.06);
  }

  playDebris(): void {
    if (!this.ctx || !this.throttle('debris', 90)) return;
    const t = this.now;
    for (let i = 0; i < 6; i++) this.noise(0.05, 'bandpass', 900 + Math.random() * 1500, 400, 3, 0.16, t + i * 0.04);
  }

  playExplode(): void {
    if (!this.ctx || !this.throttle('explode', 80)) return;
    const t = this.now;
    this.noise(0.6, 'lowpass', 1800, 80, 1, 0.6, t);
    this.tone('sine', 90, 30, 0.5, 0.5, t);
  }

  // ---------------------------------------------------------------- UI SFX

  playSelect(): void {
    if (!this.ctx) return;
    this.tone('square', 660, 660, 0.05, 0.08);
  }

  playConfirm(): void {
    if (!this.ctx) return;
    const t = this.now;
    this.tone('square', 523, 523, 0.07, 0.1, t);
    this.tone('square', 784, 784, 0.12, 0.1, t + 0.07);
  }

  playBack(): void {
    if (!this.ctx) return;
    this.tone('square', 440, 220, 0.12, 0.08);
  }

  playGo(): void {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      this.tone('square', 988, 988, 0.1, 0.12, t + i * 0.22);
      this.tone('square', 1319, 1319, 0.1, 0.07, t + i * 0.22 + 0.1);
    }
  }

  playWarning(): void {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 2; i++) this.tone('sawtooth', 440, 330, 0.2, 0.1, t + i * 0.25);
  }

  playBell(): void {
    if (!this.ctx) return;
    const t = this.now;
    for (const [f, v] of [
      [880, 0.22],
      [1760, 0.1],
      [2640, 0.06],
      [1320, 0.08],
    ] as const) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.envGain(t, 0.002, 1.3, v, this.sfxBus);
      o.connect(g);
      o.start(t);
      o.stop(t + 1.4);
    }
  }

  playKO(): void {
    if (!this.ctx) return;
    const t = this.now;
    this.tone('sine', 220, 30, 1.2, 0.5, t);
    this.noise(1.0, 'lowpass', 1500, 60, 1, 0.4, t);
    this.tone('sawtooth', 330, 110, 0.9, 0.1, t + 0.05);
  }

  playPickup(): void {
    if (!this.ctx) return;
    const t = this.now;
    [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.08, 0.1, t + i * 0.05));
  }

  // ---------------------------------------------------------------- formant voice

  private syllable(
    t: number,
    p0: number,
    p1: number,
    dur: number,
    vowel: Formant,
    vowelEnd: Formant | null,
    vol: number,
    robot: boolean,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createOscillator();
    src.type = robot ? 'square' : 'sawtooth';
    src.frequency.setValueAtTime(p0, t);
    src.frequency.exponentialRampToValueAtTime(Math.max(40, p1), t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = robot ? 38 : 5.5;
    const vibG = ctx.createGain();
    vibG.gain.value = robot ? p0 * 0.25 : p0 * 0.02;
    vib.connect(vibG);
    vibG.connect(src.frequency);

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(vol, t + 0.02);
    out.gain.setValueAtTime(vol, t + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.sfxBus);

    const weights = [1, 0.55, 0.25];
    for (let i = 0; i < 3; i++) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 9 + i * 3;
      bp.frequency.setValueAtTime(vowel[i], t);
      if (vowelEnd) bp.frequency.linearRampToValueAtTime(vowelEnd[i], t + dur);
      const g = ctx.createGain();
      g.gain.value = weights[i] * 3.2;
      src.connect(bp);
      bp.connect(g);
      g.connect(out);
    }
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  private consonant(t: number, kind: 'h' | 't' | 'k' | 's' | 'th' | 'y', vol: number): void {
    switch (kind) {
      case 'h':
        this.noise(0.06, 'bandpass', 1500, 1200, 1, vol * 0.5, t);
        break;
      case 't':
        this.noise(0.025, 'highpass', 3500, 3000, 1, vol * 0.8, t, this.sfxBus, 0.001);
        break;
      case 'k':
        this.noise(0.03, 'bandpass', 2200, 1800, 2, vol * 0.8, t, this.sfxBus, 0.001);
        break;
      case 's':
        this.noise(0.12, 'highpass', 5500, 6000, 1, vol * 0.45, t, this.sfxBus, 0.01);
        break;
      case 'th':
        this.noise(0.04, 'bandpass', 4500, 4000, 1, vol * 0.3, t);
        break;
      case 'y':
        break;
    }
  }

  /** Retro formant-synthesised voice clips: "Hah!", "Take this!", pain grunts and KO screams. */
  playVoiceGrunt(char: VoiceId, type: GruntType): void {
    if (!this.ctx || !this.throttle(`voice-${char}`, type === 'pain' ? 180 : 120)) return;
    const robot = char === 'ninjabot' || char === 'frecklebot';
    const p = VOICE_PITCH[char] * (0.95 + Math.random() * 0.1);
    const t = this.now + 0.005;
    const vol = robot ? 0.16 : 0.22;
    switch (type) {
      case 'hah':
        this.consonant(t, 'h', vol);
        this.syllable(t + 0.03, p * 1.35, p * 0.95, 0.17, VOWELS.a, VOWELS.uh, vol, robot);
        break;
      case 'hyah':
        this.consonant(t, 'h', vol);
        this.syllable(t + 0.02, p * 1.2, p * 1.55, 0.08, VOWELS.i, VOWELS.a, vol, robot);
        this.syllable(t + 0.1, p * 1.55, p * 1.0, 0.16, VOWELS.a, VOWELS.uh, vol, robot);
        break;
      case 'take':
        this.consonant(t, 't', vol);
        this.syllable(t + 0.02, p * 1.25, p * 1.35, 0.13, VOWELS.e, VOWELS.i, vol, robot);
        this.consonant(t + 0.16, 'k', vol);
        this.consonant(t + 0.21, 'th', vol);
        this.syllable(t + 0.22, p * 1.5, p * 1.15, 0.14, VOWELS.i, VOWELS.i, vol, robot);
        this.consonant(t + 0.34, 's', vol);
        break;
      case 'pain':
        this.consonant(t, 'h', vol * 0.6);
        this.syllable(t + 0.02, p * 1.25, p * 0.7, 0.2, VOWELS.uh, VOWELS.u, vol * 0.9, robot);
        break;
      case 'ko':
        this.syllable(t, p * 1.6, p * 0.45, 0.75, VOWELS.a, VOWELS.o, vol, robot);
        break;
    }
  }

  // ---------------------------------------------------------------- music

  startMusic(name: MusicTrack): void {
    if (this.trackName === name && this.musicTimer !== null) return;
    this.stopMusic();
    this.trackName = name;
    if (!this.ctx) return;
    this.track = TRACKS[name];
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.track = null;
    this.trackName = null;
  }

  private schedule(): void {
    if (!this.ctx || !this.track) return;
    const tr = this.track;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playStep(tr, this.step % 32, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  private playStep(tr: TrackDef, s: number, t: number, stepDur: number): void {
    const bus = this.musicBus;
    const bass = tr.bass[s];
    if (bass !== null && bass !== undefined) {
      const f = midiToHz(tr.root + bass);
      this.tone(tr.wave, f, f, stepDur * 1.6, 0.35, t, bus);
      this.tone('sine', f / 2, f / 2, stepDur * 1.8, 0.3, t, bus);
    }
    const lead = tr.lead[s];
    if (lead !== null && lead !== undefined) {
      const f = midiToHz(tr.root + 12 + lead);
      this.tone(tr.leadWave, f, f, stepDur * 2.4, 0.09, t, bus, -6);
      this.tone(tr.leadWave, f, f, stepDur * 2.4, 0.07, t, bus, 6);
    }
    const stab = tr.stab[s];
    if (stab) {
      for (const n of stab) {
        const f = midiToHz(tr.root + 12 + n);
        this.tone('sawtooth', f, f, stepDur * 6, 0.05, t, bus, 9);
      }
    }
    if (tr.kick[s] === 'x') {
      this.tone('sine', 150, 42, 0.16, 0.8, t, bus);
    }
    if (tr.snare[s] === 'x') {
      this.noise(0.14, 'bandpass', 1800, 1200, 0.8, 0.45, t, bus);
      this.tone('triangle', 220, 160, 0.08, 0.2, t, bus);
    }
    if (tr.hat[s] === 'x') {
      this.noise(0.03, 'highpass', 8000, 9000, 1, 0.12, t, bus);
    }
  }
}
