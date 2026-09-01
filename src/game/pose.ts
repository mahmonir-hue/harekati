/* Teachable Machine pose controller — direct getUserMedia pipeline.
   Model: https://teachablemachine.withgoogle.com/models/g5GrIpxSy/

   Class 1 = move LEFT      Class 3 = SHIELD
   Class 2 = move RIGHT     Class 4 = BOOST

   Flow (strict order): button click -> getUserMedia -> video.play() ->
   metadata ready -> tf.ready() -> tmPose.load(model.json, metadata.json) ->
   prediction loop. */

import * as tf from "@tensorflow/tfjs";
import * as tmPose from "@teachablemachine/pose";
import type { CustomPoseNetModel, PosePrediction } from "@teachablemachine/pose";

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/model.json";
const METADATA_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/metadata.json";

export const POSE_THRESHOLD = 0.5; // easy testing threshold
const HOLD_FLOOR = 0.45; // hysteresis floor while a class is already active
const SMOOTHING = 0.55; // EMA weight for a new sample (very light)
const UI_INTERVAL = 120; // ms between on-screen debug updates
const SHIELD_COOLDOWN = 2000; // ms — one pose = one action, no spam
const BOOST_COOLDOWN = 800;

export type CameraStatus = "off" | "starting" | "on" | "denied" | "insecure" | "error";
export type ModelStatus = "idle" | "loading" | "ready" | "error";

export interface DebugInfo {
  tf: "pending" | "ready" | "error";
  model: "idle" | "loading" | "ready" | "error";
  prediction: "stopped" | "running";
  probs: number[]; // 4 smoothed probabilities
  action: "NONE" | "LEFT" | "RIGHT" | "SHIELD" | "BOOST";
  error: string;
  labels: string[];
}

export interface PoseHandlers {
  onCameraStatus: (status: CameraStatus) => void;
  onModelStatus: (status: ModelStatus, error?: string) => void;
  onDebug: (info: DebugInfo) => void;
  onMove: (dir: "left" | "right" | null) => void;
  onAction: (action: "shield" | "boost") => void;
}

export class PoseController {
  private h: PoseHandlers;
  private model: CustomPoseNetModel | null = null;
  private modelPromise: Promise<CustomPoseNetModel | null> | null = null;
  /** Class name -> action index from metadata, e.g. "Class 2" -> 1 */
  private classIndex = new Map<string, number>();
  private labels: string[] = [];

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private host: HTMLElement | null = null;
  private raf = 0;
  private running = false;
  private turningOn = false; // guards rapid clicks: never two streams

  private smoothed = [0.25, 0.25, 0.25, 0.25];
  private active = -1;
  private lastShieldAt = -1e9;
  private lastBoostAt = -1e9;
  private lastUiAt = 0;

  cameraStatus: CameraStatus = "off";
  modelStatus: ModelStatus = "idle";

  constructor(handlers: PoseHandlers) {
    this.h = handlers;
    this.pushDebug();
  }

  private setCamera(s: CameraStatus) {
    this.cameraStatus = s;
    this.h.onCameraStatus(s);
  }

  private setModel(s: ModelStatus, err = "") {
    this.modelStatus = s;
    this.h.onModelStatus(s, err);
    this.pushDebug(err);
  }

  private pushDebug(error = "") {
    this.h.onDebug({
      tf: this.model ? "ready" : this.modelStatus === "error" ? "error" : "pending",
      model: this.modelStatus,
      prediction: this.running ? "running" : "stopped",
      probs: [...this.smoothed],
      action:
        this.active === 0
          ? "RIGHT" // mirrored swap — must match the onMove mapping below
          : this.active === 1
            ? "LEFT"
            : this.active === 2
              ? "SHIELD"
              : this.active === 3
                ? "BOOST"
                : "NONE",
      error: error || (this.modelStatus === "error" ? "model load failed" : ""),
      labels: [...this.labels],
    });
  }

  /* ------------------------- camera on (button) ------------------------- */

  /** Called ONLY from the "Turn Camera On" button. Requests permission here. */
  async turnOn(host: HTMLElement) {
    console.log("CAMERA: button clicked");
    if (this.cameraStatus === "on" || this.cameraStatus === "starting" || this.turningOn) {
      console.log("CAMERA: ignored (already on or starting)");
      return;
    }
    this.turningOn = true;
    this.host = host;
    this.setCamera("starting");

    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        console.error("CAMERA ERROR: insecure context — webcam requires HTTPS or localhost");
        this.setCamera("insecure");
        return;
      }

      console.log("CAMERA: requesting permission");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      console.log("CAMERA: permission granted");
      console.log("CAMERA: video stream received", stream);
      this.stream = stream;

      const video = this.video ?? document.createElement("video");
      this.video = video;
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.srcObject = stream;
      if (video.parentElement !== host) {
        host.innerHTML = "";
        host.appendChild(video);
      }

