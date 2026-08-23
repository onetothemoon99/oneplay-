/* ---------------------------------------------------------
   ONEPLAY — PS1 emulation config

   The Play page runs real PlayStation discs through the
   `pcsx_rearmed` libretro core, compiled to WebAssembly and
   driven by Nostalgist.js (a thin wrapper around RetroArch's
   Emscripten build).

   The core itself is served from our own origin — see
   `scripts/fetch-psx-core.mts` / `npm run psx:core`, which
   unpacks it into `public/cores/`.

   No disc images ship with the app. Players bring their own
   dumps and BIOS, which never leave the browser: everything is
   stored locally in IndexedDB (`lib/psxDb.ts`).
--------------------------------------------------------- */

export const PSX_CORE = 'pcsx_rearmed';

/** The console's controller ports. A multitap would extend this; we do not. */
export const PSX_PORTS = [1, 2] as const;
export type PsxPort = (typeof PSX_PORTS)[number];

export const CORE_JS = `/cores/${PSX_CORE}_libretro.js`;
export const CORE_WASM = `/cores/${PSX_CORE}_libretro.wasm`;

/* Disc image formats pcsx_rearmed can mount. `.bin` is listed last
   on purpose — with a `.cue` next to it, the cue sheet is the file
   RetroArch should be handed. */
export const DISC_EXTENSIONS = ['.m3u', '.cue', '.chd', '.pbp', '.exe', '.iso', '.img', '.mdf', '.bin'];

/* Everything else we keep alongside the primary file (raw tracks,
   sub-channel data) so multi-track cue sheets resolve. */
export const TRACK_EXTENSIONS = ['.bin', '.img', '.iso', '.sub', '.ccd', '.cue', '.wav', '.mp3', '.ogg', '.flac', '.pcm'];

export const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

/** The file handed to RetroArch, picked by format priority. */
export function pickPrimaryFile(names: string[]): string {
  for (const ext of DISC_EXTENSIONS) {
    const match = names.find((name) => extOf(name) === ext);
    if (match) return match;
  }
  return names[0];
}

export function isDiscFile(name: string): boolean {
  const ext = extOf(name);
  return DISC_EXTENSIONS.includes(ext) || TRACK_EXTENSIONS.includes(ext);
}

/** "Ape Escape (USA) (Track 1).cue" -> "Ape Escape" */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || name;
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'disc';
}

export const formatBytes = (bytes: number | null | undefined): string => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
};

/* ---------------- controls ----------------
   RetroPad names on the left, what they are on a DualShock in the
   comment — that mapping is fixed by the core, we only choose which
   keyboard key drives each one. These bindings are written into
   retroarch.cfg, which is also what makes `press()` work for the
   on-screen pad (Nostalgist synthesises the bound key). */
export const KEY_BINDINGS = {
  input_player1_up: 'up',
  input_player1_down: 'down',
  input_player1_left: 'left',
  input_player1_right: 'right',
  input_player1_b: 'x',        // ✕ cross
  input_player1_a: 'c',        // ◯ circle
  input_player1_y: 'z',        // ▢ square
  input_player1_x: 's',        // △ triangle
  input_player1_l: 'q',        // L1
  input_player1_r: 'w',        // R1
  input_player1_l2: 'a',       // L2
  input_player1_r2: 'e',       // R2
  input_player1_l3: 'f',       // L3
  input_player1_r3: 'g',       // R3
  input_player1_start: 'enter',
  input_player1_select: 'rshift'
};

/** Rows of [retropad button, glyph, label] for the docs table + touch pad. */
export const BUTTON_GUIDE: [button: string, glyph: string, key: string][] = [
  ['left/right/up/down', 'D-pad', 'Arrow keys'],
  ['b', '✕', 'X'],
  ['a', '◯', 'C'],
  ['y', '▢', 'Z'],
  ['x', '△', 'S'],
  ['l', 'L1', 'Q'],
  ['r', 'R1', 'W'],
  ['l2', 'L2', 'A'],
  ['r2', 'R2', 'E'],
  ['select', 'Select', 'Right Shift'],
  ['start', 'Start', 'Enter']
];

/** A PlayStation controller port -> the browser's gamepad index. */
export type PortAssignment = Partial<Record<PsxPort, number>>;

/** Whatever RetroArch accepts in its `retroarch.cfg`. */
export type RetroarchConfig = Record<string, string | number | boolean>;

export interface RetroarchOptions {
  crt?: boolean;
  /**
   * `ports` maps a PlayStation controller port (1 or 2) to the browser's
   * gamepad index, which is what `input_player%u_joypad_index` wants. Leave it
   * out and RetroArch pairs pads to ports in the order the browser found them.
   */
  ports?: PortAssignment;
}

export function retroarchConfig({ crt = false, ports }: RetroarchOptions = {}): RetroarchConfig {
  const portAssignment: Record<string, number> = {};
  for (const port of PSX_PORTS) {
    const index = ports?.[port];
    if (Number.isInteger(index) && index! >= 0) portAssignment[`input_player${port}_joypad_index`] = index!;
  }

  return {
    ...KEY_BINDINGS,
    ...portAssignment,
    // a PlayStation has two controller ports; more needs a multitap
    input_max_users: PSX_PORTS.length,
    rewind_enable: false,
    savestate_thumbnail_enable: true,
    video_smooth: !crt,
    video_scale_integer: false,

    // Without these two RetroArch assumes square pixels — "1:1 PAR will always
    // be assumed if video_aspect_ratio is not set", per its own docs. Almost no
    // PlayStation game has square pixels: 512x240 and 384x240 framebuffers are
    // everywhere and are meant to be shown at 4:3, so 1:1 stretches them wide
    // and squashes everything on screen. Letting the core declare the ratio,
    // and forcing the rendering area to match it, is what makes a game look
    // the way it did on a TV.
    video_aspect_ratio_auto: true,
    video_force_aspect: true,
    audio_latency: 96,
    // RetroArch's own menu would fight our UI for the keyboard
    menu_driver: 'null',
    input_menu_toggle: 'nul'
  };
}

export interface CoreOptions {
  hasBios?: boolean;
  region?: string;
  frameskip?: boolean;
}

/**
 * Core options. Without a BIOS dump pcsx_rearmed falls back to its
 * high-level emulation of one — most games boot, some (notably the
 * ones that lean on the real shell) will not.
 */
export function coreConfig({ hasBios = false, region = 'auto', frameskip = false }: CoreOptions = {}): Record<string, string> {
  return {
    pcsx_rearmed_bios: hasBios ? 'auto' : 'HLE',
    pcsx_rearmed_region: region,
    pcsx_rearmed_show_bios_bootlogo: hasBios ? 'enabled' : 'disabled',
    pcsx_rearmed_frameskip: frameskip ? '1' : '0',
    pcsx_rearmed_analog_combo: 'l1+r1+select',
    pcsx_rearmed_drc: 'disabled',   // no dynarec under wasm
    pcsx_rearmed_dithering: 'enabled',
    pcsx_rearmed_spu_reverb: 'enabled',
    pcsx_rearmed_spu_interpolation: 'simple'
  };
}
