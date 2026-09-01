/* Space Pilot game engine — entities, rules, and canvas rendering. */

export interface BgStar {
  x: number;
  y: number;
  layer: number;
  r: number;
  speed: number;
  tw: number;
  ph: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  vy: number;
  tw: number;
  ph: number;
}

export interface Meteor {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  seed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  color: string;
}

export interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tilt: number;
  boostT: number;
  invulnT: number;
  shield: boolean;
  shieldCoolT: number;
}

export interface GameState {
  w: number;
  h: number;
  t: number;
  bg: BgStar[];
  stars: Star[];
  meteors: Meteor[];
  particles: Particle[];
  ship: Ship;
  score: number;
  lives: number;
  collected: number;
  starTimer: number;
  meteorTimer: number;
  shake: number;
  over: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
}

const SHIP_R = 21;
const MOVE_SPEED = 300; // px/s horizontal, smooth & controllable
const BOOST_TIME = 0.8;
const BOOST_LIFT = 150; // px/s upward while boosting
const STAR_SPAWN_MIN = 0.72;
const STAR_SPAWN_VAR = 0.55;
const METEOR_SPAWN_MIN = 2.3;
const METEOR_SPAWN_VAR = 1.7;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makeBg(w: number, h: number): BgStar[] {
  const n = Math.min(220, Math.round((w * h) / 6500));
  const out: BgStar[] = [];
  for (let i = 0; i < n; i++) {
    const layer = Math.random();
    out.push({
      x: Math.random() * w,
      y: Math.random() * h,
      layer,
      r: layer < 0.7 ? rand(0.5, 1.1) : rand(1.1, 2),
      speed: layer < 0.7 ? rand(5, 12) : rand(14, 26),
      tw: rand(0.6, 2.4),
      ph: rand(0, Math.PI * 2),
    });
  }
  return out;
}

function newShip(w: number, h: number): Ship {
  return {
    x: w / 2,
    y: h - 110,
    vx: 0,
    vy: 0,
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
    t: 0,
    bg: makeBg(w, h),
    stars: [],
    meteors: [],
    particles: [],
    ship: newShip(w, h),
    score: 0,
    lives: 3,
    collected: 0,
    starTimer: rand(0.2, 0.6),
    meteorTimer: rand(1.4, 2.2),
    shake: 0,
    over: false,
  };
}

export function resetGame(gs: GameState) {
  gs.stars = [];
  gs.meteors = [];
  gs.particles = [];
  gs.ship = newShip(gs.w, gs.h);
  gs.score = 0;
  gs.lives = 3;
  gs.collected = 0;
  gs.starTimer = rand(0.2, 0.6);
  gs.meteorTimer = rand(1.4, 2.2);
  gs.shake = 0;
  gs.over = false;
}

export function resizeGame(gs: GameState, w: number, h: number) {
  const first = gs.w !== w || gs.h !== h;
  gs.w = w;
  gs.h = h;
  if (first) gs.bg = makeBg(w, h);
  gs.ship.x = Math.min(Math.max(gs.ship.x, SHIP_R + 6), w - SHIP_R - 6);
  gs.ship.y = Math.min(gs.ship.y, h - 90);
}

export function triggerShield(gs: GameState) {
  const s = gs.ship;
  if (gs.over || s.shield || s.shieldCoolT > 0) return; // one shield, no spam
  s.shield = true;
  burst(gs, s.x, s.y, 14, ["#5eeaff", "#a5f3ff", "#e0fbff"], 150, 2.6, 0.55);
}

export function triggerBoost(gs: GameState) {
  const s = gs.ship;
  if (gs.over || s.boostT > 0) return;
  s.boostT = BOOST_TIME;
  burst(gs, s.x, s.y + SHIP_R, 10, ["#ffd75e", "#ffb15e", "#ff8c42"], 120, 2.2, 0.5);
}

function burst(
  gs: GameState,
  x: number,
  y: number,
  count: number,
  colors: string[],
  speed: number,
  size: number,
  life: number
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(speed * 0.3, speed);
    gs.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(life * 0.6, life),
      age: 0,
      size: rand(size * 0.6, size),
      color: colors[i % colors.length],
    });
  }
}

function spawnEntities(gs: GameState, dt: number) {
  gs.starTimer -= dt;
  if (gs.starTimer <= 0) {
    gs.stars.push({
      x: rand(24, gs.w - 24),
      y: -20,
      r: rand(7, 11),
      vy: rand(55, 95),
      tw: rand(1.5, 3.5),
      ph: rand(0, Math.PI * 2),
    });
    gs.starTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MIN + STAR_SPAWN_VAR);
  }

  gs.meteorTimer -= dt;
  if (gs.meteorTimer <= 0) {
    gs.meteors.push({
      x: rand(30, gs.w - 30),
      y: -30,
      r: rand(13, 22),
      vx: rand(-25, 25),
      vy: rand(90, 140),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.6, 1.6),
      seed: Math.random() * 10,
    });
    gs.meteorTimer = rand(METEOR_SPAWN_MIN, METEOR_SPAWN_MIN + METEOR_SPAWN_VAR);
  }
}

