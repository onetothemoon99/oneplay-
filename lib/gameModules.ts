/* ---------------------------------------------------------
   ONEPLAY — playable game modules
   Every module: factory(api) -> { update(dt), draw(g), pointer?, keydown? }
   Logical canvas is always 960 x 540.
   api: { w, h, keys, addScore, setScore, setStat, gameOver }
--------------------------------------------------------- */

/** The four directions and the action button, as the Runner polls them. */
export interface GameKeys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

/** Everything lib/runner.ts hands a module. */
export interface GameApi {
  /** Logical canvas width — always 960. */
  w: number;
  /** Logical canvas height — always 540. */
  h: number;
  keys: GameKeys;
  addScore(n: number): void;
  setScore(n: number): void;
  setStat(key: string, value: string | number): void;
  gameOver(): void;
}

/** What a module hands back. `pointer` and `keydown` are optional. */
export interface GameInstance {
  update(dt: number): void;
  draw(g: CanvasRenderingContext2D): void;
  pointer?(x: number, y: number, kind?: 'move' | 'down'): void;
  keydown?(code: string): void;
}

export type GameFactory = (api: GameApi) => GameInstance;

const W = 960;
const H = 540;

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randInt = (a: number, b: number): number => Math.floor(rand(a, b + 1));

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function bg(g: CanvasRenderingContext2D, c1: string, c2: string): void {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 13,
  color = 'rgba(255,255,255,.55)',
  align: CanvasTextAlign = 'left'
): void {
  g.font = `500 ${size}px "JetBrains Mono", monospace`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
  g.textAlign = 'left';
}

export const PSGames: Record<string, GameFactory> = {};

/* =========================================================
   1. ASTRO DRIFT — rotate / thrust / shoot
========================================================= */
interface Bullet { x: number; y: number; vx: number; vy: number; life: number }

interface Rock {
  x: number; y: number; size: number; r: number;
  vx: number; vy: number; spin: number; rot: number;
  points: { a: number; r: number }[];
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }

