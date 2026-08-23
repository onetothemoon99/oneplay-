/* ---------------------------------------------------------
   ONEPLAY — game runner
   Owns the loop, input (keyboard / pointer / touch / gamepad),
   HUD, pause + game-over flow, high scores and trophies.

   Imperatively drives the DOM nodes rendered by the Play page
   (matched by id) — call Runner.init(game) after that markup is
   mounted, and Runner.destroy() before it unmounts / the game
   changes, so listeners and the animation frame are cleaned up.
--------------------------------------------------------- */

import type { Game, TrophyTier } from './games';
import { Store, fmt } from './store';
import { PSGames, type GameApi, type GameInstance, type GameKeys } from './gameModules';

export const Runner = (() => {
  const LOGICAL_W = 960;
  const LOGICAL_H = 540;

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let game: Game | null = null;
  let instance: GameInstance | null = null;
  let raf = 0, last = 0;
  let state: 'idle' | 'playing' | 'paused' | 'over' = 'idle';
  let score = 0;
  let stats: Record<string, string | number> = {};
  let sessionStart = 0, playedSeconds = 0;
  let fps = 0, fpsAcc = 0, fpsFrames = 0;
  let padPrev: Record<number, boolean> = {};
  let cleanups: (() => void)[] = [];

  const keys: GameKeys = { left: false, right: false, up: false, down: false, fire: false };
  type KeyName = keyof GameKeys;

  const el = (id: string) => document.getElementById(id);

  /* ---------------- input ---------------- */
  const KEYMAP: Record<string, KeyName> = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', KeyZ: 'fire', KeyJ: 'fire'
  };
  const BLOCK = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

  function onKeyDown(e: KeyboardEvent) {
    if (BLOCK.includes(e.code)) e.preventDefault();
    if (e.repeat) {
      if (state === 'playing' && instance?.keydown && e.code !== 'Space') instance.keydown(e.code);
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'playing') pause();
      else if (state === 'paused') resume();
      return;
    }
    if (e.code === 'Enter') {
      if (state === 'idle') start();
      else if (state === 'over') start();
      else if (state === 'paused') resume();
      return;
    }
    if (e.code === 'KeyR' && (state === 'playing' || state === 'paused' || state === 'over')) { start(); return; }

    const k = KEYMAP[e.code];
    if (k) keys[k] = true;
    if (state === 'idle' && (k === 'fire' || k === 'up')) { start(); return; }
    if (state === 'over' && k === 'fire') { start(); return; }
    if (state === 'playing' && instance?.keydown) instance.keydown(e.code);
  }

  function onKeyUp(e: KeyboardEvent) {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  }

  function localPoint(evt: MouseEvent | TouchEvent) {
    const rect = canvas!.getBoundingClientRect();
    const touch = evt as TouchEvent;
    const src: { clientX: number; clientY: number } =
      touch.touches?.[0] || touch.changedTouches?.[0] || (evt as MouseEvent);
    return {
      x: ((src.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((src.clientY - rect.top) / rect.height) * LOGICAL_H
    };
  }

  function onPointer(evt: MouseEvent | TouchEvent) {
    if (state !== 'playing' || !instance?.pointer || !canvas) return;
    const p = localPoint(evt);
    instance.pointer(p.x, p.y, 'move');
  }

  function onCanvasTap(evt: MouseEvent | TouchEvent) {
    if (state === 'idle' || state === 'over') { start(); return; }
    if (state === 'playing' && instance?.pointer && canvas) {
      evt.preventDefault();
      const p = localPoint(evt);
      instance.pointer(p.x, p.y, 'down');
    }
  }

  function onTouchMove(e: TouchEvent) { e.preventDefault(); onPointer(e); }

  function addWin<K extends keyof WindowEventMap>(
    type: K,
    fn: (event: WindowEventMap[K]) => void,
    opts?: AddEventListenerOptions
  ) {
    window.addEventListener(type, fn, opts);
    cleanups.push(() => window.removeEventListener(type, fn, opts));
  }

  function addEl(
    node: Element | null,
    type: string,
    fn: EventListener,
    opts?: AddEventListenerOptions
  ) {
    if (!node) return;
    node.addEventListener(type, fn, opts);
    cleanups.push(() => node.removeEventListener(type, fn, opts));
  }

  function bindTouchControls() {
    document.querySelectorAll<HTMLElement>('[data-pad]').forEach((btn) => {
      const key = btn.dataset.pad as KeyName | 'start';
      const set = (v: boolean) => (evt: Event) => {
        evt.preventDefault();
        if (key === 'start') { if (v) (state === 'playing' ? pause() : state === 'paused' ? resume() : start()); return; }
        keys[key] = v;
        if (v && state === 'playing' && instance?.keydown) {
          const code = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', fire: 'Space' }[key];
          if (code) instance.keydown(code);
        }
        if (v && (state === 'idle' || state === 'over')) start();
      };
      const down = set(true), up = set(false);
      addEl(btn, 'touchstart', down, { passive: false });
      addEl(btn, 'touchend', up, { passive: false });
      addEl(btn, 'touchcancel', up, { passive: false });
      addEl(btn, 'mousedown', down);
      const winUp = () => { if (key !== 'start') keys[key] = false; };
      addWin('mouseup', winUp);
    });
  }

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((entry): entry is Gamepad => Boolean(entry));
    const indicator = el('pad-status');
    if (!pad) {
      if (indicator) indicator.hidden = true;
      return;
    }
    if (indicator) { indicator.hidden = false; }

    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const btn = (i: number) => !!pad.buttons[i]?.pressed;

    keys.left = btn(14) || ax < -0.4;
    keys.right = btn(15) || ax > 0.4;
    keys.up = btn(12) || ay < -0.4;
    keys.down = btn(13) || ay > 0.4;
    keys.fire = btn(0);

    const edge = (i: number, fn: () => void) => {
      const now = btn(i);
      if (now && !padPrev[i]) fn();
      padPrev[i] = now;
    };
    edge(0, () => {
      if (state === 'idle' || state === 'over') start();
      else if (state === 'playing' && instance?.keydown) instance.keydown('Space');
    });
    edge(12, () => { if (state === 'playing' && instance?.keydown) instance.keydown('ArrowUp'); });
    edge(13, () => { if (state === 'playing' && instance?.keydown) instance.keydown('ArrowDown'); });
    edge(14, () => { if (state === 'playing' && instance?.keydown) instance.keydown('ArrowLeft'); });
    edge(15, () => { if (state === 'playing' && instance?.keydown) instance.keydown('ArrowRight'); });
    edge(9, () => (state === 'playing' ? pause() : state === 'paused' ? resume() : start()));
  }

  /* ---------------- canvas ---------------- */
  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  /* ---------------- HUD ---------------- */
  function renderStats() {
    const host = el('hud-stats');
    if (!host) return;
    const entries = Object.entries(stats);
    host.innerHTML = entries.map(([k, v]) => `
      <div class="flex flex-col">
        <span class="mono" style="color:rgba(255,255,255,.42);font-size:10px">${k}</span>
        <span style="font-weight:480;font-size:15px;color:#fff">${v}</span>
      </div>`).join('');
  }

  function setScore(n: number) {
    score = Math.max(0, Math.round(n));
    const s = el('hud-score');
    if (s) s.textContent = fmt.score(score);
  }

  const api: GameApi = {
    w: LOGICAL_W,
    h: LOGICAL_H,
    keys,
    addScore: (n: number) => setScore(score + n),
    setScore,
    setStat: (k, v) => { stats[k] = v; renderStats(); },
    gameOver: () => finish()
  };

  /* ---------------- lifecycle ---------------- */
  function show(id: string, on: boolean) {
    const node = el(id);
    if (node) node.classList.toggle('hidden', !on);
  }

  function start() {
    if (!game || !canvas || !ctx) return;
    cancelAnimationFrame(raf);
    stats = {};
    setScore(0);
    renderStats();
    instance = PSGames[game.id](api);
    (Object.keys(keys) as KeyName[]).forEach((k) => (keys[k] = false));
    state = 'playing';
    sessionStart = performance.now();
    show('overlay-start', false);
    show('overlay-pause', false);
    show('overlay-over', false);
    const hb = el('hud-best');
    if (hb) hb.textContent = fmt.score(Store.best(game.id));
    last = performance.now();
    raf = requestAnimationFrame(loop);
    canvas.focus();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    playedSeconds += (performance.now() - sessionStart) / 1000;
    const ps = el('pause-score');
    if (ps) ps.textContent = fmt.score(score);
    show('overlay-pause', true);
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    sessionStart = performance.now();
    show('overlay-pause', false);
    last = performance.now();
  }

  function trophyColor(tier: TrophyTier) {
    return tier === 'Gold' ? '#FACC15' : tier === 'Silver' ? '#D4D4D8' : '#D9A066';
  }

  function finish() {
    if (state === 'over' || !game) return;
    state = 'over';
    playedSeconds += (performance.now() - sessionStart) / 1000;

    const isRecord = Store.setBest(game.id, score);
    Store.addPlay(game.id, playedSeconds);
    playedSeconds = 0;

    const os = el('over-score'); if (os) os.textContent = fmt.score(score);
    const ob = el('over-best'); if (ob) ob.textContent = fmt.score(Store.best(game.id));
    const hb = el('hud-best'); if (hb) hb.textContent = fmt.score(Store.best(game.id));
    const or = el('over-record'); if (or) or.hidden = !isRecord;

    const earned = game.trophies.filter((t) => score >= t.target && Store.unlock(game!.id, t.name));
    const box = el('over-trophies');
    if (box) {
      box.innerHTML = earned.length
        ? `<p class="mono mb-3" style="color:rgba(255,255,255,.45)">Trophies unlocked</p>` +
          earned.map((t) => `
            <div class="flex items-center gap-3 py-2">
              <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:${trophyColor(t.tier)}">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="#000"><path d="M4 2h8v1h2v3a3 3 0 0 1-3 3 3 3 0 0 1-2 1v2h2v2H5v-2h2v-2a3 3 0 0 1-2-1 3 3 0 0 1-3-3V3h2V2Zm0 2H3v2a2 2 0 0 0 1 1.7V4Zm9 0h-1v3.7A2 2 0 0 0 13 6V4Z"/></svg>
              </span>
              <div>
                <p style="font-weight:480;color:#fff;font-size:14px">${t.name}</p>
                <p class="mono" style="color:rgba(255,255,255,.45);font-size:10px">${t.tier} · ${t.desc}</p>
              </div>
            </div>`).join('')
        : `<p class="mono" style="color:rgba(255,255,255,.35)">No new trophies this run</p>`;
    }

    show('overlay-over', true);
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (!ctx || !instance) return;
    pollGamepad();

    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);

    if (state === 'playing') {
      instance.update(dt);
      if (state !== 'playing') return; // gameOver called mid-update
    }

    instance.draw(ctx);

    if (state === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    fpsFrames++; fpsAcc += dt;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
    const f = el('hud-fps');
    if (f && !f.hidden) f.textContent = fps + ' FPS';
  }

  function idleFrame() {
    if (!ctx) return;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  /* ---------------- boot ---------------- */
  function init(g: Game) {
    game = g;
    canvas = el('stage') as HTMLCanvasElement | null;
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    resize();
    idleFrame();

    const onBlur = () => { (Object.keys(keys) as KeyName[]).forEach((k) => (keys[k] = false)); pause(); };
    addWin('keydown', onKeyDown);
    addWin('keyup', onKeyUp);
    addWin('blur', onBlur);
    addEl(canvas, 'mousemove', onPointer as EventListener);
    addEl(canvas, 'mousedown', onCanvasTap as EventListener);
    addEl(canvas, 'touchstart', onCanvasTap as EventListener, { passive: false });
    addEl(canvas, 'touchmove', onTouchMove as EventListener, { passive: false });
    bindTouchControls();

    addEl(el('btn-start'), 'click', start);
    addEl(el('btn-resume'), 'click', resume);
    addEl(el('btn-restart'), 'click', start);
    addEl(el('btn-retry'), 'click', start);
    addEl(el('btn-pause'), 'click', () => (state === 'playing' ? pause() : resume()));

    if (Store.settings().showFps) { const f = el('hud-fps'); if (f) f.hidden = false; }
    const hb = el('hud-best');
    if (hb) hb.textContent = fmt.score(Store.best(game.id));

    // draw the idle frame once so the stage is never a blank rectangle
    instance = PSGames[game.id](api);
    instance.draw(ctx);
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    stats = {};
    renderStats();
    setScore(0);
  }

  function destroy() {
    cancelAnimationFrame(raf);
    raf = 0;
    state = 'idle';
    cleanups.forEach((fn) => fn());
    cleanups = [];
    instance = null;
    canvas = null;
    ctx = null;
    padPrev = {};
  }

  return { init, destroy, start, pause, resume, get state() { return state; } };
})();
