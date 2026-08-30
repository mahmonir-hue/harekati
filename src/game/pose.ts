/* ------------------------------------------------------------------ */
/*  Teachable Machine pose controller                                  */
/*  Model: https://teachablemachine.withgoogle.com/models/g5GrIpxSy/   */
/*                                                                     */
/*  Class 1 = move LEFT      Class 3 = SHIELD                          */
/*  Class 2 = move RIGHT     Class 4 = BOOST                           */
/*                                                                     */
/*  Pipeline (matches the official TM Pose sample):                    */
/*    tmPose.load(model.json)  ->  model (metadata carries labels)     */
/*    new tmPose.Webcam() -> setup() -> play()                         */
/*    loop: webcam.update() -> estimatePose() -> model.predict()       */
/*          -> Array<{ className, probability }>                       */
/* ------------------------------------------------------------------ */

import type { TmPoseModel, TmPosePrediction, TmPoseWebcam } from "../tm-pose";

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/";
const THRESHOLD = 0.7; // ~70% confidence band, per spec
const HOLD_FLOOR = 0.55; // hysteresis: keep the current class above this
const SMOOTHING = 0.5; // EMA weight for each new sample (light smoothing)
const UI_INTERVAL = 100; // ms between HUD updates
const SHIELD_COOLDOWN = 2000; // ms — one pose triggers one shield, no spam
const BOOST_COOLDOWN = 800;
const FALLBACK_NAMES = ["Class 1", "Class 2", "Class 3", "Class 4"];

export type ModelStatus = "loading" | "ready" | "error";
export type CameraStatus = "off" | "starting" | "on" | "denied";

export interface PoseHandlers {
  onModelStatus: (status: ModelStatus) => void;
  onCameraStatus: (status: CameraStatus) => void;
  /** topIndex = -1 when nothing crosses the threshold */
  onDetection: (topIndex: number, className: string, confidence: number, locked: boolean) => void;
  onMove: (dir: "left" | "right" | null) => void;
  onAction: (action: "shield" | "boost") => void;
}

export class PoseController {
  private h: PoseHandlers;
  private model: TmPoseModel | null = null;
  private webcam: TmPoseWebcam | null = null;
  private raf = 0;
  private smoothed = [0.25, 0.25, 0.25, 0.25];
  private active = -1;
  private lastShieldAt = -1e9;
  private lastBoostAt = -1e9;
  private lastUiAt = 0;
  private errorStreak = 0;
  private host: HTMLElement | null = null;

  classNames: string[] = [...FALLBACK_NAMES];
  cameraStatus: CameraStatus = "off";
  modelStatus: ModelStatus = "loading";

  constructor(handlers: PoseHandlers) {
    this.h = handlers;
  }

  private setModelStatus(s: ModelStatus) {
    this.modelStatus = s;
    this.h.onModelStatus(s);
  }

  private setCameraStatus(s: CameraStatus) {
    this.cameraStatus = s;
    this.h.onCameraStatus(s);
  }

  /** Loads model.json + metadata.json. No webcam permission is requested here. */
  async init(): Promise<boolean> {
    if (this.model) return true;
    this.setModelStatus("loading");
    try {
      this.model = await tmPose.load(MODEL_URL + "model.json");
      const labels = this.model.metadata?.labels;
      if (Array.isArray(labels) && labels.length === 4) {
        this.classNames = labels.map(String);
      }
      this.setModelStatus("ready");
      return true;
    } catch (err) {
      console.error("Failed to load pose model:", err);
      this.model = null;
      this.setModelStatus("error");
      return false;
    }
  }

  /** Map a prediction's className to a class index 0..3 (order-safe). */
  private classIndex(name: string): number {
    const byName = this.classNames.indexOf(name);
    if (byName !== -1) return byName;
    const m = /(\d+)/.exec(name ?? "");
    if (m) return Math.min(3, Math.max(0, parseInt(m[1], 10) - 1));
    return -1;
  }

  /** Requests webcam permission, starts the preview and the prediction loop. */
  async turnOn(host: HTMLElement): Promise<void> {
    if (this.cameraStatus === "on" || this.cameraStatus === "starting") return;
    this.setCameraStatus("starting");
    const modelOk = await this.init();
    if (!modelOk) {
      this.setCameraStatus("off");
      return;
    }
    try {
      if (!this.webcam) {
        this.webcam = new tmPose.Webcam(220, 220, true);
        await this.webcam.setup();
      }
      await this.webcam.play();
      this.host = host;
      host.replaceChildren(this.webcam.canvas);
      // fresh smoothing state so the first pose registers quickly
      this.smoothed = [0.25, 0.25, 0.25, 0.25];
      this.active = -1;
      this.errorStreak = 0;
      this.setCameraStatus("on");
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.loop);
    } catch (err) {
      console.error("Webcam unavailable:", err);
      this.setCameraStatus("denied");
    }
  }

  /** Stops webcam tracks and the prediction loop. Keyboard keeps working. */
  turnOff(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.active = -1;
    this.h.onMove(null);
    this.h.onDetection(-1, "", 0, false);
    try {
      this.webcam?.stop();
    } catch {
      /* noop */
    }
    if (this.host) this.host.replaceChildren();
    this.setCameraStatus("off");
  }

  private loop = async () => {
    if (this.cameraStatus !== "on" || !this.webcam || !this.model) return;
    this.raf = requestAnimationFrame(this.loop);
    try {
      this.webcam.update();
      const { posenetOutput } = await this.webcam.estimatePose(this.webcam.canvas);
      // predict() resolves to Array<{ className, probability }> directly
      const predictions: TmPosePrediction[] = await this.model.predict(posenetOutput);
      this.errorStreak = 0;

      const probs = [0, 0, 0, 0];
      for (const p of predictions) {
        const idx = this.classIndex(p.className);
        if (idx >= 0 && idx < 4) probs[idx] = p.probability ?? 0;
      }

      // light EMA smoothing so quick prediction flips don't shake the ship
      for (let i = 0; i < 4; i++) {
        this.smoothed[i] += (probs[i] - this.smoothed[i]) * SMOOTHING;
      }

      let top = -1;
      let topP = 0;
      for (let i = 0; i < 4; i++) {
        if (this.smoothed[i] > topP) {
          topP = this.smoothed[i];
          top = i;
        }
      }

      // threshold with a little hysteresis: a clear pose locks in quickly,
      // and stays locked until confidence clearly drops (no flicker)
      let idx = -1;
      if (top >= 0 && topP >= THRESHOLD) idx = top;
      else if (this.active >= 0 && this.smoothed[this.active] >= HOLD_FLOOR) idx = this.active;

      // edge-triggered actions with cooldowns — one pose = one trigger
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
        this.h.onDetection(top, top >= 0 ? this.classNames[top] ?? "" : "", topP, idx !== -1);
      }
    } catch (err) {
      this.errorStreak += 1;
      if (this.errorStreak === 25) {
        console.error("Pose prediction error:", err);
        this.setModelStatus("error");
      }
    }
  };

  dispose(): void {
    this.turnOff();
    this.webcam = null;
    this.host = null;
  }
}