PSGames['astro-drift'] = (api: GameApi): GameInstance => {
  const ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, r: 12 };
  let bullets: Bullet[] = [];
  let rocks: Rock[] = [];
  let stars = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.4, 1.6) }));
  let lives = 3;
  let wave = 0;
  let invuln = 1.5;
  let cool = 0;
  let particles: Particle[] = [];

  function spawnWave(): void {
    wave++;
    api.setStat('WAVE', wave);
    const count = 3 + wave;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do { x = rand(0, W); y = rand(0, H); } while (Math.hypot(x - ship.x, y - ship.y) < 180);
      rocks.push(makeRock(x, y, 3));
    }
  }

  function makeRock(x: number, y: number, size: number): Rock {
    const speed = rand(24, 46) + wave * 3;
    const dir = rand(0, Math.PI * 2);
    const points = Array.from({ length: 9 }, (_, i) => ({
      a: (i / 9) * Math.PI * 2,
      r: rand(0.72, 1.12)
    }));
    return { x, y, size, r: size * 14, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, spin: rand(-1.4, 1.4), rot: 0, points };
  }

  function burst(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 200);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.7), max: 0.7, color });
    }
  }

  function resetShip(): void {
    ship.x = W / 2; ship.y = H / 2; ship.vx = 0; ship.vy = 0; ship.a = -Math.PI / 2;
    invuln = 2;
  }

  spawnWave();
  api.setStat('LIVES', lives);

  return {
    update(dt: number) {
      const k = api.keys;
      if (k.left) ship.a -= 3.4 * dt;
      if (k.right) ship.a += 3.4 * dt;
      if (k.up) {
        ship.vx += Math.cos(ship.a) * 300 * dt;
        ship.vy += Math.sin(ship.a) * 300 * dt;
        burst(ship.x - Math.cos(ship.a) * 14, ship.y - Math.sin(ship.a) * 14, 1, '255,180,80');
      }
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > 380) { ship.vx *= 380 / sp; ship.vy *= 380 / sp; }
      ship.vx *= 1 - 0.42 * dt;
      ship.vy *= 1 - 0.42 * dt;
      ship.x = (ship.x + ship.vx * dt + W) % W;
      ship.y = (ship.y + ship.vy * dt + H) % H;

      cool -= dt;
      if (k.fire && cool <= 0) {
        cool = 0.19;
        bullets.push({ x: ship.x + Math.cos(ship.a) * 16, y: ship.y + Math.sin(ship.a) * 16, vx: Math.cos(ship.a) * 520 + ship.vx, vy: Math.sin(ship.a) * 520 + ship.vy, life: 1.1 });
      }

      bullets.forEach((b) => { b.x = (b.x + b.vx * dt + W) % W; b.y = (b.y + b.vy * dt + H) % H; b.life -= dt; });
      bullets = bullets.filter((b) => b.life > 0);

      rocks.forEach((r) => {
        r.x = (r.x + r.vx * dt + W) % W;
        r.y = (r.y + r.vy * dt + H) % H;
        r.rot += r.spin * dt;
      });

      particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
      particles = particles.filter((p) => p.life > 0);

      // bullet vs rock
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
            bullets.splice(j, 1);
            rocks.splice(i, 1);
            api.addScore(r.size === 3 ? 20 : r.size === 2 ? 50 : 100);
            burst(r.x, r.y, 14, '255,255,255');
            if (r.size > 1) {
              rocks.push(makeRock(r.x, r.y, r.size - 1));
              rocks.push(makeRock(r.x, r.y, r.size - 1));
            }
            break;
          }
        }
      }

      // ship vs rock
      invuln -= dt;
      if (invuln <= 0) {
        for (const r of rocks) {
          if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + ship.r) {
            lives--;
            api.setStat('LIVES', lives);
            burst(ship.x, ship.y, 26, '255,90,90');
            if (lives <= 0) { api.gameOver(); return; }
            resetShip();
            break;
          }
        }
      }

      if (!rocks.length) spawnWave();
    },

    draw(g: CanvasRenderingContext2D) {
      bg(g, '#0a0a14', '#150b22');
      stars.forEach((s) => {
        g.fillStyle = `rgba(255,255,255,${0.18 + s.s * 0.28})`;
        g.fillRect(s.x, s.y, s.s, s.s);
      });

      particles.forEach((p) => {
        g.fillStyle = `rgba(${p.color},${clamp(p.life / p.max, 0, 1)})`;
        g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      });

      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.lineWidth = 1.6;
      rocks.forEach((r) => {
        g.save();
        g.translate(r.x, r.y);
        g.rotate(r.rot);
        g.beginPath();
        r.points.forEach((p, i) => {
          const px = Math.cos(p.a) * r.r * p.r;
          const py = Math.sin(p.a) * r.r * p.r;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        });
        g.closePath();
        g.fillStyle = 'rgba(124,58,237,.22)';
        g.fill();
        g.stroke();
        g.restore();
      });

      g.fillStyle = '#FDE68A';
      bullets.forEach((b) => { g.fillRect(b.x - 2, b.y - 2, 4, 4); });

      if (invuln <= 0 || Math.floor(invuln * 10) % 2 === 0) {
        g.save();
        g.translate(ship.x, ship.y);
        g.rotate(ship.a);
        g.beginPath();
        g.moveTo(16, 0); g.lineTo(-11, 9); g.lineTo(-6, 0); g.lineTo(-11, -9);
        g.closePath();
        g.fillStyle = '#fff';
        g.fill();
        g.restore();
      }
    }
  };
};

/* =========================================================
   2. NEON RUNNER — jump / slide
========================================================= */
interface Obstacle { kind: 'block' | 'beam'; x: number; y: number; w: number; h: number }

