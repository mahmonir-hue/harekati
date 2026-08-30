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
import { PoseController, type PoseStatus } from "./game/pose";

type Phase = "menu" | "playing" | "over";

interface Detection {
  index: number; // -1 = nothing over threshold
  conf: number; // 0..1 top probability
  locked: boolean;
}

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

/* ------------------------------- app -------------------------------- */

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
  const startingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [shieldOn, setShieldOn] = useState(false);
  const [poseStatus, setPoseStatus] = useState<PoseStatus>("loading");
  const [det, setDet] = useState<Detection>({ index: -1, conf: 0, locked: false });

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

  const startGame = useCallback(async () => {
    if (phaseRef.current === "playing" || startingRef.current) return;
    startingRef.current = true;
    restart();
    // Webcam permission is requested only here, after the user clicks Start.
    const pc = poseRef.current;
    if (pc && previewRef.current) {
      await pc.init();
      await pc.startCamera(previewRef.current);
    }
    startingRef.current = false;
  }, [restart]);

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

    // Pose controller (model preload; camera waits for Start click)
    const pc = new PoseController({
      onStatus: (s) => setPoseStatus(s),
      onDetection: (index, conf, locked) => setDet({ index, conf, locked }),
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
    void pc.init();

    // Keyboard fallback (works even if the webcam fails)
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
          if (phaseRef.current === "menu") void startGame();
          else if (phaseRef.current === "over" && !e.repeat) restart();
          else if (phaseRef.current === "playing" && !e.repeat) triggerShield(gsRef.current);
          break;
        case "Enter":
          if (down && !e.repeat) {
            if (phaseRef.current === "menu") void startGame();
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
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000));
      last = t;
      const gs = gsRef.current;

      if (phaseRef.current === "playing") {
        const dir = poseDirRef.current;
        update(
          gs,
          { left: kbRef.current.left || dir === "left", right: kbRef.current.right || dir === "right" },
          dt
        );
        // sync HUD only when values change
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

      render(ctx, gs, t / 1000);
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

  const statusLine = (() => {
    switch (poseStatus) {
      case "loading":
        return "Loading motion model...";
      case "denied":
        return "Camera blocked — keyboard controls active";
      case "error":
        return "Motion model error — keyboard controls active";
      case "ready":
        return det.locked && det.index >= 0 ? `Detected: Class ${det.index + 1}` : "Scanning for poses...";
      default:
        return "Camera standby — press Start";
    }
  })();

  const confPct = Math.round(det.conf * 100);

  return (
    <div className="relative h-full w-full select-none overflow-hidden font-body">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-50" />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(2,3,14,0.6) 100%)" }}
      />

      {/* ------------------------------ top HUD ------------------------------ */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="anim-rise">
          <h1 className="font-display text-base font-extrabold tracking-[0.32em] text-white sm:text-lg">
            POSE<span className="text-ion glow-cyan">PILOT</span>
          </h1>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.26em] text-indigo-300/70">
            body-controlled space run
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="hud-chip">
            <span className="hud-label">Score</span>
            <span className="font-display text-lg font-bold tabular-nums leading-none text-star glow-gold sm:text-xl">
              {String(score).padStart(4, "0")}
            </span>
          </div>

          <div className="hud-chip" title="Lives">
            <span className="hud-label">Lives</span>
            <span className="flex items-center gap-1 text-ion">
              {[0, 1, 2].map((i) => (
                <ShipIcon key={i} dim={i >= lives} />
              ))}
            </span>
          </div>

          <div className={`hud-chip ${shieldOn ? "hud-chip--active" : ""}`} title="Shield">
            <ShieldIcon on={shieldOn} />
            <span className="hud-label">{shieldOn ? "Shield up" : "No shield"}</span>
          </div>

          {phase !== "menu" && (
            <button
              onClick={restart}
              className="btn-ghost pointer-events-auto flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold"
            >
              <RestartIcon />
              Restart
            </button>
          )}
        </div>
      </header>

      {/* --------------------------- motion cam panel --------------------------- */}
      <aside className="absolute bottom-4 right-4 z-20 w-44 sm:w-52">
        <div className="cam-panel">
          <div className="flex items-center justify-between">
            <span className="hud-label">Motion cam</span>
            <span
              className={`h-2 w-2 rounded-full ${
                poseStatus === "ready"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                  : poseStatus === "loading"
                    ? "bg-star anim-pulse-glow"
                    : poseStatus === "denied" || poseStatus === "error"
                      ? "bg-alert shadow-[0_0_8px_rgba(255,93,115,0.8)]"
                      : "bg-slate-600"
              }`}
            />
          </div>

          <div className="cam-frame relative aspect-[4/3] overflow-hidden">
            <div ref={previewRef} className="absolute inset-0" />
            {poseStatus !== "ready" && (
              <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                {poseStatus === "loading" ? (
                  <span className="font-display text-[9px] font-bold tracking-[0.18em] text-indigo-300 anim-pulse-glow">
                    LOADING MODEL
                  </span>
                ) : poseStatus === "denied" ? (
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 7l4-3h12a2 2 0 0 1 2 2v3l2-1v8l-2-1v3a2 2 0 0 1-2 2H6l-4-3V7z" strokeLinejoin="round" />
                    <path d="M4 4l16 16" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 7l4-3h12a2 2 0 0 1 2 2v3l2-1v8l-2-1v3a2 2 0 0 1-2 2H6l-4-3V7z" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[2.1rem]">
            <p className="font-display text-[10px] font-bold tracking-[0.12em] text-indigo-100">{statusLine}</p>
            {poseStatus === "ready" && (
              <p className="mt-0.5 text-[10px] font-medium tracking-wide text-indigo-300/85">
                Confidence: <span className={`tabular-nums ${det.locked ? "text-ion" : "text-indigo-300/85"}`}>{confPct}%</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => {
              const active = poseStatus === "ready" && det.locked && det.index === i;
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
                  {i + 1}
                </span>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ------------------------------ start screen ------------------------------ */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(3,5,20,0.62)] p-4">
          <div className="bracket-panel anim-rise w-full max-w-xl px-6 py-8 sm:px-10 sm:py-9">
            <span className="corner-b" />
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ion/50" />
              <p className="font-display text-[9px] font-bold tracking-[0.3em] text-ion/80">
                TEACHABLE MACHINE · POSE MODEL
              </p>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ion/50" />
            </div>

            <div className="mt-5 text-center">
              <h2 className="font-display text-4xl font-black tracking-[0.14em] text-white glow-soft sm:text-5xl">
                POSE<span className="text-ion glow-cyan">PILOT</span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-indigo-200/90">
                Steer a tiny spaceship with your body. Catch falling <span className="text-star">stars</span>, dodge{" "}
                <span className="text-ember">meteors</span>, survive the drift.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { cls: "Class 1", act: "Lean left — move left", key: "◀", kbd: "←" },
                { cls: "Class 2", act: "Lean right — move right", key: "▶", kbd: "→" },
                { cls: "Class 3", act: "Shield pose — block one hit", key: "◈", kbd: "SPACE" },
                { cls: "Class 4", act: "Boost pose — hop upward", key: "▲", kbd: "↑" },
              ].map((r) => (
                <div
                  key={r.cls}
                  className="group flex items-center justify-between gap-3 border border-indigo-400/15 bg-[#0d1340]/70 px-3.5 py-2.5 transition-colors duration-150 hover:border-ion/40 hover:bg-[#101a52]"
                >
                  <div className="min-w-0">
                    <p className="font-display text-[9px] font-bold tracking-[0.22em] text-ion/85">
                      {r.cls} <span className="text-indigo-400/60">· {r.key}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-indigo-100/90">{r.act}</p>
                  </div>
                  <span className="kbd shrink-0">{r.kbd}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-indigo-300/75">
              <span className="text-star">★ +10 points</span> per star · <span className="text-ember">meteor −1 life</span> · 3
              lives · shield absorbs one hit
            </p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button onClick={() => void startGame()} className="btn-primary anim-floaty px-12 py-3.5 text-sm font-black">
                Start Game
              </button>
              <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] text-indigo-300/70">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    poseStatus === "loading" ? "bg-star anim-pulse-glow" : poseStatus === "error" ? "bg-alert" : "bg-ion"
                  }`}
                />
                {poseStatus === "loading"
                  ? "LOADING MOTION MODEL..."
                  : poseStatus === "error"
                    ? "MODEL UNAVAILABLE — KEYBOARD CONTROLS READY"
                    : "CAMERA ASKS PERMISSION ONLY AFTER START"}
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
            <p className="font-display text-[10px] font-bold tracking-[0.34em] text-alert">HULL BREACH</p>
            <h2 className="mt-2 font-display text-4xl font-black tracking-[0.12em] text-white" style={{ textShadow: "0 0 26px rgba(255,93,115,0.45)" }}>
              SIGNAL LOST
            </h2>

            <div className="mt-6 flex items-center justify-center gap-8">
              <div>
                <p className="hud-label">Final score</p>
                <p className="mt-1 font-display text-4xl font-black tabular-nums text-star glow-gold">
                  {String(score).padStart(4, "0")}
                </p>
              </div>
              <div className="h-12 w-px bg-indigo-400/25" />
              <div>
                <p className="hud-label">Stars caught</p>
                <p className="mt-1 font-display text-4xl font-black tabular-nums text-ion glow-cyan">{gsRef.current.collected}</p>
              </div>
            </div>

            <button onClick={restart} className="btn-primary mt-8 px-12 py-3.5 text-sm font-black">
              Restart
            </button>
            <p className="mt-3 text-[10px] font-medium tracking-[0.2em] text-indigo-300/70">
              PRESS <span className="kbd mx-1">SPACE</span> OR <span className="kbd mx-1">R</span> TO RELAUNCH
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
