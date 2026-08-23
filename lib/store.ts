/* ---------------------------------------------------------
   ONEPLAY — local-storage backed store + formatters
   Client-only: every read/write is guarded so it is safe to
   import from a component that also renders on the server.
--------------------------------------------------------- */

import { getGame, type Game } from './games';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  showFps: boolean;
  reduceFlash: boolean;
  difficulty: string;
  name: string;
  /** Written by /settings; absent until the player picks one. */
  region?: string;
}

/** id -> number, the shape every counter in here is stored as. */
export type Counters = Record<string, number>;

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const Store = {
  read<T>(key: string, fallback: T): T {
    if (!hasStorage()) return fallback;
    try {
      const raw = localStorage.getItem('pshub.' + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  write(key: string, value: unknown): void {
    if (!hasStorage()) return;
    try { localStorage.setItem('pshub.' + key, JSON.stringify(value)); } catch { /* private mode */ }
  },

  best(id: string): number { return this.read<Counters>('best', {})[id] || 0; },
  setBest(id: string, score: number): boolean {
    const all = this.read<Counters>('best', {});
    if (score > (all[id] || 0)) { all[id] = score; this.write('best', all); return true; }
    return false;
  },

  plays(id: string): number { return this.read<Counters>('plays', {})[id] || 0; },
  addPlay(id: string, seconds: number): void {
    const plays = this.read<Counters>('plays', {});
    plays[id] = (plays[id] || 0) + 1;
    this.write('plays', plays);
    const time = this.read<Counters>('time', {});
    time[id] = (time[id] || 0) + Math.round(seconds || 0);
    this.write('time', time);
    const recent = this.read<string[]>('recent', []).filter((r) => r !== id);
    recent.unshift(id);
    this.write('recent', recent.slice(0, 6));
  },
  time(id: string): number { return this.read<Counters>('time', {})[id] || 0; },
  recent(): Game[] {
    return this.read<string[]>('recent', []).map(getGame).filter((g): g is Game => Boolean(g));
  },

  library(): string[] { return this.read<string[]>('library', ['astro-drift', 'block-fall', 'neon-runner']); },
  inLibrary(id: string): boolean { return this.library().includes(id); },
  toggleLibrary(id: string): boolean {
    const lib = this.library();
    const i = lib.indexOf(id);
    if (i === -1) lib.push(id); else lib.splice(i, 1);
    this.write('library', lib);
    return lib.includes(id);
  },

  trophies(): string[] { return this.read<string[]>('trophies', []); },
  unlock(gameId: string, name: string): boolean {
    const key = gameId + '::' + name;
    const all = this.trophies();
    if (all.includes(key)) return false;
    all.push(key);
    this.write('trophies', all);
    return true;
  },
  hasTrophy(gameId: string, name: string): boolean { return this.trophies().includes(gameId + '::' + name); },

  settings(): Settings {
    return Object.assign(
      { sound: true, haptics: true, showFps: false, reduceFlash: false, difficulty: 'normal', name: 'Player One' },
      this.read<Partial<Settings>>('settings', {})
    );
  },
  saveSettings(patch: Partial<Settings>): void { this.write('settings', Object.assign(this.settings(), patch)); }
};

export const fmt = {
  score: (n: number): string => (n || 0).toLocaleString('en-US'),
  time(seconds: number): string {
    const s = Math.max(0, Math.round(seconds || 0));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
};
