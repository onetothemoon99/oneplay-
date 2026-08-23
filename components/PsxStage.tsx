'use client';

/* ---------------------------------------------------------
   ONEPLAY — PS1 stage

   Wraps the pcsx_rearmed libretro core (via Nostalgist.js) in the
   same console chrome the canvas games use: start / pause / error
   overlays, a HUD, and the on-screen pad for touch devices.

   The emulator is only booted from a real click — that is what
   unlocks audio, and it keeps React's double-invoked effects in
   development from starting two copies of the core.
--------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Nostalgist } from 'nostalgist';
import { CORE_JS, CORE_WASM, PSX_CORE, coreConfig, formatBytes, retroarchConfig } from '@/lib/psx';
import { resolveDiscFiles } from '@/lib/psxFs';
import { resolvePorts } from '@/lib/psxPorts';
import PsxTouchPad from '@/components/PsxTouchPad';
import * as db from '@/lib/psxDb';
import type { BiosRecord, DiscRecord, StateRecord } from '@/lib/psxDb';
import * as cloud from '@/lib/psxCloudSync';
import { useLocale, useT, type Translate } from '@/components/I18nProvider';
import { Store } from '@/lib/store';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;
const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));

/**
 * Digit keys 1/2/3 -> save state slot. `event.code` on purpose: `event.key`
 * turns into '!'/'@'/'#' under Shift (Load), so it can't tell slot 1 from
 * slot 3 once Shift is held.
 */
const SLOT_CODES: Record<string, number> = { Digit1: 1, Digit2: 2, Digit3: 3 };

/** Where the console is in its life cycle. */
type StageStatus = 'idle' | 'booting' | 'running' | 'paused' | 'error';

/**
 * The frame rate the core is actually managing, which is the number worth
 * seeing, because there is no dynarec under WebAssembly and the whole emulator
 * runs on one thread — so a slower device simply runs the console slower.
 *
 * Counted from the emulator's own WebGL context: RetroArch clears exactly once
 * per rendered frame (measured against its draw calls, its rAF ticks and its
 * gamepad polls — all four agree, 60.3/s at full speed and 14.0/s at a sixth
 * of the CPU). The context is wrapped on the instance, not the prototype, so
 * nothing else on the page is touched. Two signals that look equally good are
 * not: the Gamepad API is also polled by the on-screen pad library, and
 * Emscripten's main-loop counter ticks several times per frame.
 */
function useEmulatedFps(active: boolean, getCanvas: () => HTMLCanvasElement | null): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    const canvas = getCanvas();
    const gl = (canvas?.getContext?.('webgl2') || canvas?.getContext?.('webgl')) as
      WebGLRenderingContext | WebGL2RenderingContext | null;
    if (typeof gl?.clear !== 'function') return undefined;

    const original = gl.clear;
    let frames = 0;
    const counting = function countingClear(this: WebGLRenderingContext, ...args: [number]) {
      frames++;
      return original.apply(this, args);
    };
    gl.clear = counting;

    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - last) / 1000;
      if (elapsed > 0) setFps(frames / elapsed);
      frames = 0;
      last = now;
    }, 1000);

    return () => {
      window.clearInterval(timer);
      // reveal the prototype again
      if (gl.clear === counting) delete (gl as Partial<WebGLRenderingContext>).clear;
      setFps(0);
    };
  }, [active, getCanvas]);

  return fps;
}

function errorHint(error: unknown, t: Translate): string {
  const message = String((error as Error)?.message || error);
  if (/core|wasm|404/i.test(message)) return t('stage.errorCore');
  if (/memory|allocat/i.test(message)) return t('stage.errorMemory');
  if (/declined/i.test(message)) return t('stage.errorDeclined', { message });
  return message;
}

/**
 * Reads the memory card off the running core, writes it to IndexedDB, and —
 * for a signed-in player — backs it up to Supabase Storage. Shared by the
 * periodic auto-flush and the teardown effect, which both used to do this
 * by hand.
 */
