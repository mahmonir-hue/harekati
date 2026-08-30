/* ------------------------------------------------------------------ */
/*  Game audio — 100% generated with the browser Web Audio API.        */
/*  No MP3 files, no audio libraries, no network requests.             */
/*                                                                     */
/*  Music : soft ambient pad (A minor) + slow drifting pentatonic      */
/*          plucks, low volume, loops while playing.                   */
/*  SFX   : star ding · meteor impact · shield chime · boost riser     */
/*                                                                     */
/*  One master volume (0..1, step 0.1) scales music AND effects, so    */
/*  volume 0 effectively mutes everything.                             */
/* ------------------------------------------------------------------ */

export type AudioState = "stopped" | "paused" | "playing";

const MUSIC_BUS = 0.35; // background music is quieter than SFX
const PLUCK_INTERVAL = 2300; // ms between melody notes
const PLUCK_SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880]; // A C D E G A

class AudioManager {
  state: AudioState = "stopped";
  private _volume = 0.7;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private padOscs: OscillatorNode[] = [];
  private padNodes: AudioNode[] = [];
  private padGain: GainNode | null = null;
  private pluckTimer: ReturnType<typeof setInterval> | null = null;

  get volume(): number {
    return this._volume;
  }

  /* ------------------------------ context ------------------------------ */

  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const w = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AC = w.AudioContext ?? w.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      const master = ctx.createGain();
      const musicBus = ctx.createGain();
      const sfxBus = ctx.createGain();
      master.gain.value = this._volume;
      musicBus.gain.value = MUSIC_BUS;
      sfxBus.gain.value = 1;
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.musicBus = musicBus;
      this.sfxBus = sfxBus;
      return true;
    } catch (err) {
      console.error("AUDIO ERROR: Web Audio unavailable", err);
      return false;
    }
  }

  /* ------------------------ transport (music) ------------------------ */

  /** Start / resume the looping ambient music. Must be called from a user gesture. */
  async play(): Promise<void> {
    if (!this.ensure() || !this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    if (this.state === "playing") return;
    // from "stopped" or "paused": (re)build the ambient graph — SFX never affected
    this.startMusic();
    this.state = "playing";
  }

  /** Pause the music — fades the pad out and halts the melody (SFX keep working). */
  pause(): void {
    if (this.state !== "playing") return;
    this.teardownMusic();
    this.state = "paused";
  }

  /** Stop the music and reset it to the beginning (SFX keep working). */
  stop(): void {
    this.teardownMusic();
    this.state = "stopped";
  }

  /* ------------------------------ volume ------------------------------ */

  volumeUp(): void {
    this.setVolume(this._volume + 0.1);
  }

  volumeDown(): void {
    this.setVolume(this._volume - 0.1);
  }

  setVolume(v: number): void {
    this._volume = Math.min(1, Math.max(0, Math.round(v * 10) / 10));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.02);
    }
  }

  /* --------------------------- music graph --------------------------- */

  private startMusic(): void {
    const ctx = this.ctx!;
    this.teardownMusic();

    const padGain = ctx.createGain();
    padGain.gain.value = 0.0001;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.7;

    // slow filter drift keeps the pad alive
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 170;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    // gentle breathing of the whole pad
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.11;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.16;
    breath.connect(breathDepth);
    breathDepth.connect(padGain.gain);

    // A-minor pad: A2 + E3 + A3, slightly detuned
    const voices: Array<[number, OscillatorType, number]> = [
      [110.0, "sine", 0.16],
      [164.81, "triangle", 0.1],
      [220.0, "sine", 0.09],
    ];
    for (const [freq, type, gain] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(padGain);
      osc.start();
      this.padOscs.push(osc);
      this.padNodes.push(g);
    }

    padGain.connect(filter);
    filter.connect(this.musicBus!);
    padGain.gain.setTargetAtTime(0.55, ctx.currentTime, 1.4); // slow fade-in

    lfo.start();
    breath.start();
    this.padOscs.push(lfo, breath);
    this.padNodes.push(lfoDepth, breathDepth, filter, padGain);
    this.padGain = padGain;

    // drifting melody: one soft pluck every ~2.3 s (occasionally resting)
    this.pluck();
    this.pluckTimer = setInterval(() => this.pluck(), PLUCK_INTERVAL);
  }

  private pluck(): void {
    if (!this.ctx || this.state !== "playing") return;
    if (Math.random() < 0.3) return; // airy gaps
    const t = this.ctx.currentTime;
    const freq = PLUCK_SCALE[Math.floor(Math.random() * PLUCK_SCALE.length)];
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    osc.connect(g);
    g.connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + 2);
  }

  private teardownMusic(): void {
    if (this.pluckTimer) {
      clearInterval(this.pluckTimer);
      this.pluckTimer = null;
    }
    const t = this.ctx?.currentTime ?? 0;
    if (this.padGain && this.ctx) {
      this.padGain.gain.cancelScheduledValues(t);
      this.padGain.gain.setTargetAtTime(0.0001, t, 0.08);
    }
    for (const osc of this.padOscs) {
      try {
        osc.stop(t + 0.5);
      } catch {
        /* already stopped */
      }
    }
    for (const node of this.padNodes) {
      try {
        node.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.padOscs = [];
    this.padNodes = [];
    this.padGain = null;
  }

  /* -------------------------------- SFX -------------------------------- */

  private sfx(build: (ctx: AudioContext, out: GainNode) => void): void {
    if (!this.ensure() || !this.ctx || !this.sfxBus) return;
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    try {
      build(this.ctx, this.sfxBus);
    } catch (err) {
      console.error("AUDIO ERROR: sfx", err);
    }
  }

  /** Star collected — bright sparkle ding. */
  star(): void {
    this.sfx((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1760, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.35);

      const shim = ctx.createOscillator();
      shim.type = "sine";
      shim.frequency.value = 2637;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      shim.connect(g2);
      g2.connect(out);
      shim.start(t + 0.03);
      shim.stop(t + 0.28);
    });
  }

  /** Meteor impact — low thud + short noise burst. */
  hit(): void {
    this.sfx((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.36);

      const len = Math.floor(ctx.sampleRate * 0.16);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const nf = ctx.createBiquadFilter();
      nf.type = "lowpass";
      nf.frequency.value = 620;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.4, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(out);
      noise.start(t);
    });
  }

  /** Shield activated — soft rising sci-fi chime. */
  shield(): void {
    this.sfx((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.24);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.46);

      const fifth = ctx.createOscillator();
      fifth.type = "sine";
      fifth.frequency.setValueAtTime(495, t + 0.05);
      fifth.frequency.exponentialRampToValueAtTime(990, t + 0.26);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.14, t + 0.09);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      fifth.connect(g2);
      g2.connect(out);
      fifth.start(t + 0.05);
      fifth.stop(t + 0.44);
    });
  }

  /** Boost — short upward thrust whoosh. */
  boost(): void {
    this.sfx((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.3);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, t);
      filter.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.36, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(filter);
      filter.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  /* ------------------------------ cleanup ------------------------------ */

  dispose(): void {
    this.teardownMusic();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.state = "stopped";
  }
}

/** Single shared instance for the whole game. */
export const audio = new AudioManager();