PSGames['neon-runner'] = (api: GameApi): GameInstance => {
  const GROUND = 430;
  const player = { x: 170, y: GROUND, vy: 0, h: 46, sliding: 0, onGround: true };
  let speed = 300;
  let obstacles: Obstacle[] = [];
  let spawnIn = 1.1;
  let dist = 0;
  let skyline = Array.from({ length: 26 }, (_, i) => ({ x: i * 60, w: rand(30, 62), h: rand(50, 190) }));
  let dashes = Array.from({ length: 24 }, (_, i) => ({ x: i * 44 }));

  return {
    update(dt: number) {
      const k = api.keys;
      speed = 300 + Math.min(dist * 0.06, 320);
      dist += speed * dt * 0.1;
      api.setScore(Math.floor(dist));
      api.setStat('SPEED', Math.round(speed / 10) + ' m/s');

      // jump
      if ((k.up || k.fire) && player.onGround) {
        player.vy = -620;
        player.onGround = false;
      }
      if (!player.onGround && !(k.up || k.fire) && player.vy < -260) player.vy = -260; // variable height

      player.sliding = k.down && player.onGround ? 0.25 : Math.max(0, player.sliding - dt);
      player.h = k.down && player.onGround ? 24 : 46;

      player.vy += 1750 * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND) { player.y = GROUND; player.vy = 0; player.onGround = true; }

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = rand(0.72, 1.25) * (300 / speed) + 0.28;
        const kind = Math.random() < 0.62 ? 'block' : 'beam';
        obstacles.push(
          kind === 'block'
            ? { kind, x: W + 40, y: GROUND - 40, w: rand(22, 40), h: 40 }
            : { kind, x: W + 40, y: GROUND - 76, w: 46, h: 22 }
        );
      }

      obstacles.forEach((o) => { o.x -= speed * dt; });
      obstacles = obstacles.filter((o) => o.x + o.w > -60);

      skyline.forEach((b) => { b.x -= speed * dt * 0.25; if (b.x + b.w < 0) { b.x += 26 * 60; b.h = rand(50, 190); } });
      dashes.forEach((d) => { d.x -= speed * dt; if (d.x < -30) d.x += 24 * 44; });

      const px = player.x - 14, pw = 28;
      const py = player.y - player.h, ph = player.h;
      for (const o of obstacles) {
        if (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y) {
          api.gameOver();
          return;
        }
      }
    },

    draw(g: CanvasRenderingContext2D) {
      bg(g, '#04121c', '#0b1030');
      g.fillStyle = 'rgba(56,189,248,.16)';
      skyline.forEach((b) => { g.fillRect(b.x, GROUND - b.h, b.w, b.h); });

      g.fillStyle = 'rgba(255,255,255,.10)';
      g.fillRect(0, GROUND, W, H - GROUND);
      g.strokeStyle = '#38BDF8';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, GROUND); g.lineTo(W, GROUND); g.stroke();

      g.fillStyle = 'rgba(56,189,248,.5)';
      dashes.forEach((d) => g.fillRect(d.x, GROUND + 22, 22, 3));

      obstacles.forEach((o) => {
        g.fillStyle = o.kind === 'block' ? '#F472B6' : '#FACC15';
        roundRect(g, o.x, o.y, o.w, o.h, 4);
        g.fill();
      });

      g.fillStyle = '#fff';
      roundRect(g, player.x - 14, player.y - player.h, 28, player.h, 6);
      g.fill();
      g.fillStyle = '#0b1030';
      g.fillRect(player.x - 4, player.y - player.h + 10, 12, 5);

      label(g, 'DISTANCE ' + Math.floor(dist) + ' M', 24, H - 22, 13);
    }
  };
};

/* =========================================================
   3. BLOCK FALL — falling block puzzle
========================================================= */
/** A grid position, or one cell of a tetromino's rotation. */
type Cell = [x: number, y: number];

interface ShapeDef { c: string; r: Cell[][] }

interface Piece { t: string; rot: number; x: number; y: number }

