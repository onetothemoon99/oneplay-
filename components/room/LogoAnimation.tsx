'use client';

/* ---------------------------------------------------------
   ONEPLAY — the wordmark animation

   A CRT switches on, boots, waits for START and resolves into the
   lockup, then collapses to a line. Ported from the standalone
   "OnePlay Logo Animation" bundle so it renders as part of the page
   instead of inside a frame: no player chrome, no second copy of
   React, no in-browser Babel, and the fonts are the ones the site is
   already loading.

   Everything is authored against a fixed 1920x1080 stage and scaled to
   whatever width it is given, so the composition never reflows — only
   the CRT gets bigger or smaller. VIEW_W/VIEW_H crop the empty room
   away so the set fills the space it is given.

   The clock only runs while the element is on screen and the tab is
   visible. It deliberately does not check prefers-reduced-motion: this is
   the page's own title sequence rather than incidental motion, and the
   brief asked for it to play for everyone.
--------------------------------------------------------- */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const STAGE_W = 1920;
const STAGE_H = 1080;
const VIEW_W = 1500;      // the window onto the stage — the set, not the room
const VIEW_H = 1060;

const DURATION = 15.6;    // power 2.5 + boot 3.3 + start 3.2 + logo 3.8 + sign 2.8

const INK = '#14161e';
const PANEL = '#1B1D26';
const PAPER = '#F5F3EE';
const ACC = '#F2794A';
const BLUE = '#7E92F5';
const MONO = "'IBM Plex Mono', monospace";
const DISP = "'Chakra Petch', sans-serif";

/* ---------- timeline helpers ---------- */

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/** t in 0..1, out in 0..1. */
type Ease = (t: number) => number;

const Easing: Record<string, Ease> = {
  easeOutQuad: (t) => t * (2 - t),
  easeOutCubic: (t) => (t - 1) * (t - 1) * (t - 1) + 1,
  easeOutQuart: (t) => 1 - (t - 1) * (t - 1) * (t - 1) * (t - 1),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (t - 1) * (t - 1) * (t - 1) * (t - 1)),
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};

/** A single tween, read at time t. Flat before `start`, flat after `end`. */
function tween(from: number, to: number, start: number, end: number, ease: Ease): (t: number) => number {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

/** tween's scalar sibling: map t through one segment and return the value. */
function ramp(t: number, [inA, inB]: [number, number], [outA, outB]: [number, number], ease: Ease): number {
  if (t <= inA) return outA;
  if (t >= inB) return outB;
  return outA + (outB - outA) * ease((t - inA) / (inB - inA));
}

const enter = (from: number, to: number, start: number, end: number) => tween(from, to, start, end, Easing.easeOutCubic);
const draw = (from: number, to: number, start: number, end: number) => tween(from, to, start, end, Easing.easeInOutQuart);
const pop = (from: number, to: number, start: number, end: number) => tween(from, to, start, end, Easing.easeOutBack);

/* ---------- the mark ---------- */

interface DPadProps {
  size: number;
  /** Per-arm scale, in the order top / left / centre / right / bottom. */
  appear: number[];
  /** How far the play triangle has grown, 0..1. */
  playP: number;
}

function DPad({ size, appear, playP }: DPadProps) {
  const gap = size * 0.055;
  const pad = size * 0.15;
  const r = size * 0.035;
  const cell = (i: number, color: string, radius: string | number): CSSProperties => ({
    background: color,
    borderRadius: radius,
    transform: `scale(${appear[i]})`,
    opacity: clamp(appear[i], 0, 1)
  });

  return (
    <div style={{
      width: size, height: size, background: INK, borderRadius: size * 0.16,
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
      gap, padding: pad, boxSizing: 'border-box',
      boxShadow: `0 0 ${size * 0.5}px ${ACC}22`
    }}>
      <div />
      <div style={cell(0, ACC, `${r}px ${r}px 0 0`)} />
      <div />
      <div style={cell(1, ACC, `${r}px 0 0 ${r}px`)} />
      <div style={{ ...cell(2, BLUE, 0), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: `${size * 0.075 * playP}px solid ${INK}`,
          borderTop: `${size * 0.05 * playP}px solid transparent`,
          borderBottom: `${size * 0.05 * playP}px solid transparent`,
          marginLeft: size * 0.02 * playP
        }} />
      </div>
      <div style={cell(3, ACC, `0 ${r}px ${r}px 0`)} />
      <div />
      <div style={cell(4, ACC, `0 0 ${r}px ${r}px`)} />
      <div />
    </div>
  );
}

interface BootLineProps {
  text: string;
  /** How much of the line has been revealed, 0..1. */
  p: number;
  color: string;
}

/** One boot line, revealed by width rather than by character. */
function BootLine({ text, p, color }: BootLineProps) {
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: `${clamp(p, 0, 1) * 100}%` }}>
      <div style={{ fontFamily: MONO, fontSize: 34, letterSpacing: '0.06em', color, whiteSpace: 'nowrap' }}>
        {text}
      </div>
    </div>
  );
}

