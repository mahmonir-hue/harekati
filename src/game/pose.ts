/* ------------------------------------------------------------------ */
/*  Teachable Machine pose controller                                  */
/*  Model: https://teachablemachine.withgoogle.com/models/g5GrIpxSy/   */
/*                                                                     */
/*  Class 1 (index 0) = move LEFT      Class 3 (index 2) = SHIELD      */
/*  Class 2 (index 1) = move RIGHT     Class 4 (index 3) = BOOST       */
/* ------------------------------------------------------------------ */

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/";
const THRESHOLD = 0.72; // 70–75% band, per spec
const HOLD_FLOOR = 0.55; // hysteresis: keep a class while above this
const SMOOTHING = 0.42; // EMA weight for a new sample (light smoothing)
const UI_INTERVAL = 120; // ms between HUD updates
const SHIELD_COOLDOWN = 2200; // ms — no re-trigger spam from one pose
const BOOST_COOLDOWN = 850;

export type PoseStatus = "idle" | "loading" | "ready" | "denied" | "error";

export interface PoseHandlers {
  onStatus: (status: PoseStatus) => void;
  /** topIndex = -1 when nothing crosses the threshold */
  onDetection: (topIndex: number, confidence: number, locked: boolean) => void;
  onMove: (dir: "left" | "right" | null) => void;
  onAction: (action: "shield" | "boost") => void;
}

export class PoseController {
  private h: PoseHandlers;
  private model: any = null;
  private webcam: any = null;
  private raf = 0;
  private smoothed = [0.25, 0.25, 0.25, 0.25];
  private active = -1;
  private lastShieldAt = -1e9;
  private lastBoostAt = -1e9;
  private lastUiAt = 0;
  private errorStreak = 0;
  private host: HTMLElement | null = null;

  cameraStarted = false;
  status: PoseStatus = "idle";

  constructor(handlers: PoseHandlers) {
    this.h = handlers;
  }

  private setStatus(s: PoseStatus) {
    this.status = s;
    this.h.onStatus(s);
  }

  /** Loads model.json + metadata.json. Safe to call repeatedly. */
  async init() {
    if (this.model) return;
    this.setStatus("loading");
    try {
      this.model = await tmPose.load(MODEL_URL + "model.json");
      this.setStatus("idle");
    } catch (err) {
      console.error("Failed to load pose model:", err);
      this.model = null;
      this.setStatus("error");
    }
  }

  /** Requests webcam permission and starts the prediction loop. */
  async startCamera(host: HTMLElement) {
    if (this.cameraStarted) return;
    if (!this.model) await this.init();
    if (!this.model) return; // model failed; keyboard fallback still works
    this.setStatus("loading");
    try {
      this.webcam = new tmPose.Webcam(220, 220, true);
      await this.webcam.setup();
      await this.webcam.play();
      this.host = host;
      host.appendChild(this.webcam.canvas);
      this.cameraStarted = true;
      this.setStatus("ready");
      this.raf = requestAnimationFrame(this.loop);
    } catch (err) {
      console.error("Webcam unavailable:", err);
      this.webcam = null;
      this.cameraStarted = false;
      this.setStatus("denied");
    }
  }

  private loop = async () => {
    if (!this.cameraStarted) return;
    this.raf = requestAnimationFrame(this.loop);
    try {
      this.webcam.update();
      const { posenetOutput } = await this.webcam.estimatePose(this.webcam.canvas);
      const { posePredictions } = await this.model.predict(posenetOutput);
      this.errorStreak = 0;

      const probs: number[] = posePredictions.map((p: any) => p.probability);
      for (let i = 0; i < this.smoothed.length; i++) {
        const p = probs[i] ?? 0;
        this.smoothed[i] += (p - this.smoothed[i]) * SMOOTHING;
      }

      let top = -1;
      let topP = 0;
      for (let i = 0; i < this.smoothed.length; i++) {
        if (this.smoothed[i] > topP) {
          topP = this.smoothed[i];
          top = i;
        }
      }

      // classify with hysteresis so fast prediction flips don't shake the ship
      let idx = -1;
      if (top >= 0 && topP >= THRESHOLD) idx = top;
      else if (this.active >= 0 && this.smoothed[this.active] >= HOLD_FLOOR) idx = this.active;

      const now = performance.now();
      if (idx === 2 && this.active !== 2 && now - this.lastShieldAt > SHIELD_COOLDOWN) {
        this.lastShieldAt = now;
        this.h.onAction("shield");
      }
      if (idx === 3 && this.active !== 3 && now - this.lastBoostAt > BOOST_COOLDOWN) {
        this.lastBoostAt = now;
        this.h.onAction("boost");
      }

      this.active = idx;
      this.h.onMove(idx === 0 ? "left" : idx === 1 ? "right" : null);

      if (now - this.lastUiAt > UI_INTERVAL) {
        this.lastUiAt = now;
        this.h.onDetection(top, topP, idx !== -1);
      }
    } catch (err) {
      this.errorStreak += 1;
      if (this.errorStreak === 20) {
        console.error("Pose prediction error:", err);
        this.setStatus("error");
      }
    }
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cameraStarted = false;
    try {
      this.webcam?.stop();
    } catch {
      /* noop */
    }
    if (this.webcam?.canvas?.parentNode) {
      this.webcam.canvas.parentNode.removeChild(this.webcam.canvas);
    }
    this.webcam = null;
    this.host = null;
  }
}
