'use client';

/* ---------------------------------------------------------
   ONEPLAY — on-screen pad

   Hand-rolled buttons that synthesise key presses cannot do the
   things a PlayStation game asks for: rolling from ↑ to ↖ without
   letting go, holding a direction while pressing two face buttons,
   or an analog stick at all.

   So this does not synthesise anything. `virtual-gamepad-lib`
   patches `navigator.getGamepads()` and reports a standard-mapping
   pad driven by touch — and the core polls that API once per
   emulated frame (measurably: ~60 times a second). RetroArch sees a
   DualShock, and diagonals, multi-touch and the sticks come for
   free.

   Two ordering rules, both load-bearing:

   1. Mount this only once the emulator is running. Nostalgist's
      postRun builds a `new GamepadEvent(…, { gamepad })` for every
      pad already present, and an emulated pad is a plain object —
      the constructor throws on it, which would fail the boot.
   2. The artwork is fetched, not imported, and the pad lives inside
      the stage wrapper so it survives fullscreen.
--------------------------------------------------------- */

import { useEffect, useRef, useState } from 'react';
import type { GamepadEmulator } from 'virtual-gamepad-lib';

const PAD_HALVES = ['/gamepad/display-gamepad-left.svg', '/gamepad/display-gamepad-right.svg'];
const PAD_INDEX = 0;

export interface PsxTouchPadProps {
  onError?: (error: unknown) => void;
}

export default function PsxTouchPad({ onError }: PsxTouchPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let emulator: GamepadEmulator | null = null;
    const container = containerRef.current;

    // Same test the stylesheet uses to hide the pad. Without it a desktop
    // browser would report an emulated controller nobody can see or press.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    (async () => {
      const [{ setupPresetInteractiveGamepad }, ...responses] = await Promise.all([
        import('virtual-gamepad-lib/helpers'),
        ...PAD_HALVES.map((url) => fetch(url))
      ]);
      const missing = responses.find((response) => !response.ok);
      if (missing) throw new Error(`pad artwork missing (${missing.status}) — run npm run predev`);

      const halves = await Promise.all(responses.map((response) => response.text()));
      if (cancelled || !container) return;

      // Both halves go in one container: the preset looks up every tap target
      // inside the element it is handed, and between them they carry all 16.
      container.innerHTML = halves.map((svg) => `<div class="psx-pad-half">${svg}</div>`).join('');
      ({ gpadEmulator: emulator } = setupPresetInteractiveGamepad(container, {
        EmulatedGamepadIndex: PAD_INDEX,
        // merge with a real controller on the same index rather than becoming
        // a second player, so a phone with a pad attached still works
        EmulatedGamepadOverlayMode: true,
        AllowDpadDiagonals: true,
        ClickableJoysticks: true,
        VariableTriggers: true
      }));
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error('[psx] on-screen pad failed', err);
      setFailed(true);
      onError?.(err);
    });

    return () => {
      cancelled = true;
      try { emulator?.RemoveEmulatedGamepad(PAD_INDEX); } catch { /* already gone */ }
      if (container) container.innerHTML = '';
    };
  }, [onError]);

  if (failed) return null;

  return <div ref={containerRef} className="psx-pad" aria-hidden="true" />;
}
