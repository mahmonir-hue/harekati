/* ------------------------------------------------------------------ */
/*  Teachable Machine pose controller — direct getUserMedia pipeline  */
/*  Model: https://teachablemachine.withgoogle.com/models/g5GrIpxSy/   */
/*                                                                     */
/*  Class 1 = move LEFT      Class 3 = SHIELD                          */
/*  Class 2 = move RIGHT     Class 4 = BOOST                           */
/*                                                                     */
/*  Flow (strict order):                                               */
/*    button click -> getUserMedia -> video.play() -> metadata ready   */
/*    -> load model.json + metadata.json -> start prediction loop      */
/* ------------------------------------------------------------------ */

import type { TmPoseModel, TmPosePrediction } from "../tm-pose";

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/g5GrIpxSy/";
const THRESHOLD = 0.7; // ~70% confidence, per spec
const HOLD_FLOOR = 0.55; // hysteresis floor while a class is already active
const SMOOTHING = 0.5; // EMA weight for a new sample (light smoothing)
const UI_INTERVAL = 120; // ms between on-screen detection updates
const SHIELD_COOLDOWN = 2000; // ms — one pose = one action, no spam
const BOOST_COOLDOWN = 800;

export type CameraStatus = "off" | "starting" | "on" | "denied" | "insecure" | "error";
export type ModelStatus = "idle" | "loading" | "ready" | "error";

export interface PoseHandlers {
  onCameraStatus: (status: CameraStatus) => void;
  onModelStatus: (status: ModelStatus) => void;
  /** topIndex = -1 when nothing crosses the threshold */
  onDetection: (topIndex: number, className: string, confidence: number, locked: boolean) => void;
  onMove: (dir: "left" | "right" | null) => void;
  onAction: (action: "shield" | "boost") => void;
}

export class PoseController {
  private h: PoseHandlers;
  private model: TmPoseModel | null = null;
  private modelPromise: Promise<TmPoseModel | null> | null = null;
  /** Class name -> action index (from model metadata, e.g. "Class 2" -> 1) */
  private classIndex = new Map<string, number>();

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

  private setCamera(s: CameraStatus) {
    this.cameraStatus = s;
    this.h.onCameraStatus(s);
  }

  private setModel(s: ModelStatus) {
    this.modelStatus = s;
    this.h.onModelStatus(s);
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

      // 5) NOW load the Teachable Machine model (only after webcam is ready)
      const model = await this.ensureModel();

      // 6) Start the prediction loop only after the model is loaded
      //    (the loop self-skips frames until the video is fully ready)
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

  /** Single-flight loader for model.json + metadata.json. */
  private ensureModel(): Promise<TmPoseModel | null> {
    if (this.model) return Promise.resolve(this.model);
    if (!this.modelPromise) {
      this.modelPromise = (async () => {
        if (typeof tmPose === "undefined") {
          console.error("TM ERROR: tmPose library not loaded (CDN blocked?)");
          this.setModel("error");
          return null;
        }
        this.setModel("loading");
        console.log("TM: loading model.json + metadata.json from", MODEL_URL);
        try {
          const model = await tmPose.load(MODEL_URL + "model.json");
          this.model = model;
          // Build the class-name map from metadata: "Class 1" -> 0 ... "Class 4" -> 3
          const labels = model.getClassLabels?.() ?? [];
          this.classIndex.clear();
          labels.forEach((label, i) => this.classIndex.set(label, i));
          console.log("TM: model ready — classes:", labels);
          this.setModel("ready");
          return model;
        } catch (err) {
          const e = err as Error;
          console.error(`TM ERROR: ${e?.name}: ${e?.message}`);
          this.setModel("error");
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
    this.raf = requestAnimationFrame(this.loop);
  }

  private stopLoop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    console.log("POSE: prediction loop stopped");
    this.active = -1;
    this.h.onMove(null);
  }

  private loop = async () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const video = this.video;
    if (!this.model || !video) return;
    if (video.readyState < 2) return; // skip until frames are actually available

    try {
      const { posenetOutput } = await this.model.estimatePose(video);
      const predictions: TmPosePrediction[] = await this.model.predict(posenetOutput);

      // probabilities indexed by the controller's class order (0..3)
      const probs = [0, 0, 0, 0];
      let topName = "";
      let topP = -1;
      for (const p of predictions) {
        const idx = this.classIndex.get(p.className) ?? -1;
        if (idx >= 0) probs[idx] = p.probability;
        if (p.probability > topP) {
          topP = p.probability;
          topName = p.className;
        }
      }
      if (topP < 0) return;

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

      // threshold + light hysteresis: a clear pose locks in within ~2 frames,
      // quick prediction flips don't shake the ship
      let idx = -1;
      if (best >= 0 && bestP >= THRESHOLD) idx = best;
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
      this.h.onMove(idx === 0 ? "left" : idx === 1 ? "right" : null);

      if (now - this.lastUiAt > UI_INTERVAL) {
        this.lastUiAt = now;
        this.h.onDetection(best, topName, topP, idx !== -1);
      }
    } catch (err) {
      const e = err as Error;
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