PSGames['block-fall'] = (api: GameApi): GameInstance => {
  const COLS = 10, ROWS = 20, CELL = 24;
  const OX = (W - COLS * CELL) / 2 - 90;
  const OY = (H - ROWS * CELL) / 2;
  const SHAPES: Record<string, ShapeDef> = {
    I: { c: '#22D3EE', r: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]]] },
    O: { c: '#FACC15', r: [[[1, 0], [2, 0], [1, 1], [2, 1]]] },
    T: { c: '#C084FC', r: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]] },
    S: { c: '#4ADE80', r: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]]] },
    Z: { c: '#FB7185', r: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]]] },
    J: { c: '#60A5FA', r: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]] },
    L: { c: '#FB923C', r: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]] }
  };
  const KEYS = Object.keys(SHAPES);

  let grid: (string | null)[][] = Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
  let bag: string[] = [];
  let cur: Piece, next: Piece;
  let dropTimer = 0, level = 1, lines = 0;
  let moveTimer = 0, softTimer = 0;

  function pull(): Piece {
    if (!bag.length) bag = KEYS.slice().sort(() => Math.random() - 0.5);
    const t = bag.pop()!;
    return { t, rot: 0, x: 3, y: -1 };
  }
  function cells(p: Piece): Cell[] {
    const set = SHAPES[p.t].r[p.rot % SHAPES[p.t].r.length];
    return set.map(([x, y]): Cell => [p.x + x, p.y + y]);
  }
  function fits(p: Piece): boolean {
    return cells(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !grid[y][x]));
  }
  function lock(): void {
    cells(cur).forEach(([x, y]) => { if (y >= 0) grid[y][x] = SHAPES[cur.t].c; });
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1);
        grid.unshift(Array<string | null>(COLS).fill(null));
        cleared++; y++;
      }
    }
    if (cleared) {
      lines += cleared;
      api.addScore([0, 100, 300, 500, 800][cleared] * level);
      level = Math.min(10, 1 + Math.floor(lines / 8));
      api.setStat('LEVEL', level);
      api.setStat('LINES', lines);
    }
    cur = next; next = pull();
    if (!fits(cur)) api.gameOver();
  }

  cur = pull(); next = pull();
  api.setStat('LEVEL', 1);
  api.setStat('LINES', 0);

  return {
    keydown(code: string) {
      if (code === 'ArrowUp' || code === 'KeyX') {
        const t = { ...cur, rot: (cur.rot + 1) % SHAPES[cur.t].r.length };
        if (fits(t)) cur = t;
        else { const k = { ...t, x: t.x - 1 }; if (fits(k)) cur = k; }
      }
      if (code === 'Space') {
        while (fits({ ...cur, y: cur.y + 1 })) { cur.y++; api.addScore(2); }
        lock();
      }
    },
    update(dt: number) {
      const k = api.keys;
      moveTimer -= dt;
      if ((k.left || k.right) && moveTimer <= 0) {
        const t = { ...cur, x: cur.x + (k.left ? -1 : 1) };
        if (fits(t)) cur = t;
        moveTimer = 0.11;
      }
      if (!k.left && !k.right) moveTimer = 0;

      softTimer -= dt;
      if (k.down && softTimer <= 0) {
        if (fits({ ...cur, y: cur.y + 1 })) { cur.y++; api.addScore(1); }
        softTimer = 0.05;
      }

      dropTimer += dt;
      const step = Math.max(0.08, 0.85 - (level - 1) * 0.075);
      if (dropTimer >= step) {
        dropTimer = 0;
        if (fits({ ...cur, y: cur.y + 1 })) cur.y++;
        else lock();
      }
    },
    draw(g: CanvasRenderingContext2D) {
      bg(g, '#07160f', '#0d1b0c');

      g.fillStyle = 'rgba(0,0,0,.42)';
      roundRect(g, OX - 8, OY - 8, COLS * CELL + 16, ROWS * CELL + 16, 8);
      g.fill();

      g.strokeStyle = 'rgba(255,255,255,.07)';
      g.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(OX + x * CELL, OY); g.lineTo(OX + x * CELL, OY + ROWS * CELL); g.stroke(); }
      for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(OX, OY + y * CELL); g.lineTo(OX + COLS * CELL, OY + y * CELL); g.stroke(); }

      const cellAt = (x: number, y: number, color: string, alpha = 1): void => {
        g.globalAlpha = alpha;
        g.fillStyle = color;
        roundRect(g, OX + x * CELL + 1.5, OY + y * CELL + 1.5, CELL - 3, CELL - 3, 3);
        g.fill();
        g.globalAlpha = 1;
      };

      grid.forEach((row, y) => row.forEach((c, x) => c && cellAt(x, y, c)));

      // ghost
      const ghost = { ...cur };
      while (fits({ ...ghost, y: ghost.y + 1 })) ghost.y++;
      cells(ghost).forEach(([x, y]) => y >= 0 && cellAt(x, y, '#ffffff', 0.16));
      cells(cur).forEach(([x, y]) => y >= 0 && cellAt(x, y, SHAPES[cur.t].c));

      // next preview
      const px = OX + COLS * CELL + 40;
      label(g, 'NEXT', px, OY + 14, 12);
      g.fillStyle = 'rgba(0,0,0,.42)';
      roundRect(g, px, OY + 26, 120, 100, 8);
      g.fill();
      SHAPES[next.t].r[0].forEach(([x, y]) => {
        g.fillStyle = SHAPES[next.t].c;
        roundRect(g, px + 22 + x * 20, OY + 52 + y * 20, 17, 17, 3);
        g.fill();
      });
      label(g, 'LEVEL ' + level, px, OY + 168, 12);
      label(g, 'LINES ' + lines, px, OY + 192, 12);
    }
  };
};

/* =========================================================
   4. SKY BREAKER — brick breaker
========================================================= */
interface Brick { x: number; y: number; w: number; h: number; c: string; hp: number }

