/* Pure Web Audio manager — every sound is synthesized in the browser.
   No audio files, no external requests, no libraries. */

export type AudioState = "stopped" | "playing" | "paused";

const MUSIC_LEVEL = 0.35;

const NOTE_A2 = 110;
const NOTE_E3 = 164.81;
const NOTE_A3 = 220;
const PLUCK_SCALE = [220, 261.63, 293.66, 329.63, 392, 440];

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicNodes: Array<OscillatorNode | AudioBufferSourceNode> = [];
  private pluckTimer: number | null = null;
  private _volume = 0.7;
  private _state: AudioState = "stopped";

  get state(): AudioState {
    return this._state;
  }

  get volume(): number {
    return this._volume;
  }

  /** Create/resume the context — call only from a user gesture. */
  private async ensure(): Promise<AudioContext | null> {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = MUSIC_LEVEL;
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 1;
        this.sfxBus.connect(this.master);
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return this.ctx;
    } catch (err) {
      console.error("AUDIO: init failed", err);
      return null;
    }
  }

  /* ------------------------------ music ------------------------------ */

  private buildMusic() {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    this.teardownMusic();

    // ambient drone: three detuned oscillators through a slow-breathing filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.8;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
    filter.connect(droneGain);
    droneGain.connect(bus);

    for (const [freq, type, g] of [
      [NOTE_A2, "sine", 0.5],
      [NOTE_E3, "triangle", 0.28],
      [NOTE_A3, "sine", 0.18],
    ] as Array<[number, OscillatorType, number]>) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = Math.random() * 8 - 4;
      const og = ctx.createGain();
      og.gain.value = g;
      osc.connect(og);
      og.connect(filter);
      osc.start();
      this.musicNodes.push(osc);
    }
    this.musicNodes.push(lfo);

    // slow pentatonic plucks
    const pluck = () => {
      if (!this.ctx || this._state !== "playing") return;
      const c = this.ctx;
      const t0 = c.currentTime;
      const f = PLUCK_SCALE[Math.floor(Math.random() * PLUCK_SCALE.length)];
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
      osc.connect(g);
      g.connect(this.musicBus!);
      osc.start(t0);
      osc.stop(t0 + 1.9);
      this.pluckTimer = window.setTimeout(pluck, 1600 + Math.random() * 1400);
    };
    this.pluckTimer = window.setTimeout(pluck, 900);
  }

  private teardownMusic() {
    for (const n of this.musicNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.musicNodes = [];
    if (this.pluckTimer !== null) {
      clearTimeout(this.pluckTimer);
      this.pluckTimer = null;
    }
  }

  /* ------------------------------ transport ------------------------------ */

  /** Start background music (idempotent; safe to call on every user gesture). */
  async play(): Promise<void> {
    const ctx = await this.ensure();
    if (!ctx) return;
    if (this._state === "playing") return;
    this._state = "playing";
    this.buildMusic();
  }

  /** Pause music at its current position; SFX stay available. */
  pause(): void {
    if (this._state !== "playing") return;
    this._state = "paused";
    this.teardownMusic(); // ambient pad has no meaningful position — fade out
  }

  /** Stop music and reset it to the beginning. */
  stop(): void {
    if (this._state === "stopped") return;
    this._state = "stopped";
    this.teardownMusic();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  volumeUp(): void {
    this.setVolume(Math.round((this.volume + 0.1) * 10) / 10);
  }

  volumeDown(): void {
    this.setVolume(Math.round((this.volume - 0.1) * 10) / 10);
  }

  /* ------------------------------ SFX ------------------------------ */

  private sfxReady(): boolean {
    return !!this.ctx && !!this.sfxBus && this.ctx.state === "running";
  }

  /** Star collected — bright sparkle ding. */
  star(): void {
    if (!this.sfxReady()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t0);
    o.frequency.exponentialRampToValueAtTime(1760, t0 + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.65, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    o.connect(g);
    g.connect(this.sfxBus!);
    o.start(t0);
    o.stop(t0 + 0.42);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 2637;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0 + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.18, t0 + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o2.connect(g2);
    g2.connect(this.sfxBus!);
    o2.start(t0 + 0.02);
    o2.stop(t0 + 0.3);
  }

  /** Meteor collision — low impact thud + noise burst. */
  hit(): void {
    if (!this.sfxReady()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(190, t0);
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.22);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfxBus!);
    o.start(t0);
    o.stop(t0 + 0.44);

    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.value = 0.3;
    src.connect(nf);
    nf.connect(ng);
    ng.connect(this.sfxBus!);
    src.start(t0);
  }

  /** Shield activation — soft rising sci-fi chime. */
  shield(): void {
    if (!this.sfxReady()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(840, t0 + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    o.connect(g);
    g.connect(this.sfxBus!);
    o.start(t0);
    o.stop(t0 + 0.52);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 1260;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0 + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.14, t0 + 0.09);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    o2.connect(g2);
    g2.connect(this.sfxBus!);
    o2.start(t0 + 0.05);
    o2.stop(t0 + 0.42);
  }

  /** Boost — short upward thrust sweep. */
  boost(): void {
    if (!this.sfxReady()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(170, t0);
    o.frequency.exponentialRampToValueAtTime(540, t0 + 0.3);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500, t0);
    f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.48);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfxBus!);
    o.start(t0);
    o.stop(t0 + 0.5);
  }

  dispose(): void {
    this.teardownMusic();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.sfxBus = null;
    }
    this._state = "stopped";
  }
}

export const audio = new AudioManager();