async function flushSram(
  emulator: Nostalgist, discId: string, title: string, userId?: string | null
): Promise<Blob | null> {
  const sram = await emulator.saveSRAM();
  if (!sram?.size) return null;
  await db.putSram(discId, sram);
  if (userId) cloud.pushSram(userId, title, sram).catch(() => {});
  return sram;
}

export interface PsxStageProps {
  disc: DiscRecord;
  bios?: BiosRecord[];
  /** Signed-in player's id, for the cloud memory-card backup. null/undefined = local only. */
  userId?: string | null;
  /** Called on teardown with however many seconds were played. */
  onSession?: (seconds: number) => void;
}

export default function PsxStage({ disc, bios = [], userId, onSession }: PsxStageProps) {
  const t = useT();
  const locale = useLocale();
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [locale]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emulatorRef = useRef<Nostalgist | null>(null);
  const clockRef = useRef({ startedAt: 0, seconds: 0 });

  const [status, setStatus] = useState<StageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [states, setStates] = useState<StateRecord[]>([]);
  const [widescreen, setWidescreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pad, setPad] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showFps, setShowFps] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // iPhone Safari has no element fullscreen at all, so we fake it with CSS
  const [faux, setFaux] = useState(false);

  const running = status === 'running' || status === 'paused';

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2600);
  }, []);

  const refreshStates = useCallback(() => {
    db.listStates(disc.id).then(setStates).catch(() => {});
  }, [disc.id]);

  useEffect(() => { refreshStates(); }, [refreshStates]);

  useEffect(() => {
    setZoom(clampZoom(Number(Store.read('psxZoom', 1)) || 1));
    // the same preference the canvas games and /settings already use
    setShowFps(Boolean(Store.settings().showFps));
  }, []);

  const getCanvas = useCallback(() => canvasRef.current, []);

  const toggleFps = useCallback(() => {
    setShowFps((current) => {
      const next = !current;
      Store.saveSettings({ showFps: next });
      return next;
    });
  }, []);

  const changeZoom = useCallback((next: number) => {
    const value = clampZoom(next);
    setZoom(value);
    Store.write('psxZoom', value);
  }, []);

  /* ---------------- session clock ---------------- */
  const markPlaying = useCallback(() => { clockRef.current.startedAt = performance.now(); }, []);
  const markStopped = useCallback(() => {
    const { startedAt } = clockRef.current;
    if (startedAt) clockRef.current.seconds += (performance.now() - startedAt) / 1000;
    clockRef.current.startedAt = 0;
  }, []);

  /* ---------------- memory card ---------------- */
  const persistSram = useCallback(async () => {
    const emulator = emulatorRef.current;
    if (!emulator) return;
    try { await flushSram(emulator, disc.id, disc.title, userId); } catch { /* the core may not have written a card yet */ }
  }, [disc.id, disc.title, userId]);

  /* ---------------- boot ---------------- */
  const boot = useCallback(async () => {
    if (emulatorRef.current || status === 'booting') return;
    setStatus('booting');
    setError(null);

    try {
      const probe = await fetch(CORE_WASM, { method: 'HEAD' });
      if (!probe.ok) throw new Error(`core not found (${probe.status})`);

      const { Nostalgist } = await import('nostalgist');

      // A linked folder is read here rather than at page load: this runs inside
      // the click, which is the only place the browser will accept a permission
      // prompt. Copied discs just hand back their blobs.
      const files = await resolveDiscFiles(disc);

      // RetroArch mounts whichever file comes first, so the cue sheet /
      // playlist has to lead and the raw tracks follow it.
      const ordered = [...files].sort((a, b) => (
        a.name === disc.mainFile ? -1 : b.name === disc.mainFile ? 1 : 0
      ));
      let card = await db.getSram(disc.id).catch(() => null);
      if (!card && userId) {
        const restored = await cloud.pullSram(userId, disc.title).catch(() => null);
        if (restored) {
          await db.putSram(disc.id, restored).catch(() => {});
          card = await db.getSram(disc.id).catch(() => null);
        }
      }

      const emulator = await Nostalgist.launch({
        core: PSX_CORE,
        rom: ordered.map((file) => ({ fileName: file.name, fileContent: file.blob })),
        bios: bios.map((file) => ({ fileName: file.name, fileContent: file.blob })),
        sram: card?.blob,
        element: canvasRef.current ?? undefined,
        size: 'auto',
        respondToGlobalEvents: false,
        // read at boot, because RetroArch only looks at the port assignment
        // when the core starts
        retroarchConfig: retroarchConfig({ ports: resolvePorts() }),
        retroarchCoreConfig: coreConfig({ hasBios: bios.length > 0 }),
        resolveCoreJs: () => CORE_JS,
        resolveCoreWasm: () => CORE_WASM
      });

      emulatorRef.current = emulator;
      markPlaying();
      setStatus('running');
      canvasRef.current?.focus();
    } catch (err) {
      console.error('[psx] launch failed', err);
      setError(errorHint(err, t));
      setStatus('error');
    }
  }, [bios, disc, markPlaying, status, t, userId]);

  const pause = useCallback(() => {
    const emulator = emulatorRef.current;
    if (!emulator || status !== 'running') return;
    emulator.pause();
    markStopped();
    setStatus('paused');
    persistSram();
  }, [markStopped, persistSram, status]);

  const resume = useCallback(() => {
    const emulator = emulatorRef.current;
    if (!emulator || status !== 'paused') return;
    emulator.resume();
    markPlaying();
    setStatus('running');
    canvasRef.current?.focus();
  }, [markPlaying, status]);

  const restart = useCallback(() => {
    emulatorRef.current?.restart();
    if (status === 'paused') { markPlaying(); setStatus('running'); }
    canvasRef.current?.focus();
  }, [markPlaying, status]);

  /* ---------------- save states ---------------- */
  const saveState = useCallback(async (slot: number) => {
    const emulator = emulatorRef.current;
    if (!emulator) return;
    try {
      const { state, thumbnail } = await emulator.saveState();
      await db.putState({ discId: disc.id, slot, state, thumbnail });
      if (userId) cloud.pushState(userId, disc.title, slot, state).catch(() => {});
      refreshStates();
      flash(t('stage.savedSlot', { slot }));
    } catch (err) {
      console.error('[psx] save state failed', err);
      flash(t('stage.saveFailed', { slot }));
    }
  }, [disc.id, disc.title, flash, refreshStates, t, userId]);

  const loadState = useCallback(async (slot: number) => {
    const emulator = emulatorRef.current;
    if (!emulator) return;

    let record = await db.getState(disc.id, slot);
    let restoredFromCloud = false;
    if (!record && userId) {
      const restored = await cloud.pullState(userId, disc.title, slot).catch(() => null);
      if (restored) {
        record = await db.putState({ discId: disc.id, slot, state: restored, thumbnail: null });
        restoredFromCloud = true;
      }
    }
    if (!record) { flash(t('stage.slotEmpty', { slot })); return; }

    try {
      await emulator.loadState(record.blob);
      if (restoredFromCloud) refreshStates();
      flash(t('stage.loadedSlot', { slot }));
      canvasRef.current?.focus();
    } catch (err) {
      console.error('[psx] load state failed', err);
      flash(t('stage.loadFailed', { slot }));
    }
  }, [disc.id, disc.title, flash, refreshStates, t, userId]);

  const screenshot = useCallback(async () => {
    const emulator = emulatorRef.current;
    if (!emulator) return;
    const blob = await emulator.screenshot();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${disc.title}.png`;
    link.click();
    // give the download a moment to start before the blob goes away
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [disc.title]);

  const toggleMute = useCallback(() => {
    emulatorRef.current?.sendCommand('MUTE');
    setMuted((value) => !value);
  }, []);

  /* ---------------- fullscreen ----------------
     Three things go wrong on a phone if this is left to the one-liner it
     started as: the wrapper keeps its inline max-width and never fills the
     screen, iPhone Safari has no element fullscreen to call, and a 4:3 stage
     in portrait cannot fill a tall screen no matter what — so ask for
     landscape too. */
  const exitFullscreen = useCallback(async () => {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      try { await exit?.call(document); } catch { /* already leaving */ }
    }
    try { window.screen?.orientation?.unlock?.(); } catch { /* not lockable */ }
    setFaux(false);
    setFullscreen(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const request = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (request) {
      try {
        await request.call(wrap, { navigationUI: 'hide' });
      } catch {
        setFaux(true); // permission or an iframe policy said no
      }
    } else {
      setFaux(true);
    }
    setFullscreen(true);

    // Best effort, and only meaningful on a handheld: Android allows it once
    // the document is fullscreen, everything else rejects and is ignored.
    try { await window.screen?.orientation?.lock?.('landscape'); } catch { /* unsupported */ }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) exitFullscreen(); else enterFullscreen();
  }, [enterFullscreen, exitFullscreen, fullscreen]);

  /* the system can leave fullscreen without us — Esc, the back gesture */
  useEffect(() => {
    function sync() {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!active) {
        setFullscreen((current) => (current && !faux ? false : current));
      }
    }
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [faux]);

  /* the page behind a faked fullscreen must not scroll */
  useEffect(() => {
    if (!faux) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [faux]);

  /* ---------------- controller ----------------
     The core polls navigator.getGamepads() itself once per frame, so a pad
     needs no wiring from us — this is purely so the player can see that it
     was picked up. Browsers only reveal pads after a gesture on the page,
     hence the re-check on every connect/disconnect event. */
  useEffect(() => {
    function sync() {
      // skip our own on-screen pad, which reports itself through the same API
      const gamepad = Array.from(navigator.getGamepads?.() ?? [])
        .find((entry) => entry && !/^Emulated Gamepad/i.test(entry.id));
      setPad(gamepad ? gamepad.id.replace(/\s*\([^)]*\)\s*$/, '').trim() || 'Controller' : '');
    }
    sync();
    window.addEventListener('gamepadconnected', sync);
    window.addEventListener('gamepaddisconnected', sync);
    return () => {
      window.removeEventListener('gamepadconnected', sync);
      window.removeEventListener('gamepaddisconnected', sync);
    };
  }, []);

  /* ---------------- shortcuts we own ----------------
     Escape pauses/resumes; 1/2/3 save to that slot, Shift+1/2/3 loads it —
     same slots as the Save/Load buttons below, so the shortcut only fires
     while those buttons would be enabled. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!running) return;

      if (event.code === 'Escape') {
        event.preventDefault();
        if (status === 'running') pause(); else resume();
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const slot = SLOT_CODES[event.code];
      if (!slot) return;
      event.preventDefault();
      if (event.shiftKey) loadState(slot); else saveState(slot);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loadState, pause, resume, running, saveState, status]);

  /* a hidden tab should not keep burning CPU on emulation */
  useEffect(() => {
    function onVisibility() { if (document.hidden && status === 'running') pause(); }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause, status]);

  /* the core renders at whatever size the canvas is on screen, and it
     only measures once — so re-measure on resize, fullscreen and aspect
     changes, otherwise fullscreen is just an upscale of the small buffer */
  useEffect(() => {
    if (!running) return undefined;
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const canvas = canvasRef.current;
        const width = Math.round(canvas?.clientWidth || 0);
        const height = Math.round(canvas?.clientHeight || 0);
        if (width && height) emulatorRef.current?.resize({ width, height });
      }, 150);
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [running, widescreen, fullscreen, faux, zoom]);

  /* periodic memory-card flush */
  useEffect(() => {
    if (status !== 'running') return undefined;
    const timer = window.setInterval(persistSram, 60000);
    return () => window.clearInterval(timer);
  }, [persistSram, status]);

  /* ---------------- teardown ---------------- */
  useEffect(() => () => {
    const emulator = emulatorRef.current;
    if (!emulator) return;
    emulatorRef.current = null;
    markStopped();
    const played = clockRef.current.seconds;
    // best effort: flush the card, stop the core, then bank the session
    flushSram(emulator, disc.id, disc.title, userId)
      .catch(() => null)
      .finally(() => {
        try { emulator.exit({ removeCanvas: false }); } catch { /* already gone */ }
        if (played > 5) db.recordSession(disc.id, played).catch(() => {});
        onSession?.(played);
      });
  }, [disc.id, disc.title, markStopped, onSession, userId]);

  const fps = useEmulatedFps(showFps && status === 'running', getCanvas);

  /* Screens are all different widths, so the size of the picture is the
     player's call — and it has to be adjustable from inside fullscreen too,
     which is where the HUD is not reachable. */
  const zoomControls = (
    <span className="flex items-center gap-1.5">
      <button className="btn btn-glass btn-sm" onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label={t('stage.smaller')}>−</button>
      <button
        className="btn btn-glass btn-sm mono"
        onClick={() => changeZoom(1)}
        title={t('stage.resetZoom')}
        style={{ minWidth: 62 }}
      >{Math.round(zoom * 100)}%</button>
      <button className="btn btn-glass btn-sm" onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label={t('stage.bigger')}>+</button>
    </span>
  );

  const fpsToggle = (
    <button className="btn btn-glass btn-sm" onClick={toggleFps} aria-pressed={showFps}>
      {showFps ? t('stage.hideFps') : t('stage.showFps')}
    </button>
  );

  return (
    <section className="bg-black">
      <div className="container py-6 sm:py-8">

        {/* session bar */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5">
          <div className="min-w-0">
            <p className="mono" style={{ color: 'rgba(255,255,255,.45)' }}>{t('stage.console')} · {formatBytes(disc.size)}</p>
            <p className="truncate text-white" style={{ fontWeight: 480, fontSize: 18, letterSpacing: '-0.02em' }}>{disc.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice ? <span className="pill pill-inverse">{notice}</span> : null}
            {pad ? <span className="pill pill-inverse hidden sm:inline-flex" title={pad}>{t('stage.controllerConnected')}</span> : null}
            <span className="pill pill-inverse" title={bios.length ? bios.map((file) => file.name).join(', ') : t('stage.noBiosTitle')}>
              {bios.length ? 'BIOS' : t('stage.hleBios')}
            </span>
            {running ? (
              <>
                <button className="btn btn-glass btn-sm" onClick={toggleMute}>{muted ? t('stage.unmute') : t('stage.mute')}</button>
                <button className="btn btn-glass btn-sm" onClick={status === 'running' ? pause : resume}>
                  {status === 'running' ? t('stage.pause') : t('stage.resume')}
                </button>
              </>
            ) : null}
            <button className="btn btn-white btn-sm" onClick={toggleFullscreen}>
              {fullscreen ? t('stage.exitFullscreen') : t('stage.fullscreen')}
            </button>
          </div>
        </div>

        {/* stage */}
        <div
          className={`relative mx-auto psx-wrap${widescreen ? ' is-wide' : ''}${faux ? ' psx-faux-fullscreen' : ''}`}
          style={{ maxWidth: widescreen ? 1100 : 860, '--psx-zoom': zoom } as CSSProperties}
          id="stage-wrap"
          ref={wrapRef}
        >
          {/* the session bar is outside the wrapper, so fullscreen needs its
              own way back — on a phone there is no Esc key */}
          {fullscreen ? (
            <div className="psx-fs-bar">
              {zoomControls}
              {fpsToggle}
              <button className="btn btn-glass btn-sm" onClick={exitFullscreen}>{t('stage.exitFullscreen')}</button>
            </div>
          ) : null}
          {/* no id: RetroArch renames it to "canvas" the moment it takes over */}
          <canvas
            className={widescreen ? 'psx-stage psx-wide' : 'psx-stage'}
            ref={canvasRef}
            tabIndex={0}
            aria-label={t('stage.canvasLabel', { title: disc.title })}
          />

          {status === 'idle' ? (
            <div className="overlay">
              <div>
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('stage.discInserted')}</p>
                <h2 className="h2 text-white mt-3">{disc.title}</h2>
                <p className="lead mt-3 mx-auto max-w-[44ch]" style={{ color: 'rgba(255,255,255,.7)' }}>
                  {bios.length ? t('stage.bootWithBios') : t('stage.bootWithHle')}
                </p>
                <button className="btn btn-white btn-lg mt-7" onClick={boot}>
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><path d="M11 6.13a1 1 0 0 1 0 1.74l-9.5 5.5A1 1 0 0 1 0 12.5v-11A1 1 0 0 1 1.5.63L11 6.13Z" /></svg>
                  {t('stage.powerOn')}
                </button>
                <p className="mono mt-5" style={{ color: 'rgba(255,255,255,.42)' }}>{t('stage.powerHint')}</p>
              </div>
            </div>
          ) : null}

          {status === 'booting' ? (
            <div className="overlay">
              <div>
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('stage.loading')}</p>
                <h2 className="h2 text-white mt-3">{t('stage.spinningUp')}</h2>
                <p className="lead mt-3" style={{ color: 'rgba(255,255,255,.7)' }}>{t('stage.readingFile', { file: disc.mainFile })}</p>
              </div>
            </div>
          ) : null}

          {status === 'paused' ? (
            <div className="overlay">
              <div>
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('stage.paused')}</p>
                <h2 className="h2 text-white mt-3">{t('stage.sessionOnHold')}</h2>
                <div className="mt-7 flex flex-wrap gap-3 justify-center">
                  <button className="btn btn-white" onClick={resume}>{t('stage.resume')}</button>
                  <button className="btn btn-glass" onClick={restart}>{t('stage.resetConsole')}</button>
                  <button className="btn btn-glass" onClick={screenshot}>{t('stage.screenshot')}</button>
                </div>
              </div>
            </div>
          ) : null}

          {showFps && running ? (
            <span className="pill pill-inverse mono psx-fps">{t('stage.fps', { fps: fps.toFixed(1) })}</span>
          ) : null}

          {/* inside the wrapper on purpose: #stage-wrap is what goes
              fullscreen, and a pad outside it would vanish there */}
          {running ? <PsxTouchPad /> : null}

          {status === 'error' ? (
            <div className="overlay">
              <div className="max-w-[48ch]">
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('stage.bootFailed')}</p>
                <h2 className="h2 text-white mt-3">{t('stage.discWouldNotLoad')}</h2>
                <p className="lead mt-3" style={{ color: 'rgba(255,255,255,.7)' }}>{error}</p>
                <button className="btn btn-white mt-7" onClick={() => { setStatus('idle'); setError(null); }}>{t('stage.tryAgain')}</button>
              </div>
            </div>
          ) : null}
        </div>

        {/* hud */}
        <div className="mx-auto mt-5 flex flex-wrap items-center gap-2 px-1" style={{ maxWidth: 1100 }}>
          <span className="mono mr-1" style={{ color: 'rgba(255,255,255,.42)', fontSize: 10 }}>{t('stage.saveStates')}</span>
          {db.STATE_SLOTS.map((slot) => {
            const record = states.find((state) => state.slot === slot);
            return (
              <span key={slot} className="flex flex-col items-start gap-1 mr-3">
                <span className="flex items-center gap-1.5">
                  <button className="btn btn-glass btn-sm" disabled={!running} title={`${slot}`} onClick={() => saveState(slot)}>{t('stage.save', { slot })}</button>
                  <button
                    className="btn btn-glass btn-sm"
                    disabled={!running || (!record && !userId)}
                    title={`Shift+${slot}`}
                    onClick={() => loadState(slot)}
                  >{t('stage.load', { slot })}</button>
                </span>
                {/* reserved even when empty, so every slot's buttons line up on the same row */}
                <span
                  className="mono"
                  style={{ fontSize: 10, letterSpacing: '.03em', color: 'rgba(255,255,255,.38)', visibility: record ? 'visible' : 'hidden' }}
                >
                  {record ? dateFmt.format(record.savedAt) : ' '}
                </span>
              </span>
            );
          })}
          <span className="grow" />
          {zoomControls}
          {fpsToggle}
          <button className="btn btn-glass btn-sm" onClick={() => setWidescreen((value) => !value)}>{widescreen ? '16:9' : '4:3'}</button>
          <button className="btn btn-glass btn-sm" disabled={!running} onClick={() => emulatorRef.current?.sendCommand('DISK_NEXT')}>{t('stage.nextDisc')}</button>
        </div>

      </div>
    </section>
  );
}
