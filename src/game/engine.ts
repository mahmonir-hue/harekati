/* ------------------------------------------------------------------ */
/*  Pose Pilot — tiny canvas game engine (no physics lib, no deps)     */
/* ------------------------------------------------------------------ */

export interface Input {
  left: boolean;
  right: boolean;
}

export interface Star {
  x: number;
  y: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  pulse: number;
}

export interface Meteor {
  x: number;
  y: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  verts: number[]; // radial multipliers for the rocky outline
  craters: { a: number; d: number; r: number }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
}

export interface BgStar {
  x: number;
  y: number;
  r: number;
  speed: number;
  tw: number; // twinkle speed
  ph: number; // twinkle phase
}

export interface Ship {
  x: number;
  y: number;
  baseY: number;
  vx: number;
  tilt: number;
  boostT: number;
  invulnT: number;
  shield: boolean;
  shieldCoolT: number;
}

export interface GameState {
  w: number;
  h: number;
  ship: Ship;
  stars: Star[];
  meteors: Meteor[];
  particles: Particle[];
  bg: BgStar[];
  starTimer: number;
  meteorTimer: number;
  score: number;
  lives: number;
  collected: number;
  shakeT: number;
  time: number;
  over: boolean;
}

const SHIP_R = 21;
const MOVE_SPEED = 300; // px/s horizontal, smooth & controllable
const BOOST_LIFT = 150; // px upward while boosting
const STAR_SPAWN_MIN = 0.72;
const STAR_SPAWN_VAR = 0.55;
const METEOR_SPAWN_MIN = 2.3;
const METEOR_SPAWN_VAR = 1.7;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------ setup ------------------------------ */

function makeBgStars(w: number, h: number): BgStar[] {
  const count = Math.round((w * h) / 9000);
  const bg: BgStar[] = [];
  for (let i = 0; i < count; i++) {
    const layer = Math.random();
    bg.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: layer < 0.7 ? rand(0.5, 1.1) : rand(1.1, 2),
      speed: layer < 0.7 ? rand(5, 12) : rand(14, 26),
      tw: rand(0.6, 2.4),
      ph: rand(0, Math.PI * 2),
    });
  }
  return bg;
}

function makeShip(w: number, h: number): Ship {
  const baseY = h - 120;
  return {
    x: w / 2,
    y: baseY,
    baseY,
    vx: 0,
    tilt: 0,
    boostT: 0,
    invulnT: 0,
    shield: false,
    shieldCoolT: 0,
  };
}

export function createGame(w: number, h: number): GameState {
  return {
    w,
    h,
    ship: makeShip(w, h),
    stars: [],
    meteors: [],
    particles: [],
    bg: makeBgStars(w, h),
    starTimer: 0.4,
    meteorTimer: 2.2,
    score: 0,
    lives: 3,
    collected: 0,
    shakeT: 0,
    time: 0,
    over: false,
  };
}

export function resetGame(gs: GameState) {
  gs.stars.length = 0;
  gs.meteors.length = 0;
  gs.particles.length = 0;
  gs.ship = makeShip(gs.w, gs.h);
  gs.starTimer = 0.4;
  gs.meteorTimer = 2.2;
  gs.score = 0;
  gs.lives = 3;
  gs.collected = 0;
  gs.shakeT = 0;
  gs.over = false;
}

export function resizeGame(gs: GameState, w: number, h: number) {
  gs.w = w;
  gs.h = h;
  gs.bg = makeBgStars(w, h);
  gs.ship.baseY = h - 120;
  gs.ship.x = Math.min(Math.max(gs.ship.x, 30), w - 30);
  gs.ship.y = Math.min(gs.ship.y, gs.ship.baseY);
}

/* ----------------------------- particles --------------------------- */

function burst(
  gs: GameState,
  x: number,
  y: number,
  n: number,
  colors: string[],
  speed: number,
  size: number,
  life: number
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(speed * 0.3, speed);
    gs.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(life * 0.5, life),
      maxLife: life,
      size: rand(size * 0.5, size),
      color: colors[Math.floor(Math.random() * colors.length)],
      drag: 2.2,
    });
  }
}

export function triggerBoost(gs: GameState) {
  const s = gs.ship;
  if (gs.over || s.boostT > 0.25) return; // prevent spam
  s.boostT = 0.8;
  burst(gs, s.x, s.y + 18, 10, ["#8df2ff", "#5eeaff", "#ffffff"], 120, 3, 0.5);
}