PSGames['sky-breaker'] = (api: GameApi): GameInstance => {
  const paddle = { x: W / 2 - 56, y: H - 54, w: 112, h: 13 };
  let ball = { x: W / 2, y: paddle.y - 12, vx: 0, vy: 0, r: 7, stuck: true };
  let bricks: Brick[] = [];
  let lives = 3, level = 1;
  const COLORS = ['#F43F5E', '#F97316', '#FACC15', '#4ADE80', '#38BDF8', '#A78BFA'];

  function build(): void {
    bricks = [];
    const cols = 12, rows = 6, bw = 62, bh = 22, gap = 6;
    const ox = (W - (cols * (bw + gap) - gap)) / 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        bricks.push({ x: ox + c * (bw + gap), y: 90 + r * (bh + gap), w: bw, h: bh, c: COLORS[r], hp: r < 2 ? 2 : 1 });
  }
  function launch(): void {
    ball.stuck = false;
    ball.vx = rand(-140, 140);
    ball.vy = -(340 + level * 18);
  }
  build();
  api.setStat('LIVES', lives);
  api.setStat('LEVEL', level);

  return {
    keydown(code: string) { if ((code === 'Space' || code === 'ArrowUp') && ball.stuck) launch(); },
    pointer(x: number) { paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w); },
    update(dt: number) {
      const k = api.keys;
      if (k.left) paddle.x -= 560 * dt;
      if (k.right) paddle.x += 560 * dt;
      paddle.x = clamp(paddle.x, 0, W - paddle.w);

      if (ball.stuck) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = paddle.y - 12;
        if (k.fire || k.up) launch();
        return;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -1; }
      if (ball.y < 60 + ball.r) { ball.y = 60 + ball.r; ball.vy *= -1; }

      if (ball.vy > 0 && ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h &&
          ball.x > paddle.x - 4 && ball.x < paddle.x + paddle.w + 4) {
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const speed = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.02);
        const angle = hit * 1.05 - Math.PI / 2;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = paddle.y - ball.r - 1;
      }

      for (let i = bricks.length - 1; i >= 0; i--) {
        const b = bricks[i];
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
          const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
          if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
          b.hp--;
          api.addScore(b.hp > 0 ? 10 : 25 * level);
          if (b.hp <= 0) bricks.splice(i, 1);
          break;
        }
      }

      if (!bricks.length) {
        level++;
        api.setStat('LEVEL', level);
        api.addScore(250);
        build();
        ball.stuck = true;
      }

      if (ball.y > H + 20) {
        lives--;
        api.setStat('LIVES', lives);
        if (lives <= 0) { api.gameOver(); return; }
        ball.stuck = true;
      }
    },
    draw(g: CanvasRenderingContext2D) {
      bg(g, '#160616', '#25060e');
      bricks.forEach((b) => {
        g.globalAlpha = b.hp > 1 ? 1 : 0.72;
        g.fillStyle = b.c;
        roundRect(g, b.x, b.y, b.w, b.h, 4);
        g.fill();
        g.globalAlpha = 1;
      });

      g.fillStyle = '#fff';
      roundRect(g, paddle.x, paddle.y, paddle.w, paddle.h, 7);
      g.fill();

      g.beginPath();
      g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      g.fillStyle = '#FDE68A';
      g.fill();

      if (ball.stuck) label(g, 'PRESS SPACE TO LAUNCH', W / 2, H - 84, 13, 'rgba(255,255,255,.7)', 'center');
    }
  };
};

/* =========================================================
   5. SNAKE PROTOCOL
========================================================= */
interface Vec2 { x: number; y: number }

PSGames['snake-protocol'] = (api: GameApi): GameInstance => {
  const CELL = 24, COLS = 30, ROWS = 18;
  const OX = (W - COLS * CELL) / 2, OY = (H - ROWS * CELL) / 2 + 10;
  let snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
  let dir: Vec2 = { x: 1, y: 0 }, queued: Vec2 | null = null;
  let food = { x: 20, y: 9 };
  let tick = 0, step = 0.13, eaten = 0;

  function placeFood(): void {
    let f: Vec2;
    do { f = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) }; }
    while (snake.some((s) => s.x === f.x && s.y === f.y));
    food = f;
  }
  api.setStat('LENGTH', snake.length);

  return {
    keydown(code: string) {
      const map: Record<string, Vec2> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      const d = map[code];
      if (d && !(d.x === -dir.x && d.y === -dir.y)) queued = d;
    },
    update(dt: number) {
      tick += dt;
      if (tick < step) return;
      tick = 0;
      if (queued) { dir = queued; queued = null; }
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some((s) => s.x === head.x && s.y === head.y)) {
        api.gameOver();
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        eaten++;
        api.addScore(10 + Math.floor(eaten / 3) * 5);
        api.setStat('LENGTH', snake.length);
        step = Math.max(0.055, 0.13 - eaten * 0.003);
        placeFood();
      } else {
        snake.pop();
      }
    },
    draw(g: CanvasRenderingContext2D) {
      bg(g, '#02140f', '#04212a');
      g.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(g, OX - 8, OY - 8, COLS * CELL + 16, ROWS * CELL + 16, 8);
      g.fill();
      g.strokeStyle = 'rgba(34,197,94,.14)';
      g.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(OX + x * CELL, OY); g.lineTo(OX + x * CELL, OY + ROWS * CELL); g.stroke(); }
      for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(OX, OY + y * CELL); g.lineTo(OX + COLS * CELL, OY + y * CELL); g.stroke(); }

      g.fillStyle = '#38BDF8';
      roundRect(g, OX + food.x * CELL + 5, OY + food.y * CELL + 5, CELL - 10, CELL - 10, 4);
      g.fill();

      snake.forEach((s, i) => {
        g.fillStyle = i === 0 ? '#ECFDF5' : `rgba(34,197,94,${clamp(1 - i / (snake.length + 6), 0.35, 1)})`;
        roundRect(g, OX + s.x * CELL + 2, OY + s.y * CELL + 2, CELL - 4, CELL - 4, 5);
        g.fill();
      });
    }
  };
};

