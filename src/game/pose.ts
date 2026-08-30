/* ------------------------------------------------------------------ */
/*  Teachable Machine pose controller — npm pipeline (no CDN globals)  */
/*  Model: https://teachablemachine.withgoogle.com/models/g5GrIpxSy/   */
/*                                                                     */
/*  Class 1 = move LEFT      Class 3 = SHIELD                          */
/*  Class 2 = move RIGHT     Class 4 = BOOST                           */
/*                                                                     */
/*  ONE pipeline, strict order:                                        */
/*    Turn Camera On -> getUserMedia -> video ready                    */
/*    -> tf.ready() -> tmPose.load(model.json, metadata.json)          */
/*    -> prediction loop -> class probabilities -> game movement       */
/* ------------------------------------------------------------------ */

import * as tf from "@tensorflow/tfjs";
import * as tmPose from "@teachablemachine/pose";
import type { CustomPoseNetModel, PosePrediction } from "@teachablemachine/pose";

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/model.json";
const METADATA_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/metadata.json";

export const POSE_THRESHOLD = 0.5; // 50% for easy testing, per spec
const HOLD_FLOOR = 0.35; // very light hysteresis so the ship doesn't flicker
const SMOOTHING = 0.5; // light EMA smoothing
const UI_INTERVAL = 120; // ms between debug/HUD updates
const SHIELD_COOLDOWN = 2000; // ms — one pose = one shield, no spam
const BOOST_COOLDOWN = 800;

export type CameraStatus = "off" | "starting" | "on" | "denied" | "insecure" | "error";
export type ModelStatus = "idle" | "loading" | "ready" | "error";
export type TfStatus = "pending" | "ready" | "error";

export interface DebugInfo {
  tf: TfStatus;
  model: ModelStatus;
  prediction: "running" | "stopped";
  probs: number[]; // smoothed probability per class index 0..3
  action: "NONE" | "LEFT" | "RIGHT" | "SHIELD" | "BOOST";
  error: string; // last real error ("name: message")
  labels: string[]; // actual class labels read from metadata.json
}

export interface PoseHandlers {
  onCameraStatus: (status: CameraStatus) => void;
  onModelStatus: (status: ModelStatus, error: string) => void;
  onMove: (dir: "left" | "right" | null) => void;
  onAction: (action: "shield" | "boost") => void;
  onDebug: (info: DebugInfo) => void;
}

export class PoseController {
  private h: PoseHandlers;
  private model: CustomPoseNetModel | null = null;
  private modelPromise: Promise<boolean> | null = null;
  /** Class label -> controller index (from metadata, e.g. "Class 2" -> 1) */
  private classIndex = new Map<string, number>();
  private labels: string[] = [];
  private tfStatus: TfStatus = "pending";
  private lastError = "";

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private host: HTMLElement | null = null;
  private raf = 0;
  private running = false;
  private turningOn = false; // guards rapid double-clicks: never two streams

  private smoothed = [0.25, 0.25, 0.25, 0.25];
  private active = -1;
  private lastShieldAt = -1e9;
  private lastBoostAt = -1e9;
  private lastUiAt = 0;

  cameraStatus: CameraStatus = "off";
  modelStatus: ModelStatus = "idle";

  constructor(handlers: PoseHandlers) {
    this.h = handlers;
  }

  /* ------------------------------ status ------------------------------ */

  private snapshot(): DebugInfo {
    return {
      tf: this.tfStatus,
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
      error: this.lastError,
      labels: [...this.labels],
    };
  }

  private emitDebug() {
    this.h.onDebug(this.snapshot());
  }

  private setCamera(s: CameraStatus) {
    this.cameraStatus = s;
    this.h.onCameraStatus(s);
    this.emitDebug();
  }

  private setModel(s: ModelStatus, error = "") {
    this.modelStatus = s;
    if (s === "error" && error) this.lastError = error;
    if (s === "ready") this.lastError = "";
    this.h.onModelStatus(s, this.lastError);
    this.emitDebug();
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
      // 1) Secure context check: getUserMedia needs https:// or localhost
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        console.error("CAMERA ERROR: insecure context — webcam requires HTTPS or localhost");
        this.setCamera("insecure");
        return;
      }

      // 2) Ask for permission
      console.log("CAMERA: requesting permission");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      console.log("CAMERA: permission granted");
      console.log("CAMERA: video stream received", stream);
      this.stream = stream;

      // 3) Attach the stream to a <video> element inside the preview panel
      const video = this.video ?? document.createElement("video");
      this.video = video;
      video.muted = true; // allows autoplay in all browsers
      video.setAttribute("playsinline", ""); // iOS
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

      // 4) Wait until the video metadata is loaded
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

      // 5) Verify the live video is a valid model input, then load the model
      const videoOk =
        !!video.srcObject && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
      console.log(
        `CAMERA: input check -> srcObject=${!!video.srcObject} readyState=${video.readyState} size=${video.videoWidth}x${video.videoHeight} ok=${videoOk}`
      );

      const modelOk = await this.ensureModel();