export function triggerShield(gs: GameState) {
  const s = gs.ship;
  if (gs.over || s.shield || s.shieldCoolT > 0) return; // one shield, no spam
  s.shield = true;
  burst(gs, s.x, s.y, 14, ["#5eeaff", "#a5f3ff", "#e0fbff"], 150, 2.6, 0.55);
}

/* ------------------------------ update ----------------------------- */

function spawnEntities(gs: GameState, dt: number) {
  gs.starTimer -= dt;
  if (gs.starTimer <= 0 && gs.stars.length < 12) {
    gs.stars.push({
      x: rand(34, gs.w - 34),
      y: -30,
      vy: rand(65, 115),
      r: rand(10, 14),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.4, 1.4),
      pulse: rand(0, Math.PI * 2),
    });
    gs.starTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MIN + STAR_SPAWN_VAR);
  }

  gs.meteorTimer -= dt;
  if (gs.meteorTimer <= 0 && gs.meteors.length < 6) {
    const verts: number[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) verts.push(rand(0.72, 1.08));
    const craters = [];
    for (let i = 0; i < 3; i++)
      craters.push({ a: rand(0, Math.PI * 2), d: rand(0.15, 0.5), r: rand(0.14, 0.26) });
    gs.meteors.push({
      x: rand(40, gs.w - 40),
      y: -50,
      vy: rand(80, 130), // deliberately slow
      r: rand(16, 27),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.9, 0.9),
      verts,
      craters,
    });
    gs.meteorTimer = rand(METEOR_SPAWN_MIN, METEOR_SPAWN_MIN + METEOR_SPAWN_VAR);
  }
}

function updateShip(gs: GameState, input: Input, dt: number) {
  const s = gs.ship;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const target = dir * MOVE_SPEED;
  s.vx += (target - s.vx) * Math.min(1, dt * 7.5);
  s.x += s.vx * dt;
  if (s.x < 30) {
    s.x = 30;
    s.vx = Math.max(0, s.vx);
  }
  if (s.x > gs.w - 30) {
    s.x = gs.w - 30;
    s.vx = Math.min(0, s.vx);
  }
  s.tilt += ((s.vx / MOVE_SPEED) * 0.28 - s.tilt) * Math.min(1, dt * 10);

  // boost: lift briefly, then glide back to the baseline altitude
  s.boostT = Math.max(0, s.boostT - dt);
  const targetY = s.boostT > 0 ? s.baseY - BOOST_LIFT : s.baseY;
  const k = s.boostT > 0 ? 10 : 3.6;
  s.y += (targetY - s.y) * Math.min(1, dt * k);

  s.invulnT = Math.max(0, s.invulnT - dt);
  s.shieldCoolT = Math.max(0, s.shieldCoolT - dt);

  // engine trail
  if (s.boostT > 0 || Math.abs(s.vx) > 160) {
    gs.particles.push({
      x: s.x + rand(-4, 4),
      y: s.y + 20,
      vx: rand(-15, 15) - s.vx * 0.15,
      vy: rand(50, 110),
      life: rand(0.25, 0.45),
      maxLife: 0.45,
      size: rand(1.5, 3),
      color: s.boostT > 0 ? "#8df2ff" : "#ffb15e",
      drag: 1.5,
    });
  }
}

function handleCollisions(gs: GameState) {
  const s = gs.ship;

  for (let i = gs.stars.length - 1; i >= 0; i--) {
    const st = gs.stars[i];
    const dx = st.x - s.x;
    const dy = st.y - s.y;
    const rr = st.r + SHIP_R + 7;
    if (dx * dx + dy * dy < rr * rr) {
      gs.stars.splice(i, 1);
      gs.score += 10;
      gs.collected += 1;
      burst(gs, st.x, st.y, 12, ["#ffd75e", "#fff3b0", "#ffffff"], 140, 2.6, 0.55);
    }
  }

  if (s.invulnT > 0) return;

  for (let i = gs.meteors.length - 1; i >= 0; i--) {
    const m = gs.meteors[i];
    const dx = m.x - s.x;
    const dy = m.y - s.y;
    const rr = m.r * 0.82 + SHIP_R * 0.85;
    if (dx * dx + dy * dy < rr * rr) {
      gs.meteors.splice(i, 1);
      if (s.shield) {
        // shield absorbs exactly one meteor hit
        s.shield = false;
        s.shieldCoolT = 1.2;
        s.invulnT = 1.1;
        gs.shakeT = 0.25;
        burst(gs, m.x, m.y, 22, ["#5eeaff", "#a5f3ff", "#ff8c42", "#d9dde8"], 210, 3, 0.7);
      } else {
        gs.lives -= 1;
        s.invulnT = 1.8;
        gs.shakeT = 0.45;
        burst(gs, m.x, m.y, 26, ["#ff8c42", "#ffb15e", "#8a8f9e", "#ff5d73"], 230, 3.2, 0.8);
        if (gs.lives <= 0) {
          gs.lives = 0;
          gs.over = true;
          burst(gs, s.x, s.y, 40, ["#8df2ff", "#ff8c42", "#ffffff", "#7c5cff"], 280, 3.4, 1);
        }
      }
    }
  }
}