      try {
        await video.play();
      } catch (playErr) {
        console.warn("CAMERA: play() failed, retrying muted", playErr);
        video.muted = true;
        await video.play();
      }

      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          const done = () => {
            video.removeEventListener("loadedmetadata", done);
            resolve();
          };
          video.addEventListener("loadedmetadata", done);
        });
      }
      console.log("CAMERA: video ready");
      this.setCamera("on");

      const model = await this.ensureModel();
      // start the loop only after the model is loaded (it self-skips until video is ready)
      if (model) this.startLoop();
    } catch (err) {
      const e = err as Error;
      console.error(`CAMERA ERROR: ${e?.name}: ${e?.message}`);
      this.stopStream();
      this.setCamera(this.statusForError(e));
    } finally {
      this.turningOn = false;
    }
  }

  private statusForError(e: Error): CameraStatus {
    switch (e?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "denied";
      default:
        return "error";
    }
  }

  /* --------------------------- camera off --------------------------- */

  turnOff() {
    console.log("CAMERA: turn off requested");
    this.stopLoop();
    this.stopStream();
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
    }
    this.setCamera("off");
  }

  private stopStream() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }

  /* ----------------------- Teachable Machine model ----------------------- */

  private ensureModel(): Promise<CustomPoseNetModel | null> {
    if (this.model) return Promise.resolve(this.model);
    if (!this.modelPromise) {
      this.modelPromise = (async () => {
        this.setModel("loading");
        console.log("POSE: loading model...");
        try {
          await tf.ready();
          console.log("TF: backend ready ->", tf.getBackend());
          const model = await tmPose.load(MODEL_URL, METADATA_URL);
          this.model = model;
          const labels = model.metadata?.labels ?? [];
          this.labels = labels;
          this.classIndex.clear();
          labels.forEach((label, i) => this.classIndex.set(label, i));
          console.log("POSE: model loaded successfully");
          console.log("POSE: max classes =", model.getMaxClasses?.() ?? labels.length);
          console.log("POSE LABELS:", JSON.stringify(labels));
          this.setModel("ready");
          return model;
        } catch (err) {
          const e = err as Error;
          console.error("POSE ERROR:", err);
          console.error(e?.name);
          console.error(e?.message);
          console.error(e?.stack);
          this.setModel("error", `${e?.name}: ${e?.message}`);
          return null;
        }
      })();
    }
    return this.modelPromise;
  }

  /* -------------------------- prediction loop -------------------------- */

  private startLoop() {
    if (this.running) return;
    this.running = true;
    console.log("POSE: prediction loop started");
    this.pushDebug();
    this.raf = requestAnimationFrame(this.loop);
  }

  private stopLoop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    console.log("POSE: prediction loop stopped");
    this.active = -1;
    this.h.onMove(null);
    this.pushDebug();
  }

  private loop = async () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const video = this.video;
    if (!this.model || !video) return;
    if (video.readyState < 2 || !video.videoWidth) return; // wait for real frames

    try {
      const { posenetOutput } = await this.model.estimatePose(video);
      const predictions: PosePrediction[] = await this.model.predict(posenetOutput);

      const probs = [0, 0, 0, 0];
      for (const p of predictions) {
        const idx = this.classIndex.get(p.className) ?? -1;
        if (idx >= 0) probs[idx] = p.probability;
      }

      for (let i = 0; i < 4; i++) {
        this.smoothed[i] += (probs[i] - this.smoothed[i]) * SMOOTHING;
      }

      let best = -1;
      let bestP = 0;
      for (let i = 0; i < 4; i++) {
        if (this.smoothed[i] > bestP) {
          bestP = this.smoothed[i];
          best = i;
        }
      }

      // threshold + light hysteresis — a clear pose locks in within ~2 frames
      let idx = -1;
      if (best >= 0 && bestP >= POSE_THRESHOLD) idx = best;
      else if (this.active >= 0 && this.smoothed[this.active] >= HOLD_FLOOR) idx = this.active;

      const now = performance.now();
      if (idx === 2 && this.active !== 2 && now - this.lastShieldAt > SHIELD_COOLDOWN) {
        this.lastShieldAt = now;
        console.log("POSE: Class 3 -> SHIELD");
        this.h.onAction("shield");
      }
      if (idx === 3 && this.active !== 3 && now - this.lastBoostAt > BOOST_COOLDOWN) {
        this.lastBoostAt = now;
        console.log("POSE: Class 4 -> BOOST");
        this.h.onAction("boost");
      }

      this.active = idx;
      // NOTE: mirrored swap — the preview is a mirror, so the model's
      // "left" class fires when the player moves their RIGHT side, etc.
      this.h.onMove(idx === 0 ? "right" : idx === 1 ? "left" : null);

      if (now - this.lastUiAt > UI_INTERVAL) {
        this.lastUiAt = now;
        this.pushDebug();
      }
    } catch (err) {
      const e = err as Error;
      console.error(`POSE ERROR: ${e?.name}: ${e?.message}`);
    }
  };

  dispose() {
    this.turnOff();
    this.model = null;
    this.modelPromise = null;
    this.host = null;
  }
}