      // 6) Start ONE prediction loop (self-skips frames until fully ready)
      if (modelOk) this.startLoop();
    } catch (err) {
      const e = err as Error;
      console.error(err);
      console.error(e?.name);
      console.error(e?.message);
      console.error(e?.stack);
      this.stopStream();
      this.setCamera(this.statusForError(e));
    } finally {
      this.turningOn = false;
    }
  }

  /** Map browser MediaStream errors to the right UI status. */
  private statusForError(e: Error): CameraStatus {
    switch (e?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        // "Camera permission denied. Please allow camera access in browser settings."
        return "denied";
      case "NotFoundError":
      case "DevicesNotFoundError":
      case "NotReadableError":
      case "TrackStartError":
      case "OverconstrainedError":
      case "SecurityError":
      default:
        return "error";
    }
  }

  /* --------------------------- camera off --------------------------- */

  /** Stop all tracks, halt prediction, clear the preview. */
  turnOff() {
    console.log("CAMERA: turn off requested");
    this.stopLoop();
    this.stopStream();
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
    }
    this.setCamera("off");
    console.log("CAMERA: turned off (tracks stopped)");
  }

  private stopStream() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }

  /* ----------------------- Teachable Machine model ----------------------- */

  /** Single-flight loader: tf.ready() + tmPose.load(model.json, metadata.json). */
  private ensureModel(): Promise<boolean> {
    if (this.model) return Promise.resolve(true);
    if (!this.modelPromise) {
      this.modelPromise = (async () => {
        this.setModel("loading");
        console.log("POSE: loading model...");
        try {
          await tf.ready();
          this.tfStatus = "ready";
          console.log("TF: runtime ready, backend =", tf.getBackend());

          const model = await tmPose.load(MODEL_URL, METADATA_URL);
          this.model = model;

          // Read the ACTUAL labels from metadata.json (expected: Class 1..4)
          const rawLabels: string[] = Array.isArray(model.metadata?.labels)
            ? (model.metadata?.labels as string[])
            : [];
          console.log("POSE LABELS:", JSON.stringify(rawLabels));
          this.labels = rawLabels.length > 0 ? rawLabels : ["Class 1", "Class 2", "Class 3", "Class 4"];
          this.classIndex.clear();
          this.labels.forEach((label: string, i: number) => this.classIndex.set(label, i));

          console.log("POSE: model loaded successfully");
          console.log("POSE: max classes =", model.getMaxClasses?.() ?? this.labels.length);
          this.setModel("ready");
          return true;
        } catch (err) {
          const e = err as Error;
          console.error(err);
          console.error(e?.name);
          console.error(e?.message);
          console.error(e?.stack);
          this.tfStatus = this.tfStatus === "ready" ? "ready" : "error";
          this.setModel("error", `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
          return false;
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
    this.raf = requestAnimationFrame(this.loop);
    this.emitDebug();
  }

  private stopLoop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    console.log("POSE: prediction loop stopped");
    this.active = -1;
    this.h.onMove(null);
    this.emitDebug();
  }

  private loop = async () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const video = this.video;
    if (!this.model || !video) return;
    if (video.readyState < 2 || video.videoWidth === 0) return; // wait for real frames

    try {
      const { posenetOutput } = await this.model.estimatePose(video);
      const predictions: PosePrediction[] = await this.model.predict(posenetOutput);

      // probabilities in controller order (0..3), mapped by actual class label
      const probs = [0, 0, 0, 0];
      for (let i = 0; i < predictions.length; i++) {
        const p = predictions[i];
        const idx = this.classIndex.has(p.className) ? (this.classIndex.get(p.className) as number) : i;
        if (idx >= 0 && idx < 4) probs[idx] = p.probability;
      }

      for (let i = 0; i < this.smoothed.length; i++) {
        this.smoothed[i] += (probs[i] - this.smoothed[i]) * SMOOTHING;
      }

      let best = -1;
      let bestP = 0;
      for (let i = 0; i < this.smoothed.length; i++) {
        if (this.smoothed[i] > bestP) {
          bestP = this.smoothed[i];
          best = i;
        }
      }

      // 50% threshold + very light hysteresis: instant trigger, no pose holding
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
      // The preview video is mirrored (selfie mode), so the model's left/right
      // arrive reversed relative to the player's body. Directions are swapped
      // here: the player's LEFT pose (reported as Class 2 / idx 1) moves the
      // ship LEFT, and the RIGHT pose (Class 1 / idx 0) moves it RIGHT.
      this.h.onMove(idx === 0 ? "right" : idx === 1 ? "left" : null);

      if (now - this.lastUiAt > UI_INTERVAL) {
        this.lastUiAt = now;
        this.emitDebug();
      }
    } catch (err) {
      const e = err as Error;
      console.error(err);
      console.error(`POSE ERROR: ${e?.name}: ${e?.message}`);
    }
  };

  /* ------------------------------ cleanup ------------------------------ */

  dispose() {
    this.turnOff();
    this.model = null;
    this.modelPromise = null;
    this.host = null;
  }
}