function updateWorld(gs: GameState, dt: number) {
  for (let i = gs.stars.length - 1; i >= 0; i--) {
    const st = gs.stars[i];
    st.y += st.vy * dt;
    st.rot += st.vr * dt;
    if (st.y > gs.h + 40) gs.stars.splice(i, 1);
  }
  for (let i = gs.meteors.length - 1; i >= 0; i--) {
    const m = gs.meteors[i];
    m.y += m.vy * dt;
    m.rot += m.vr * dt;
    if (m.y > gs.h + 60) gs.meteors.splice(i, 1);
  }
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      gs.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
  }
  for (const b of gs.bg) {
    b.y += b.speed * dt;
    if (b.y > gs.h + 2) {
      b.y = -2;
      b.x = Math.random() * gs.w;
    }
  }
  gs.shakeT = Math.max(0, gs.shakeT - dt);
}

/** Full gameplay tick. */
export function update(gs: GameState, input: Input, dt: number) {
  gs.time += dt;
  updateShip(gs, input, dt);
  spawnEntities(gs, dt);
  updateWorld(gs, dt);
  handleCollisions(gs);
}

/** Idle tick used behind the menu / game-over screens. */
export function updateAmbient(gs: GameState, dt: number) {
  gs.time += dt;
  const s = gs.ship;
  s.x += (gs.w / 2 - s.x) * Math.min(1, dt * 1.5);
  s.y = s.baseY + Math.sin(gs.time * 1.7) * 9;
  s.tilt = Math.sin(gs.time * 1.1) * 0.06;
  updateWorld(gs, dt);
}

/* ------------------------------ render ----------------------------- */

function starPath(ctx: CanvasRenderingContext2D, spikes: number, outer: number, inner: number) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(0, -outer);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
    rot += step;
  }
  ctx.lineTo(0, -outer);
  ctx.closePath();
}