/* =========================================================
   6. PADDLE ARENA — versus CPU, first to 7
========================================================= */
PSGames['paddle-arena'] = (api: GameApi): GameInstance => {
  const PW = 14, PH = 92;
  const you = { y: H / 2 - PH / 2 };
  const cpu = { y: H / 2 - PH / 2 };
  let ball = { x: W / 2, y: H / 2, vx: -330, vy: rand(-140, 140), r: 8 };
  let scores = { you: 0, cpu: 0 };
  let serveIn = 1;

  function serve(toYou: boolean): void {
    ball = { x: W / 2, y: H / 2, vx: (toYou ? -1 : 1) * 330, vy: rand(-170, 170), r: 8 };
    serveIn = 0.8;
  }
  api.setStat('MATCH', '0 – 0');

  return {
    pointer(x: number, y: number) { you.y = clamp(y - PH / 2, 0, H - PH); },
    update(dt: number) {
      const k = api.keys;
      if (k.up) you.y -= 520 * dt;
      if (k.down) you.y += 520 * dt;
      you.y = clamp(you.y, 0, H - PH);

      // cpu tracks with a reaction cap
      const target = ball.y - PH / 2 + (ball.vx > 0 ? 0 : rand(-30, 30));
      const cpuSpeed = 300 + scores.you * 26;
      cpu.y += clamp(target - cpu.y, -cpuSpeed * dt, cpuSpeed * dt);
      cpu.y = clamp(cpu.y, 0, H - PH);

      if (serveIn > 0) { serveIn -= dt; return; }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }
      if (ball.y > H - ball.r) { ball.y = H - ball.r; ball.vy *= -1; }

      const hitPaddle = (px: number, py: number): boolean =>
        ball.x + ball.r > px && ball.x - ball.r < px + PW && ball.y > py && ball.y < py + PH;

      if (ball.vx < 0 && hitPaddle(40, you.y)) {
        ball.x = 40 + PW + ball.r;
        ball.vx = Math.abs(ball.vx) * 1.06;
        ball.vy = ((ball.y - (you.y + PH / 2)) / (PH / 2)) * 300;
      }
      if (ball.vx > 0 && hitPaddle(W - 40 - PW, cpu.y)) {
        ball.x = W - 40 - PW - ball.r;
        ball.vx = -Math.abs(ball.vx) * 1.06;
        ball.vy = ((ball.y - (cpu.y + PH / 2)) / (PH / 2)) * 300;
      }
      ball.vx = clamp(ball.vx, -640, 640);

      if (ball.x < -20) { scores.cpu++; api.setStat('MATCH', scores.you + ' – ' + scores.cpu); serve(false); }
      if (ball.x > W + 20) {
        scores.you++;
        api.setScore(scores.you);
        api.setStat('MATCH', scores.you + ' – ' + scores.cpu);
        serve(true);
      }
      if (scores.you >= 7 || scores.cpu >= 7) api.gameOver();
    },
    draw(g: CanvasRenderingContext2D) {
      bg(g, '#050b1c', '#100628');
      g.strokeStyle = 'rgba(255,255,255,.18)';
      g.lineWidth = 3;
      g.setLineDash([12, 14]);
      g.beginPath(); g.moveTo(W / 2, 20); g.lineTo(W / 2, H - 20); g.stroke();
      g.setLineDash([]);

      g.font = '700 84px "JetBrains Mono", monospace';
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.textAlign = 'center';
      g.fillText(String(scores.you), W / 2 - 110, 130);
      g.fillText(String(scores.cpu), W / 2 + 110, 130);
      g.textAlign = 'left';

      g.fillStyle = '#fff';
      roundRect(g, 40, you.y, PW, PH, 7); g.fill();
      g.fillStyle = '#A855F7';
      roundRect(g, W - 40 - PW, cpu.y, PW, PH, 7); g.fill();

      g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      g.fillStyle = '#38BDF8'; g.fill();

      label(g, 'YOU', 40, H - 24, 12);
      label(g, 'CPU', W - 40, H - 24, 12, 'rgba(255,255,255,.55)', 'right');
      if (serveIn > 0) label(g, 'SERVING…', W / 2, H / 2 + 6, 14, 'rgba(255,255,255,.7)', 'center');
    }
  };
};

