import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  render,
  resetGame,
  resizeGame,
  triggerBoost,
  triggerShield,
  update,
  updateAmbient,
  type GameState,
} from "./game/engine";
import { PoseController, type CameraStatus, type ModelStatus } from "./game/pose";

type Phase = "menu" | "playing" | "over";
type Lang = "fa" | "en";

const LANG_KEY = "posepilot.lang";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/* ------------------------------ i18n ------------------------------ */

function faNum(value: string | number, lang: Lang): string {
  const s = String(value);
  return lang === "fa" ? s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]) : s;
}

function initialLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "fa";
  } catch {
    return "fa";
  }
}

interface Strings {
  tagline: string;
  score: string;
  lives: string;
  shield: string;
  shieldUp: string;
  noShield: string;
  boost: string;
  restart: string;
  camera: string;
  camOnBtn: string;
  camOffBtn: string;
  camOff: string;
  camOn: string;
  camStarting: string;
  camDenied: string;
  camInsecure: string;
  camError: string;
  modelReady: string;
  modelLoading: string;
  modelError: string;
  modelIdle: string;
  detected: string;
  confidence: string;
  scanning: string;
  camHelp: string;
  camNote: string;
  badge: string;
  startGame: string;
  descA: string;
  stars: string;
  descB: string;
  meteors: string;
  descC: string;
  controlsTitle: string;
  kbdLabel: string;
  scoring: string;
  poseGuide: string;
  gameOver: string;
  hullBreach: string;
  finalScore: string;
  starsCaught: string;
  relaunchA: string;
  relaunchB: string;
  relaunchC: string;
}

const T: Record<Lang, Strings> = {
  fa: {
    tagline: "پرواز فضایی با کنترل بدن",
    score: "امتیاز",
    lives: "جان",
    shield: "سپر",
    shieldUp: "سپر فعال",
    noShield: "بدون سپر",
    boost: "شتاب",
    restart: "شروع دوباره",
    camera: "دوربین",
    camOnBtn: "روشن کردن دوربین",
    camOffBtn: "خاموش کردن دوربین",
    camOff: "دوربین خاموش است",
    camOn: "دوربین روشن است",
    camStarting: "در حال روشن کردن دوربین...",
    camDenied: "اجازه دسترسی به دوربین داده نشده است. لطفاً دسترسی دوربین را در تنظیمات مرورگر فعال کنید.",
    camInsecure: "وبکم نیاز به HTTPS یا localhost دارد.",
    camError: "خطای دوربین — جزئیات در کنسول مرورگر ثبت شد.",
    modelReady: "مدل حرکتی آماده است",
    modelLoading: "در حال بارگیری مدل حرکتی...",
    modelError: "خطا در مدل حرکتی — کنترل با کیبورد فعال است",
    modelIdle: "مدل حرکتی پس از روشن شدن دوربین بارگیری می‌شود.",
    detected: "حرکت تشخیص داده‌شده",
    confidence: "میزان اطمینان",
    scanning: "در حال جست‌وجوی ژست...",
    camHelp: "برای کنترل سفینه با حرکات بدن، دوربین را روشن کنید.",
    camNote: "دوربین فقط پس از کلیک روی دکمهٔ دوربین فعال می‌شود",
    badge: "TEACHABLE MACHINE · POSE MODEL",
    startGame: "شروع بازی",
    descA: "سفینهٔ کوچک را با بدن خود هدایت کنید؛ ",
    stars: "ستاره‌ها",
    descB: " را بگیرید و از ",
    meteors: "شهاب‌سنگ‌ها",
    descC: " دوری کنید.",
    controlsTitle: "کنترل‌ها — ژست بدن + کیبورد",
    kbdLabel: "کیبورد",
    scoring: "هر ستاره ۱۰+ امتیاز · هر شهاب‌سنگ ۱− جان · ۳ جان · سپر یک ضربه را دفع می‌کند",
    poseGuide: "راهنمای ژست‌ها",
    gameOver: "بازی تمام شد",
    hullBreach: "آسیب کامل به بدنه",
    finalScore: "امتیاز نهایی",
    starsCaught: "ستاره‌های گرفته‌شده",
    relaunchA: "برای پرواز دوباره",
    relaunchB: "یا",
    relaunchC: "را بزن",
  },
  en: {
    tagline: "body-controlled space run",
    score: "Score",
    lives: "Lives",
    shield: "Shield",
    shieldUp: "Shield up",
    noShield: "No shield",
    boost: "Boost",
    restart: "Restart",
    camera: "Camera",
    camOnBtn: "Turn Camera On",
    camOffBtn: "Turn Camera Off",
    camOff: "Camera Off",
    camOn: "Camera On",
    camStarting: "Starting Camera...",
    camDenied: "Camera permission denied. Please allow camera access in browser settings.",
    camInsecure: "Webcam requires HTTPS or localhost.",
    camError: "Camera error — details logged to browser console.",
    modelReady: "Pose Model Ready",
    modelLoading: "Loading motion model...",
    modelError: "Motion model error — keyboard controls active",
    modelIdle: "Pose model loads after the camera is turned on.",
    detected: "Detected Pose",
    confidence: "Confidence",
    scanning: "Scanning for poses...",
    camHelp: "Turn on the camera to control the spaceship with your body.",
    camNote: "The camera turns on only when you click the camera button",
    badge: "TEACHABLE MACHINE · POSE MODEL",
    startGame: "Start Game",
    descA: "Steer a tiny spaceship with your body. Catch falling ",
    stars: "stars",
    descB: ", dodge ",
    meteors: "meteors",
    descC: ", survive the drift.",
    controlsTitle: "Controls — body poses + keyboard",
    kbdLabel: "Key",
    scoring: "+10 points per star · meteor −1 life · 3 lives · shield absorbs one hit",
    poseGuide: "Pose Guide",
    gameOver: "Game Over",
    hullBreach: "HULL BREACH",
    finalScore: "Final Score",
    starsCaught: "Stars caught",
    relaunchA: "PRESS",
    relaunchB: "OR",
    relaunchC: "TO RELAUNCH",
  },
};