function updateShip(gs: GameState, input: InputState, dt: number) {
  const s = gs.ship;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const target = dir * MOVE_SPEED;
  s.vx += (target - s.vx) * Math.min(1, dt * 7.5);
  s.x += s.vx * dt;
  s.x = Math.min(Math.max(s.x, SHIP_R + 6), gs.w - SHIP_R - 6);

  if (s.boostT > 0) {
    s.boostT -= dt;
    s.vy += (-BOOST_LIFT - s.vy) * Math.min(1, dt * 8);
  } else {
    s.vy += (55 - s.vy) * Math.min(1, dt * 3); // gentle sink back down
  }
  s.y += s.vy * dt;
  s.y = Math.min(Math.max(s.y, gs.h * 0.3), gs.h - 90);

  s.tilt += ((s.vx / MOVE_SPEED) * 0.28 - s.tilt) * Math.min(1, dt * 10);
  s.invulnT = Math.max(0, s.invulnT - dt);
  s.shieldCoolT = Math.max(0, s.shieldCoolT - dt);
}

function updateWorld(gs: GameState, dt: number) {
  const s = gs.ship;

  for (let i = gs.stars.length - 1; i >= 0; i--) {
    const st = gs.stars[i];
    st.y += st.vy * dt;
    if (st.y > gs.h + 30) {
      gs.stars.splice(i, 1);
      continue;
    }
    const dx = st.x - s.x;
    const dy = st.y - s.y;
    if (dx * dx + dy * dy < (st.r + SHIP_R * 0.95) ** 2) {
      gs.stars.splice(i, 1);
      gs.score += 10;
      gs.collected += 1;
      burst(gs, st.x, st.y, 12, ["#ffd75e", "#ffe59a", "#fff6d8"], 160, 2.6, 0.6);
    }
  }

  for (let i = gs.meteors.length - 1; i >= 0; i--) {
    const m = gs.meteors[i];
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.rot += m.vr * dt;
    if (m.y > gs.h + 40 || m.x < -50 || m.x > gs.w + 50) {
      gs.meteors.splice(i, 1);
      continue;
    }
    const dx = m.x - s.x;
    const dy = m.y - s.y;
    if (dx * dx + dy * dy < (m.r * 0.85 + SHIP_R * 0.8) ** 2) {
      gs.meteors.splice(i, 1);
      if (s.shield) {
        // shield absorbs exactly one meteor hit
        s.shield = false;
        s.shieldCoolT = 1.2;
        s.invulnT = 1.1;
        burst(gs, m.x, m.y, 18, ["#5eeaff", "#a5f3ff", "#8a8f9e"], 200, 2.8, 0.7);
      } else if (s.invulnT <= 0) {
        gs.lives -= 1;
        s.invulnT = 1.8;
        gs.shake = 14;
        burst(gs, m.x, m.y, 26, ["#ff8c42", "#ffb15e", "#8a8f9e", "#ff5d73"], 230, 3.2, 0.8);
        if (gs.lives <= 0) {
          gs.lives = 0;
          gs.over = true;
          burst(gs, s.x, s.y, 40, ["#5eeaff", "#ff8c42", "#ff5d73", "#ffd75e"], 300, 3.4, 1);
        }
      }
    }
  }

  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      gs.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.2;
    p.vy *= 1 - dt * 2.2;
  }
}

export function updateAmbient(gs: GameState, dt: number) {
  gs.t += dt;
  for (const b of gs.bg) {
    b.y += b.speed * dt;
    if (b.y > gs.h + 2) {
      b.y = -2;
      b.x = Math.random() * gs.w;
    }
  }
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      gs.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.2;
    p.vy *= 1 - dt * 2.2;
  }
}

export function update(gs: GameState, input: InputState, dt: number) {
  gs.t += dt;
  for (const b of gs.bg) {
    b.y += b.speed * dt;
    if (b.y > gs.h + 2) {
      b.y = -2;
      b.x = Math.random() * gs.w;
    }
  }
  updateShip(gs, input, dt);
  spawnEntities(gs, dt);
  updateWorld(gs, dt);
  gs.shake = Math.max(0, gs.shake - dt * 40);
}

/* ------------------------------ rendering ------------------------------ */