/* =========================================================
   7. MEMORY GRID — 4x4 pairs
========================================================= */
PSGames['memory-grid'] = (api: GameApi): GameInstance => {
  const SYM = ['◆', '●', '▲', '■', '★', '✦', '⬟', '✚'];
  const COLORS = ['#F472B6', '#A78BFA', '#38BDF8', '#4ADE80', '#FACC15', '#FB923C', '#F43F5E', '#2DD4BF'];
  const CELL = 104, GAP = 14, COLS = 4, ROWS = 4;
  const OX = (W - (COLS * CELL + (COLS - 1) * GAP)) / 2;
  const OY = (H - (ROWS * CELL + (ROWS - 1) * GAP)) / 2 + 12;

  let deck: number[] = [];
  for (let i = 0; i < 8; i++) deck.push(i, i);
  deck.sort(() => Math.random() - 0.5);
  const cards = deck.map((v, i) => ({
    v, i,
    x: OX + (i % COLS) * (CELL + GAP),
    y: OY + Math.floor(i / COLS) * (CELL + GAP),
    open: false, done: false, flip: 0
  }));

  type Card = (typeof cards)[number];

  let first: Card | null = null, lockUntil = 0, moves = 0, elapsed = 0, matched = 0, cursor = 0;
  let pending: Card[] | null = null;

  function tryFlip(card: Card | undefined): void {
    if (!card || card.done || card.open || lockUntil > 0) return;
    card.open = true;
    if (!first) { first = card; return; }
    moves++;
    api.setStat('MOVES', moves);
    if (first.v === card.v) {
      first.done = card.done = true;
      matched++;
      api.addScore(120);
      first = null;
      if (matched === 8) {
        api.addScore(Math.max(0, Math.round(400 - elapsed * 6)));
        api.gameOver();
      }
    } else {
      pending = [first, card];
      first = null;
      lockUntil = 0.65;
    }
  }

  api.setStat('MOVES', 0);
  api.setStat('PAIRS', '0 / 8');

  return {
    pointer(x: number, y: number, kind?: 'move' | 'down') {
      if (kind !== 'down') return;
      const hit = cards.find((c) => x > c.x && x < c.x + CELL && y > c.y && y < c.y + CELL);
      if (hit) { cursor = hit.i; tryFlip(hit); }
    },
    keydown(code: string) {
      if (code === 'ArrowRight') cursor = (cursor + 1) % 16;
      if (code === 'ArrowLeft') cursor = (cursor + 15) % 16;
      if (code === 'ArrowDown') cursor = (cursor + 4) % 16;
      if (code === 'ArrowUp') cursor = (cursor + 12) % 16;
      if (code === 'Space' || code === 'Enter') tryFlip(cards[cursor]);
    },
    update(dt: number) {
      elapsed += dt;
      if (lockUntil > 0) {
        lockUntil = Math.max(0, lockUntil - dt);
        if (lockUntil === 0 && pending) {
          pending.forEach((c) => { c.open = false; });
          pending = null;
        }
      }
      api.setStat('PAIRS', matched + ' / 8');
      api.setStat('TIME', Math.floor(elapsed) + 's');
      cards.forEach((c) => {
        const target = c.open || c.done ? 1 : 0;
        c.flip += clamp(target - c.flip, -dt * 6, dt * 6);
      });
    },
    draw(g: CanvasRenderingContext2D) {
      bg(g, '#12061e', '#061428');
      cards.forEach((c) => {
        const scale = Math.abs(Math.cos(c.flip * Math.PI));
        const faceUp = c.flip > 0.5;
        g.save();
        g.translate(c.x + CELL / 2, c.y + CELL / 2);
        g.scale(Math.max(0.06, scale), 1);
        g.globalAlpha = c.done ? 0.55 : 1;

        if (faceUp) {
          g.fillStyle = COLORS[c.v];
          roundRect(g, -CELL / 2, -CELL / 2, CELL, CELL, 8);
          g.fill();
          g.fillStyle = 'rgba(0,0,0,.7)';
          g.font = '600 42px "Inter", system-ui';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(SYM[c.v], 0, 2);
          g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        } else {
          g.fillStyle = 'rgba(255,255,255,.10)';
          roundRect(g, -CELL / 2, -CELL / 2, CELL, CELL, 8);
          g.fill();
          g.strokeStyle = c.i === cursor ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.22)';
          g.lineWidth = c.i === cursor ? 2 : 1;
          g.setLineDash(c.i === cursor ? [5, 4] : []);
          roundRect(g, -CELL / 2 + 1, -CELL / 2 + 1, CELL - 2, CELL - 2, 8);
          g.stroke();
          g.setLineDash([]);
        }
        g.globalAlpha = 1;
        g.restore();
      });
      label(g, 'MATCH ALL EIGHT PAIRS — FEWER MOVES SCORE HIGHER', W / 2, H - 22, 12, 'rgba(255,255,255,.5)', 'center');
    }
  };
};