/* ---------- the composition, sampled at T ---------- */

function Piece({ T }: { T: number }) {
  // power / CRT geometry
  const led = T > 0.55 && T < 15.4 ? (T < 1.4 ? (Math.floor((T - 0.55) * 5) % 2 ? 0.25 : 1) : 1) : 0.08;
  const scaleX = Math.min(enter(0.02, 1, 1.40, 1.72)(T), draw(1, 0.02, 15.05, 15.38)(T));
  const scaleY = Math.min(enter(0.006, 1, 1.62, 2.02)(T), draw(1, 0.008, 14.65, 15.05)(T));
  const screenLive = T > 1.38 ? 1 : 0;
  const bright = ramp(T, [1.4, 2.2], [2.6, 1], Easing.easeOutQuart);

  // camera
  const camZoom = enter(1, 1.05, 0, 15.6)(T) * enter(1, 1.07, 9.0, 12.8)(T);
  const camY = enter(0, -18, 9.0, 12.8)(T);

  // boot
  const b1 = draw(0, 1, 2.70, 3.20)(T);
  const b2 = draw(0, 1, 3.40, 3.90)(T);
  const b3 = draw(0, 1, 4.10, 4.70)(T);
  const bootOut = enter(1, 0, 5.80, 6.15)(T);
  const bootY = enter(0, -34, 5.60, 6.15)(T);
  const caret = T > 2.6 && T < 5.8 ? (Math.floor(T * 2.6) % 2 ? 0 : 1) : 0;

  // press start
  const startIn = enter(0, 1, 6.35, 6.75)(T);
  const blink = T > 6.4 && T < 8.0 ? (Math.floor(T * 1.8) % 2 ? 0.12 : 1) : 1;
  const startOut = enter(1, 0, 8.02, 8.20)(T);
  const press = T > 7.95 && T < 8.18 ? 0.92 : 1;
  const flash = T < 8.0
    ? 0
    : (T < 8.16
      ? ramp(T, [8.0, 8.16], [0, 1], Easing.easeOutQuad)
      : ramp(T, [8.16, 8.70], [1, 0], Easing.easeOutQuart));

  // logo
  const blocks = [9.10, 9.24, 9.02, 9.38, 9.52].map((s) => clamp(pop(0, 1, s, s + 0.55)(T), 0, 1.15));
  const playP = clamp(pop(0, 1, 9.85, 10.35)(T), 0, 1.1);
  const wordP = clamp(draw(0, 1, 9.70, 10.45)(T), 0, 1);
  const wordY = enter(26, 0, 9.70, 10.45)(T);
  const tagP = clamp(enter(0, 1, 10.60, 11.20)(T), 0, 1);
  const tagY = enter(16, 0, 10.60, 11.20)(T);
  const conP = clamp(enter(0, 1, 11.40, 12.00)(T), 0, 1);
  const logoIn = clamp(enter(0, 1, 8.85, 9.05)(T), 0, 1);
  const logoOut = enter(1, 0, 14.30, 14.62)(T);
  const breathe = 1 + Math.sin(clamp(T - 11.5, 0, 99) * 1.5) * 0.006;

  const scanY = (T * 42) % 100;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: DISP }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `translateY(${camY}px) scale(${camZoom})`
      }}>
        {/* CRT body */}
        <div style={{
          width: 1240, height: 830, background: PANEL, borderRadius: 44,
          padding: 46, boxSizing: 'border-box', position: 'relative',
          boxShadow: '0 60px 120px -30px #000, inset 0 2px 0 #ffffff10'
        }}>
          {/* screen well */}
          <div style={{
            position: 'absolute', left: 46, top: 46, right: 46, bottom: 118,
            background: '#05060a', borderRadius: 30, overflow: 'hidden',
            boxShadow: 'inset 0 0 90px #000, inset 0 0 0 3px #ffffff08',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {/* live picture */}
            <div style={{
              position: 'absolute', inset: 0,
              transform: `scale(${scaleX}, ${scaleY})`,
              opacity: screenLive,
              filter: `brightness(${bright})`,
              background: '#101320'
            }}>
              {/* boot text */}
              <div style={{
                position: 'absolute', left: 88, top: 132, right: 88,
                opacity: clamp(bootOut, 0, 1), transform: `translateY(${bootY}px)`,
                display: 'flex', flexDirection: 'column', gap: 26
              }}>
                <BootLine text="ONEPLAY  SYSTEM  v1.0" p={b1} color={PAPER} />
                <BootLine text="CHECKING CARTRIDGE SLOT ......... OK" p={b2} color={BLUE} />
                <BootLine text="PS1 GAME LIBRARY ................ OK" p={b3} color={ACC} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 34, color: PAPER, opacity: b3 > 0.99 ? 1 : 0 }}>&gt;</div>
                  <div style={{ width: 20, height: 34, background: PAPER, opacity: b3 > 0.99 ? caret : 0 }} />
                </div>
              </div>

              {/* press start */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 44,
                opacity: clamp(startIn * startOut, 0, 1), transform: `scale(${press})`
              }}>
                <div style={{ fontFamily: MONO, fontSize: 62, letterSpacing: '0.22em', color: PAPER, opacity: blink }}>
                  PRESS START
                </div>
                <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '0.3em', color: `${PAPER}66` }}>
                  INSERT CARTRIDGE
                </div>
              </div>

              {/* logo lockup */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 52, opacity: logoIn * clamp(logoOut, 0, 1),
                transform: `scale(${breathe})`
              }}>
                <DPad size={230} appear={blocks} playP={playP} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ overflow: 'hidden', height: 132 }}>
                    <div style={{
                      fontSize: 128, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1,
                      color: PAPER, whiteSpace: 'nowrap',
                      clipPath: `inset(0 ${(1 - wordP) * 100}% 0 0)`,
                      transform: `translateY(${wordY}px)`
                    }}>One<span style={{ color: ACC }}>Play</span></div>
                  </div>
                  <div style={{ fontSize: 34, color: '#b9bcc9', opacity: tagP, transform: `translateY(${tagY}px)` }}>
                    เล่นเกมได้ทุกที่โดยไม่ต้องโหลด
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 22, letterSpacing: '0.28em', color: BLUE,
                    opacity: conP, marginTop: 10
                  }}>PS1</div>
                </div>
              </div>

              {/* scanlines + roll */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'repeating-linear-gradient(to bottom, #ffffff0d 0px, #ffffff0d 1px, transparent 1px, transparent 4px)'
              }} />
              <div style={{
                position: 'absolute', left: 0, right: 0, top: `${scanY}%`, height: 120,
                background: 'linear-gradient(to bottom, transparent, #ffffff08, transparent)'
              }} />
              {/* white flash on the button press */}
              <div style={{ position: 'absolute', inset: 0, background: PAPER, opacity: clamp(flash, 0, 1) }} />
            </div>

            {/* glass vignette */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(82% 80% at 50% 44%, transparent 62%, #00000099 100%)'
            }} />
          </div>

          {/* bezel chin */}
          <div style={{
            position: 'absolute', left: 46, right: 46, bottom: 34, height: 62,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.3em', color: '#5c6070' }}>ONEPLAY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7, background: ACC, opacity: led,
                boxShadow: `0 0 18px ${ACC}`
              }} />
              <div style={{ width: 74, height: 10, borderRadius: 5, background: '#2a2d38' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- the clock and the fit ---------- */

export interface LogoAnimationProps {
  className?: string;
}

export default function LogoAnimation({ className = '' }: LogoAnimationProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const [scale, setScale] = useState(0);
  const [T, setT] = useState(0);

  // fit: the stage is authored at one size and scaled, never reflowed
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(box.clientWidth / VIEW_W);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let frame = 0;
    let origin = 0;      // performance.now() of T = 0
    let onScreen = false;

    const tick = (now: number) => {
      const next = ((now - origin) / 1000) % DURATION;
      timeRef.current = next;
      setT(next);
      frame = requestAnimationFrame(tick);
    };

    // Resuming from where it stopped keeps the join invisible.
    const start = () => {
      if (frame) return;
      origin = performance.now() - timeRef.current * 1000;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const sync = () => {
      if (onScreen && !document.hidden) start(); else stop();
    };

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    }, { threshold: 0 });
    observer.observe(box);
    document.addEventListener('visibilitychange', sync);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className={`logo-anim ${className}`}
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      aria-hidden="true"
    >
      {scale > 0 ? (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: STAGE_W, height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          willChange: 'transform'
        }}>
          <Piece T={T} />
        </div>
      ) : null}
    </div>
  );
}