function drawShip(ctx: CanvasRenderingContext2D, s: Ship, t: number) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.tilt);
  if (s.invulnT > 0 && Math.sin(t * 26) > 0) ctx.globalAlpha = 0.4;

  // engine flame
  const boosting = s.boostT > 0;
  const fl = boosting ? 30 + Math.sin(t * 46) * 7 : 13 + Math.sin(t * 30) * 3.5;
  const fg = ctx.createLinearGradient(0, 14, 0, 14 + fl + 8);
  fg.addColorStop(0, boosting ? "rgba(160,244,255,0.95)" : "rgba(255,205,100,0.95)");
  fg.addColorStop(1, "rgba(255,90,40,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-6, 13);
  ctx.quadraticCurveTo(-3, 13 + fl * 0.65, 0, 13 + fl);
  ctx.quadraticCurveTo(3, 13 + fl * 0.65, 6, 13);
  ctx.closePath();
  ctx.fill();

  // fins
  ctx.fillStyle = "#8f7bff";
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.lineTo(-20, 15);
  ctx.lineTo(-8, 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, 2);
  ctx.lineTo(20, 15);
  ctx.lineTo(8, 14);
  ctx.closePath();
  ctx.fill();

  // hull
  ctx.shadowColor = "rgba(140,180,255,0.85)";
  ctx.shadowBlur = 18;
  const hg = ctx.createLinearGradient(-14, 0, 14, 0);
  hg.addColorStop(0, "#aab8f5");
  hg.addColorStop(0.45, "#f8faff");
  hg.addColorStop(1, "#c3cdfc");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.bezierCurveTo(12, -16, 14, -2, 11, 12);
  ctx.lineTo(8, 15);
  ctx.lineTo(-8, 15);
  ctx.lineTo(-11, 12);
  ctx.bezierCurveTo(-14, -2, -12, -16, 0, -24);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(150,170,255,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // window
  const wg = ctx.createRadialGradient(-1.5, -8.5, 1, 0, -7, 7);
  wg.addColorStop(0, "#eafcff");
  wg.addColorStop(0.5, "#5eeaff");
  wg.addColorStop(1, "#1e7fa8");
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.arc(0, -7, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // nose tip + status lights
  ctx.fillStyle = "#ff8fb3";
  ctx.beginPath();
  ctx.arc(0, -21, 2.4, 0, Math.PI * 2);
  ctx.fill();
  const lights: [number, string][] = [
    [-5, "#ffd75e"],
    [0, "#7ef0ff"],
    [5, "#ff8fb3"],
  ];
  lights.forEach(([lx, c], i) => {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5 + i * 2);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(lx, 9.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawShield(ctx: CanvasRenderingContext2D, s: Ship, t: number) {
  if (!s.shield) return;
  ctx.save();
  ctx.translate(s.x, s.y);
  const pr = 35 + Math.sin(t * 6) * 2;
  const g = ctx.createRadialGradient(0, 0, pr * 0.4, 0, 0, pr);
  g.addColorStop(0, "rgba(94,234,255,0)");
  g.addColorStop(1, "rgba(94,234,255,0.16)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "rgba(94,234,255,0.9)";
  ctx.shadowBlur = 14;
  ctx.strokeStyle = "rgba(140,244,255,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.setLineDash([9, 13]);
  ctx.lineDashOffset = -t * 42;
  ctx.strokeStyle = "rgba(94,234,255,0.5)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, pr + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, st: Star, t: number) {
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate(st.rot);
  const pulse = 1 + Math.sin(t * 4 + st.pulse) * 0.08;
  ctx.shadowColor = "rgba(255,215,94,0.95)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffd75e";
  starPath(ctx, 5, st.r * pulse, st.r * 0.45 * pulse);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,252,235,0.95)";
  ctx.beginPath();
  ctx.arc(0, 0, st.r * 0.3 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);
  ctx.shadowColor = "rgba(255,140,64,0.45)";
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(-m.r, -m.r, m.r, m.r);
  g.addColorStop(0, "#a7adbd");
  g.addColorStop(0.55, "#5d6273");
  g.addColorStop(1, "#3a3e4e");
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = m.verts.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = m.r * m.verts[i];
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,170,90,0.3)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "rgba(25,27,38,0.4)";
  for (const c of m.craters) {
    ctx.beginPath();
    ctx.arc(Math.cos(c.a) * m.r * c.d, Math.sin(c.a) * m.r * c.d, m.r * c.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Main render pass. `t` = time in seconds. */
export function render(ctx: CanvasRenderingContext2D, gs: GameState, t: number) {
  const { w, h } = gs;
  ctx.save();

  if (gs.shakeT > 0) {
    const m = gs.shakeT * 16;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // deep-space gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, "#04061a");
  bgGrad.addColorStop(0.55, "#0d1233");
  bgGrad.addColorStop(1, "#251347");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(-20, -20, w + 40, h + 40);

  // drifting nebula glows
  const blob = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(
    w * 0.24 + Math.sin(t * 0.07) * 46,
    h * 0.3 + Math.cos(t * 0.05) * 30,
    Math.max(w, h) * 0.36,
    "rgba(124,92,255,0.17)"
  );
  blob(
    w * 0.78 + Math.cos(t * 0.06) * 40,
    h * 0.6 + Math.sin(t * 0.08) * 36,
    Math.max(w, h) * 0.34,
    "rgba(56,189,248,0.11)"
  );
  blob(
    w * 0.56 + Math.sin(t * 0.045) * 60,
    h * 0.16 + Math.sin(t * 0.07) * 26,
    Math.max(w, h) * 0.28,
    "rgba(236,72,180,0.08)"
  );

  // parallax starfield
  for (const b of gs.bg) {
    const a = 0.22 + 0.58 * (0.5 + 0.5 * Math.sin(t * b.tw + b.ph));
    ctx.fillStyle = `rgba(205,218,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // entities
  for (const st of gs.stars) drawStar(ctx, st, t);
  for (const m of gs.meteors) drawMeteor(ctx, m);

  // particles (additive)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of gs.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (!gs.over) {
    drawShip(ctx, gs.ship, t);
    drawShield(ctx, gs.ship, t);
  }

  ctx.restore();
}