/* =========================================================
   8. REFLEX RING — 30 second target round
========================================================= */
interface Target { x: number; y: number; r: number; life: number; age: number }

interface Ripple { x: number; y: number; r: number; life: number; hit: boolean }

PSGames['reflex-ring'] = (api: GameApi): GameInstance => {
  let timeLeft = 30;
  let target: Target | null = null;
  let streak = 0, hits = 0, shots = 0;
  let ripples: Ripple[] = [];

  function spawn(): void {
    const r = clamp(56 - hits * 1.1, 24, 56);
    target = { x: rand(r + 30, W - r - 30), y: rand(r + 70, H - r - 40), r, life: clamp(1.45 - hits * 0.02, 0.6, 1.45), age: 0 };
  }
  spawn();
  api.setStat('TIME', '30s');
  api.setStat('STREAK', '0');
  api.setStat('ACCURACY', '—');

  return {
    pointer(x: number, y: number, kind?: 'move' | 'down') {
      if (!target || kind !== 'down') return;
      shots++;
      const d = Math.hypot(x - target.x, y - target.y);
      if (d <= target.r) {
        hits++;
        streak++;
        const centre = d < target.r * 0.35;
        const base = centre ? 90 : 45;
        api.addScore(Math.round(base * (1 + streak * 0.12)));
        ripples.push({ x: target.x, y: target.y, r: target.r, life: 0.45, hit: true });
        spawn();
      } else {
        streak = 0;
        ripples.push({ x, y, r: 14, life: 0.35, hit: false });
      }
      api.setStat('STREAK', String(streak));
      api.setStat('ACCURACY', Math.round((hits / shots) * 100) + '%');
    },
    update(dt: number) {
      timeLeft -= dt;
      api.setStat('TIME', Math.max(0, timeLeft).toFixed(1) + 's');
      if (timeLeft <= 0) { api.gameOver(); return; }
      if (target) {
        target.age += dt;
        if (target.age > target.life) { streak = 0; api.setStat('STREAK', '0'); spawn(); }
      }
      ripples.forEach((r) => { r.life -= dt; r.r += 120 * dt; });
      ripples = ripples.filter((r) => r.life > 0);
    },
    draw(g: CanvasRenderingContext2D) {
      bg(g, '#1a0c02', '#2b0710');

      g.strokeStyle = 'rgba(255,255,255,.05)';
      g.lineWidth = 1;
      for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

      if (target) {
        const t = 1 - target.age / target.life;
        g.strokeStyle = '#FACC15';
        g.lineWidth = 4;
        g.beginPath(); g.arc(target.x, target.y, target.r, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(249,115,22,.85)';
        g.lineWidth = 6;
        g.beginPath(); g.arc(target.x, target.y, target.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t); g.stroke();
        g.fillStyle = 'rgba(239,68,68,.9)';
        g.beginPath(); g.arc(target.x, target.y, target.r * 0.35, 0, Math.PI * 2); g.fill();
      }

      ripples.forEach((r) => {
        g.strokeStyle = r.hit ? `rgba(250,204,21,${r.life * 2})` : `rgba(255,255,255,${r.life})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
      });

      const barW = W - 96;
      g.fillStyle = 'rgba(255,255,255,.14)';
      roundRect(g, 48, H - 34, barW, 8, 4); g.fill();
      g.fillStyle = '#FACC15';
      roundRect(g, 48, H - 34, barW * clamp(timeLeft / 30, 0, 1), 8, 4); g.fill();

      label(g, 'CLICK OR TAP THE RINGS — CENTRE HITS PAY TRIPLE', W / 2, H - 48, 12, 'rgba(255,255,255,.5)', 'center');
    }
  };
};