function drawBg(ctx: CanvasRenderingContext2D, gs: GameState, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, gs.h);
  g.addColorStop(0, "#050722");
  g.addColorStop(0.5, "#0a0f38");
  g.addColorStop(1, "#141042");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, gs.w, gs.h);

  // nebula glows
  const nebs: Array<[number, number, number, string]> = [
    [gs.w * 0.22 + Math.sin(t * 0.11) * 30, gs.h * 0.3, gs.w * 0.4, "rgba(124,92,255,0.14)"],
    [gs.w * 0.8 - Math.sin(t * 0.09) * 26, gs.h * 0.62, gs.w * 0.36, "rgba(94,234,255,0.1)"],
    [gs.w * 0.55, gs.h * 0.9 + Math.cos(t * 0.08) * 20, gs.w * 0.42, "rgba(255,93,115,0.07)"],
  ];
  for (const [x, y, r, c] of nebs) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // parallax stars
  for (const b of gs.bg) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * b.tw + b.ph));
    ctx.globalAlpha = a * (0.4 + b.layer * 0.6);
    ctx.fillStyle = b.layer > 0.85 ? "#cfe9ff" : "#8fa2e8";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStar(ctx: CanvasRenderingContext2D, st: Star, t: number) {
  const pulse = 1 + 0.12 * Math.sin(t * st.tw + st.ph);
  const r = st.r * pulse;
  const rg = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, r * 3);
  rg.addColorStop(0, "rgba(255,231,150,0.85)");
  rg.addColorStop(0.4, "rgba(255,215,94,0.3)");
  rg.addColorStop(1, "rgba(255,215,94,0)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(st.x, st.y, r * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate(t * 0.7 + st.ph);
  ctx.fillStyle = "#ffd75e";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.42;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
  // trail
  const tg = ctx.createLinearGradient(m.x, m.y - m.r * 3, m.x, m.y);
  tg.addColorStop(0, "rgba(255,140,66,0)");
  tg.addColorStop(1, "rgba(255,140,66,0.35)");
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(m.x - m.r * 0.7, m.y);
  ctx.lineTo(m.x + m.r * 0.7, m.y);
  ctx.lineTo(m.x + m.r * 0.25, m.y - m.r * 3);
  ctx.lineTo(m.x - m.r * 0.25, m.y - m.r * 3);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);
  ctx.fillStyle = "#6b6f7d";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = m.r * (0.75 + 0.25 * Math.sin(m.seed * 7 + i * 2.4));
    const a = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a8f9e";
  ctx.beginPath();
  ctx.arc(-m.r * 0.2, -m.r * 0.15, m.r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8c42";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(m.r * 0.3, m.r * 0.25, m.r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, s: Ship, t: number) {
  if (s.invulnT > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.45;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.tilt);

  // engine flame
  const flame = s.boostT > 0 ? 1.9 : 1;
  const fl = (14 + Math.sin(t * 26) * 4) * flame;
  const fg = ctx.createLinearGradient(0, SHIP_R * 0.6, 0, SHIP_R * 0.6 + fl);
  fg.addColorStop(0, "rgba(255,215,94,0.95)");
  fg.addColorStop(1, "rgba(255,140,66,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-6, SHIP_R * 0.55);
  ctx.quadraticCurveTo(0, SHIP_R * 0.6 + fl, 6, SHIP_R * 0.55);
  ctx.closePath();
  ctx.fill();

  // hull
  const hg = ctx.createLinearGradient(0, -SHIP_R, 0, SHIP_R);
  hg.addColorStop(0, "#8df2ff");
  hg.addColorStop(1, "#35cbe8");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, -SHIP_R);
  ctx.quadraticCurveTo(SHIP_R * 0.72, -SHIP_R * 0.25, SHIP_R * 0.62, SHIP_R * 0.45);
  ctx.lineTo(SHIP_R * 0.85, SHIP_R * 0.72);
  ctx.lineTo(SHIP_R * 0.3, SHIP_R * 0.55);
  ctx.lineTo(0, SHIP_R * 0.72);
  ctx.lineTo(-SHIP_R * 0.3, SHIP_R * 0.55);
  ctx.lineTo(-SHIP_R * 0.85, SHIP_R * 0.72);
  ctx.lineTo(-SHIP_R * 0.62, SHIP_R * 0.45);
  ctx.quadraticCurveTo(-SHIP_R * 0.72, -SHIP_R * 0.25, 0, -SHIP_R);
  ctx.closePath();
  ctx.fill();

  // window
  ctx.fillStyle = "#0a0f2e";
  ctx.beginPath();
  ctx.arc(0, -SHIP_R * 0.15, SHIP_R * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a5f3ff";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // nose glow
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(0, -SHIP_R * 0.62, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawShield(ctx: CanvasRenderingContext2D, s: Ship, t: number) {
  if (!s.shield) return;
  const r = SHIP_R * 1.75 + Math.sin(t * 5) * 2;
  const rg = ctx.createRadialGradient(s.x, s.y, r * 0.5, s.x, s.y, r);
  rg.addColorStop(0, "rgba(94,234,255,0)");
  rg.addColorStop(0.8, "rgba(94,234,255,0.12)");
  rg.addColorStop(1, "rgba(94,234,255,0.35)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(94,234,255,0.8)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -t * 30;
  ctx.stroke();
  ctx.setLineDash([]);
}

export function render(ctx: CanvasRenderingContext2D, gs: GameState, t: number) {
  ctx.save();
  if (gs.shake > 0) {
    ctx.translate(rand(-gs.shake, gs.shake) * 0.5, rand(-gs.shake, gs.shake) * 0.5);
  }

  drawBg(ctx, gs, t);
  for (const st of gs.stars) drawStar(ctx, st, t);
  for (const m of gs.meteors) drawMeteor(ctx, m);

  for (const p of gs.particles) {
    const k = 1 - p.age / p.life;
    ctx.globalAlpha = k;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (!gs.over) {
    drawShip(ctx, gs.ship, t);
    drawShield(ctx, gs.ship, t);
  }

  ctx.restore();
}
