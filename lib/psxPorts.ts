/* ---------------------------------------------------------
   ONEPLAY — which controller is which player

   A PlayStation has two ports, and the browser hands us pads in
   whatever order it noticed them — which is not necessarily the order
   the people on the sofa expect. This keeps the player's own
   assignment, keyed by the controller's id string so the same pad
   lands on the same port next time it is plugged in.

   RetroArch reads the result as `input_player%u_joypad_index`, which
   it only looks at when the core starts, so a change applies on the
   next power on.
--------------------------------------------------------- */

import { PSX_PORTS, type PortAssignment, type PsxPort } from './psx';
import { Store } from './store';

const KEY = 'psxPorts';

/** Everything this module needs off a pad — a real Gamepad, or our own report of one. */
export interface PadLike {
  id: string;
  index: number;
}

/** pad id -> port (1, 2, or 0 for unused) */
export type PortAssignments = Record<string, number>;

/** Our own on-screen pad, which reports itself through the same API. */
export const isVirtualPad = (pad?: PadLike | null): boolean => /^Emulated Gamepad/i.test(pad?.id || '');

/** "Xbox Wireless Controller (Vendor: 045e Product: 0b13)" -> "Xbox Wireless Controller" */
export function padName(pad?: PadLike | null): string {
  if (!pad) return 'Controller';
  if (isVirtualPad(pad)) return 'On-screen pad';
  return pad.id.replace(/\s*\([^)]*\)\s*$/, '').trim() || pad.id || 'Controller';
}

/** Every pad the browser is currently reporting. */
export function connectedPads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  return Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => Boolean(pad));
}

export function readAssignments(): PortAssignments {
  const saved = Store.read<PortAssignments>(KEY, {});
  return saved && typeof saved === 'object' ? saved : {};
}

/**
 * Give a pad a port, taking it off whichever pad held that port before —
 * two controllers on one port would just fight each other.
 */
export function assignPort(padId: string, port: number): PortAssignments {
  const next: PortAssignments = { ...readAssignments() };

  if (port) {
    for (const [id, held] of Object.entries(next)) {
      if (id !== padId && Number(held) === Number(port)) next[id] = 0;
    }
  }
  next[padId] = Number(port) || 0;

  Store.write(KEY, next);
  return next;
}

const isPsxPort = (port: number): port is PsxPort => (PSX_PORTS as readonly number[]).includes(port);

/**
 * The `ports` option for `retroarchConfig()`: port -> browser gamepad index,
 * for the pads that are actually plugged in right now. Ports nobody claimed
 * are left out, so RetroArch falls back to its own ordering for them.
 */
export function resolvePorts(pads: PadLike[] = connectedPads()): PortAssignment {
  const saved = readAssignments();
  const ports: PortAssignment = {};

  for (const pad of pads) {
    const port = Number(saved[pad.id]);
    if (isPsxPort(port) && ports[port] == null) ports[port] = pad.index;
  }
  return ports;
}