/** Exact pose instructions (from the mission brief) for the help panel. */
const GUIDE: Record<Lang, Array<{ cls: string; pose: string; action: string }>> = {
  fa: [
    { cls: "Class 1", pose: "دست چپ را به سمت چپ باز کنید", action: "حرکت سفینه به چپ" },
    { cls: "Class 2", pose: "دست راست را به سمت راست باز کنید", action: "حرکت سفینه به راست" },
    { cls: "Class 3", pose: "هر دو دست را به دو طرف باز کنید", action: "فعال شدن سپر" },
    { cls: "Class 4", pose: "هر دو دست را بالا ببرید", action: "حرکت سفینه به بالا" },
  ],
  en: [
    { cls: "Class 1", pose: "Extend left arm to the left", action: "Move spaceship left" },
    { cls: "Class 2", pose: "Extend right arm to the right", action: "Move spaceship right" },
    { cls: "Class 3", pose: "Extend both arms sideways", action: "Activate shield" },
    { cls: "Class 4", pose: "Raise both hands", action: "Boost upward" },
  ],
};

const KBD_KEYS = ["←", "→", "SPACE", "↑"];

/* --------------------------- tiny SVG icons --------------------------- */

function ShipIcon({ dim }: { dim?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-all duration-300 ${
        dim ? "opacity-20 saturate-0" : "opacity-100 drop-shadow-[0_0_6px_rgba(94,234,255,0.8)]"
      }`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2c3.2 2.8 4.4 6.6 4.4 10.6L19 17l-3.4-.6L12 21l-3.6-4.6L5 17l2.6-4.4C7.6 8.6 8.8 4.8 12 2z" />
    </svg>
  );
}

function ShieldIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-all duration-300 ${
        on ? "text-ion drop-shadow-[0_0_8px_rgba(94,234,255,0.9)]" : "text-slate-600"
      }`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l8 3.5V11c0 5.2-3.4 8.6-8 11-4.6-2.4-8-5.8-8-11V5.5L12 2z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 5v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6 10A8 8 0 1 1 4 14" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <path d="M2 8l4-3h12a2 2 0 0 1 2 2v2l2-1v8l-2-1v2a2 2 0 0 1-2 2H6l-4-3V8z" strokeLinejoin="round" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.9c-.7.3-1 .8-1 1.5" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ------------------------------- app -------------------------------- */

interface Detection {
  index: number; // -1 = nothing over threshold
  name: string; // class name from model metadata, e.g. "Class 2"
  conf: number; // 0..1 top probability
  locked: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const gsRef = useRef<GameState>(
    createGame(typeof window !== "undefined" ? window.innerWidth : 800, typeof window !== "undefined" ? window.innerHeight : 600)
  );
  const kbRef = useRef({ left: false, right: false });
  const poseDirRef = useRef<"left" | "right" | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const poseRef = useRef<PoseController | null>(null);
  const hudRef = useRef({ score: -1, lives: -1, shield: false });

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [shieldOn, setShieldOn] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [camStatus, setCamStatus] = useState<CameraStatus>("off");
  const [det, setDet] = useState<Detection>({ index: -1, name: "", conf: 0, locked: false });
  const [lang, setLang] = useState<Lang>(initialLang);
  const [guideOpen, setGuideOpen] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth >= 640
  );

  const t = T[lang];
  const rtl = lang === "fa";

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const restart = useCallback(() => {
    resetGame(gsRef.current);
    hudRef.current = { score: -1, lives: -1, shield: false };
    setScore(0);
    setLives(3);
    setShieldOn(false);
    changePhase("playing");
  }, [changePhase]);

  /** Start / restart the run. Camera is controlled separately by its button. */
  const startGame = useCallback(() => {
    if (phaseRef.current === "playing") return;
    restart();
  }, [restart]);

  /** Explicit camera on/off — webcam permission is only requested here. */
  const toggleCamera = useCallback(async () => {
    const pc = poseRef.current;
    if (!pc) return;
    if (pc.cameraStatus === "on" || pc.cameraStatus === "starting") {
      pc.turnOff();
      return;
    }
    if (previewRef.current) await pc.turnOn(previewRef.current);
  }, []);

  /* ------------------ language: dir, lang attr, storage ------------------ */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode — ignore */
    }
  }, [lang, rtl]);

  /* ------------------------- mount: loop + input ------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resizeGame(gsRef.current, w, h);
    };
    fit();
    window.addEventListener("resize", fit);

    // Pose controller: webcam permission is requested ONLY on button click;
    // the TM model is loaded only after the webcam video is ready.
    const pc = new PoseController({
      onModelStatus: (s) => setModelStatus(s),
      onCameraStatus: (s) => setCamStatus(s),
      onDetection: (index, name, conf, locked) => setDet({ index, name, conf, locked }),
      onMove: (dir) => {
        poseDirRef.current = dir;
      },
      onAction: (a) => {
        if (phaseRef.current !== "playing") return;
        if (a === "shield") triggerShield(gsRef.current);
        else triggerBoost(gsRef.current);
      },
    });
    poseRef.current = pc;

    // Keyboard fallback (always works, even with the camera off)
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          kbRef.current.left = down;
          e.preventDefault();
          break;
        case "ArrowRight":
          kbRef.current.right = down;
          e.preventDefault();
          break;
        case "ArrowUp":
          if (down && !e.repeat && phaseRef.current === "playing") triggerBoost(gsRef.current);
          e.preventDefault();
          break;
        case " ":
          e.preventDefault();
          if (!down) break;
          if (phaseRef.current === "menu") startGame();
          else if (phaseRef.current === "over" && !e.repeat) restart();
          else if (phaseRef.current === "playing" && !e.repeat) triggerShield(gsRef.current);
          break;
        case "Enter":
          if (down && !e.repeat) {
            if (phaseRef.current === "menu") startGame();
            else if (phaseRef.current === "over") restart();
          }
          break;
        case "r":
        case "R":
          if (down && !e.repeat && phaseRef.current !== "menu") restart();
          break;
      }
    };
    const kd = onKey(true);
    const ku = onKey(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // Main loop
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const gs = gsRef.current;

      if (phaseRef.current === "playing") {
        const dir = poseDirRef.current;
        update(
          gs,
          { left: kbRef.current.left || dir === "left", right: kbRef.current.right || dir === "right" },
          dt
        );
        const hud = hudRef.current;
        if (gs.score !== hud.score) {
          hud.score = gs.score;
          setScore(gs.score);
        }
        if (gs.lives !== hud.lives) {
          hud.lives = gs.lives;
          setLives(gs.lives);
        }
        if (gs.ship.shield !== hud.shield) {
          hud.shield = gs.ship.shield;
          setShieldOn(gs.ship.shield);
        }
        if (gs.over) changePhase("over");
      } else {
        updateAmbient(gs, dt);
      }

      render(ctx, gs, now / 1000);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      pc.dispose();
      poseRef.current = null;
    };
  }, [changePhase, restart, startGame]);

  /* ------------------------------ UI pieces ------------------------------ */

  const camLine =
    camStatus === "off"
      ? t.camOff
      : camStatus === "starting"
        ? t.camStarting
        : camStatus === "denied"
          ? t.camDenied
          : camStatus === "insecure"
            ? t.camInsecure
            : camStatus === "error"
              ? t.camError
              : t.camOn;

  const modelLine =
    modelStatus === "idle"
      ? t.modelIdle
      : modelStatus === "loading"
        ? t.modelLoading
        : modelStatus === "error"
          ? t.modelError
          : t.modelReady;

  const detLine = det.locked && det.index >= 0 ? `${t.detected}: ${det.name}` : t.scanning;
  const confPct = Math.round(det.conf * 100);
  const confStr = rtl ? `${faNum(confPct, lang)}٪` : `${confPct}%`;

  const dotClass =
    camStatus === "on"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
      : camStatus === "starting"
        ? "bg-star anim-pulse-glow"
        : camStatus === "denied" || camStatus === "insecure" || camStatus === "error"
          ? "bg-alert shadow-[0_0_8px_rgba(255,93,115,0.8)]"
          : "bg-slate-600";

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="relative h-full w-full select-none overflow-hidden font-body">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* verification version badge (top-left corner) */}
      <div
        dir="ltr"
        className="pointer-events-none absolute left-2 top-2 z-30 border border-ion/50 bg-[#0a0f2e]/95 px-2 py-0.5 font-display text-[9px] font-bold tracking-[0.14em] text-ion shadow-[0_0_10px_rgba(94,234,255,0.25)]"
      >
        VERSION: POSE-FIX-3
      </div>

      <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-50" />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(2,3,14,0.6) 100%)" }}
      />

      {/* ------------------------------ top HUD ------------------------------ */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="anim-rise">
          <h1 className="font-display text-xl font-extrabold text-white sm:text-2xl">
            {rtl ? (
              <>
                خلبان <span className="text-ion glow-cyan">کیهان</span>
              </>
            ) : (
              <>
                POSE<span className="text-ion glow-cyan">PILOT</span>
              </>
            )}
          </h1>
          <p className="mt-0.5 text-[11px] font-medium text-indigo-300/70">{t.tagline}</p>
          <div className="pointer-events-auto mt-2 inline-flex items-center rounded-full border border-indigo-400/30 bg-[#0d1340]/85 p-0.5 text-[10px] font-bold">
            <button
              onClick={() => setLang("fa")}
              className={`rounded-full px-2.5 py-1 transition-colors duration-150 ${
                lang === "fa" ? "bg-ion/20 text-ion" : "text-indigo-300/70 hover:text-indigo-100"
              }`}
            >
              فارسی
            </button>
            <button
              onClick={() => setLang("en")}
              className={`rounded-full px-2.5 py-1 transition-colors duration-150 ${
                lang === "en" ? "bg-ion/20 text-ion" : "text-indigo-300/70 hover:text-indigo-100"
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="hud-chip">
            <span className="hud-label">{t.score}</span>
            <span className="font-display text-lg font-bold tabular-nums leading-none text-star glow-gold sm:text-xl">
              {faNum(String(score).padStart(4, "0"), lang)}
            </span>
          </div>

          <div className="hud-chip" title={t.lives}>
            <span className="hud-label">{t.lives}</span>
            <span className="flex items-center gap-1 text-ion">
              {[0, 1, 2].map((i) => (
                <ShipIcon key={i} dim={i >= lives} />
              ))}
            </span>
          </div>

          <div className={`hud-chip ${shieldOn ? "hud-chip--active" : ""}`} title={t.shield}>
            <ShieldIcon on={shieldOn} />
            <span className="hud-label">{shieldOn ? t.shieldUp : t.noShield}</span>
          </div>

          {phase !== "menu" && (
            <button
              onClick={restart}
              className="btn-ghost pointer-events-auto flex items-center gap-2 px-3.5 py-2 text-[11px] font-bold"
            >
              <RestartIcon />
              {t.restart}
            </button>
          )}
        </div>
      </header>

      {/* --------------------------- pose guide panel --------------------------- */}
      <div className="absolute bottom-4 left-4 z-20 flex w-44 flex-col-reverse items-start gap-2 sm:w-64">
        <button
          onClick={() => setGuideOpen((o) => !o)}
          className="btn-ghost pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold"
        >
          <GuideIcon />
          {t.poseGuide}
          <span className="text-ion">{guideOpen ? "−" : "+"}</span>
        </button>

        {guideOpen && (
          <div className="cam-panel w-full">
            {GUIDE[lang].map((g, i) => (
              <div key={g.cls} className={i > 0 ? "mt-2 border-t border-indigo-400/15 pt-2" : ""}>
                <p className="font-display text-[9px] font-bold tracking-[0.18em] text-ion/85">{g.cls}</p>
                <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-indigo-100/90">{g.pose}</p>
                <p className="text-[10.5px] font-bold leading-snug text-star">→ {g.action}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --------------------------- camera panel --------------------------- */}
      <aside className="absolute bottom-4 right-4 z-20 w-40 sm:w-56">
        <div className="cam-panel">
          <div className="flex items-center justify-between">
            <span className="hud-label">{t.camera}</span>
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          </div>

          {/* verification status line */}
          <p className="text-[9.5px] font-bold leading-snug text-emerald-300/90">
            {lang === "fa" ? "نسخه جدید کنترل حرکتی بارگذاری شد" : "New Pose Fix Loaded"}
          </p>

          <div className="cam-frame relative aspect-[4/3] overflow-hidden">
            <div ref={previewRef} className="absolute inset-0" />
            {camStatus !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                {camStatus === "starting" ? (
                  <span className="font-display text-[9px] font-bold tracking-[0.18em] text-indigo-300 anim-pulse-glow">
                    ...
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" className={`h-8 w-8 ${camStatus === "off" ? "text-slate-700" : "text-slate-600"}`} fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 8l4-3h12a2 2 0 0 1 2 2v2l2-1v8l-2-1v2a2 2 0 0 1-2 2H6l-4-3V8z" strokeLinejoin="round" />
                    {(camStatus === "denied" || camStatus === "insecure" || camStatus === "error") && (
                      <path d="M4 4l16 16" strokeLinecap="round" />
                    )}
                  </svg>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[3.6rem]">
            <p className="font-display text-[10px] font-bold text-indigo-100">{camLine}</p>
            {camStatus === "on" && modelStatus === "ready" ? (
              <>
                <p className="mt-0.5 text-[10px] font-bold leading-snug text-ion">{detLine}</p>
                <p className="text-[10px] font-medium text-indigo-300/85">
                  {t.confidence}:{" "}
                  <span className={`tabular-nums ${det.locked ? "text-ion" : "text-indigo-300/85"}`}>{confStr}</span>
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-[10px] font-medium leading-snug text-indigo-300/85">{modelLine}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => {
              const active = camStatus === "on" && det.locked && det.index === i;
              return (
                <span
                  key={i}
                  className={`flex-1 py-1 text-center font-display text-[9px] font-bold tracking-widest transition-all duration-150 ${
                    active
                      ? i === 2
                        ? "bg-ion/25 text-ion shadow-[0_0_10px_rgba(94,234,255,0.5)]"
                        : i === 3
                          ? "bg-star/25 text-star shadow-[0_0_10px_rgba(255,215,94,0.5)]"
                          : "bg-nebula/30 text-indigo-100 shadow-[0_0_10px_rgba(124,92,255,0.5)]"
                      : "bg-[#111741] text-indigo-400/60"
                  }`}
                >
                  {faNum(i + 1, lang)}
                </span>
              );
            })}
          </div>

          <button
            onClick={() => void toggleCamera()}
            disabled={camStatus === "starting"}
            className={`pointer-events-auto flex w-full items-center justify-center gap-2 px-3 py-2 font-display text-[11px] font-bold transition-all duration-150 disabled:opacity-60 ${
              camStatus === "on" || camStatus === "starting"
                ? "border border-indigo-400/40 bg-[#10163a] text-indigo-200 hover:bg-[#151d4c]"
                : "border border-ion/60 bg-ion/10 text-ion shadow-[0_0_14px_rgba(94,234,255,0.25)] hover:bg-ion/20 hover:shadow-[0_0_20px_rgba(94,234,255,0.4)]"
            }`}
          >
            <CameraIcon />
            {camStatus === "on" || camStatus === "starting" ? t.camOffBtn : t.camOnBtn}
          </button>
          <p className="text-[9.5px] font-medium leading-relaxed text-indigo-300/70">{t.camHelp}</p>
        </div>
      </aside>

      {/* ------------------------------ start screen ------------------------------ */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(3,5,20,0.62)] p-4">
          <div className="bracket-panel anim-rise w-full max-w-xl px-6 py-8 sm:px-10 sm:py-9">
            <span className="corner-b" />
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ion/50" />
              <p className="font-display text-[9px] font-bold tracking-[0.3em] text-ion/80">{t.badge}</p>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ion/50" />
            </div>

            <div className="mt-5 text-center">
              <h2 className="font-display text-4xl font-black text-white glow-soft sm:text-5xl">
                {rtl ? (
                  <>
                    خلبان <span className="text-ion glow-cyan">کیهان</span>
                  </>
                ) : (
                  <>
                    POSE<span className="text-ion glow-cyan">PILOT</span>
                  </>
                )}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-indigo-200/90">
                {t.descA}
                <span className="text-star">{t.stars}</span>
                {t.descB}
                <span className="text-ember">{t.meteors}</span>
                {t.descC}
              </p>
            </div>

            <p className="mt-5 text-center font-display text-[10px] font-bold text-indigo-300/80">{t.controlsTitle}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {GUIDE[lang].map((g, i) => (
                <div
                  key={g.cls}
                  className="flex items-start justify-between gap-3 border border-indigo-400/15 bg-[#0d1340]/70 px-3.5 py-2.5 transition-colors duration-150 hover:border-ion/40 hover:bg-[#101a52]"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display text-[9px] font-bold tracking-[0.18em] text-ion/85">{g.cls}</span>
                      <span className="text-[9px] font-bold text-indigo-400/70">
                        · {t.kbdLabel} <span className="kbd">{KBD_KEYS[i]}</span>
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-indigo-100/90">{g.pose}</p>
                    <p className="text-xs font-bold leading-snug text-star">→ {g.action}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-indigo-300/75">
              {t.scoring}
            </p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button onClick={startGame} className="btn-primary anim-floaty px-12 py-3.5 text-base font-black">
                {t.startGame}
              </button>
              <p className="flex items-center gap-2 text-[10px] font-medium text-indigo-300/70">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    modelStatus === "loading" ? "bg-star anim-pulse-glow" : modelStatus === "error" ? "bg-alert" : "bg-ion"
                  }`}
                />
                {modelStatus === "loading" ? t.modelLoading : modelStatus === "error" ? t.modelError : t.camNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ game over ------------------------------ */}
      {phase === "over" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(3,5,20,0.6)] p-4">
          <div className="bracket-panel anim-rise w-full max-w-md px-8 py-9 text-center">
            <span className="corner-b" />
            <p className={`font-display text-[10px] font-bold text-alert ${rtl ? "" : "tracking-[0.34em]"}`}>
              {t.hullBreach}
            </p>
            <h2
              className="mt-2 font-display text-4xl font-black text-white"
              style={{ textShadow: "0 0 26px rgba(255,93,115,0.45)" }}
            >
              {t.gameOver}
            </h2>

            <div className="mt-6 flex items-center justify-center gap-8">
              <div>
                <p className="hud-label">{t.finalScore}</p>
                <p className="mt-1 font-display text-4xl font-black tabular-nums text-star glow-gold">
                  {faNum(String(score).padStart(4, "0"), lang)}
                </p>
              </div>
              <div className="h-12 w-px bg-indigo-400/25" />
              <div>
                <p className="hud-label">{t.starsCaught}</p>
                <p className="mt-1 font-display text-4xl font-black tabular-nums text-ion glow-cyan">
                  {faNum(gsRef.current.collected, lang)}
                </p>
              </div>
            </div>

            <button onClick={restart} className="btn-primary mt-8 px-12 py-3.5 text-base font-black">
              {t.restart}
            </button>
            <p className="mt-3 text-[10px] font-medium text-indigo-300/70">
              {t.relaunchA} <span className="kbd mx-1">SPACE</span> {t.relaunchB} <span className="kbd mx-1">R</span>{" "}
              {t.relaunchC}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
