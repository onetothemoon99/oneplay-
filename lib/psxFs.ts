/* ---------------------------------------------------------
   ONEPLAY — linked folders (File System Access)

   Copying a 600 MB disc into IndexedDB works, but it means waiting
   for the copy, spending the browser's storage quota on a file that
   already exists on disk, and living with the browser evicting it.

   Where the File System Access API is available (Chrome/Edge) the
   player can instead point at the folder their discs already live in.
   We keep the `FileSystemFileHandle`s — which survive a round trip
   through IndexedDB — and read the files straight off disk at boot.
   Nothing is copied, nothing counts against the quota.

   The trade is permission: the browser re-asks on a new session, so
   every read path has to be able to prompt, which means running from
   a user gesture.
--------------------------------------------------------- */

import { DISC_EXTENSIONS, TRACK_EXTENSIONS, extOf, titleFromFileName } from './psx';
import type { DiscFile, DiscHandle, DiscRecord } from './psxDb';

export const supportsFolderLink = (): boolean =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/** Opens the OS folder picker. Must be called from a user gesture. */
export function pickFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker!({ id: 'pshub-psx-discs', mode: 'read' });
}

const lower = (name: string) => String(name).toLowerCase();
const baseName = (path: string) => String(path).split(/[\\/]/).pop()!.trim();

/* A cue sheet points at its tracks: FILE "Game (Track 1).bin" BINARY */
export function parseCue(text: string): string[] {
  const refs: string[] = [];
  const pattern = /^\s*FILE\s+(?:"([^"]*)"|(\S+))/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) refs.push(match[1] ?? match[2]);
  return refs;
}

/* An m3u playlist is one disc per line, comments start with # */
export function parseM3u(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** One folder's worth of candidate files, as walked by scanFolder(). */
export interface FolderScan {
  name: string;
  path: string;
  files: FileSystemFileHandle[];
}

/** A disc found on disk, before it is written to IndexedDB. */
export interface FoundDisc {
  key: string;
  folder: string;
  title: string;
  mainFile: string;
  handles: DiscHandle[];
}

/** Same, with the numbers only a read of the file metadata can supply. */
export interface SizedDisc extends FoundDisc {
  size: number;
  dirHandle: FileSystemDirectoryHandle;
}

/**
 * Split one folder's files into discs.
 *
 * Playlists claim their cue sheets, cue sheets claim their tracks, and
 * whatever is left that can boot on its own becomes a disc of its own —
 * so a folder of loose .chd files and a folder holding one cue + six
 * .bin tracks both come out right.
 */
export async function groupFolder({ name, path, files }: FolderScan): Promise<FoundDisc[]> {
  const byName = new Map(files.map((entry) => [lower(entry.name), entry]));
  const used = new Set<string>();
  const discs: { mainFile: string; members: FileSystemFileHandle[] }[] = [];

  const free = (entry?: FileSystemFileHandle): entry is FileSystemFileHandle =>
    Boolean(entry) && !used.has(lower(entry!.name));
  const claim = (entry: FileSystemFileHandle) => { used.add(lower(entry.name)); return entry; };
  const lookup = (ref: string) => byName.get(lower(baseName(ref)));
  const byExt = (ext: string) => files.filter((entry) => extOf(entry.name) === ext);
  const readText = async (entry: FileSystemFileHandle) => (await entry.getFile()).text();

  const tracksOfCue = async (cue: FileSystemFileHandle) => {
    const members: FileSystemFileHandle[] = [];
    for (const ref of parseCue(await readText(cue))) {
      const track = lookup(ref);
      if (free(track)) members.push(claim(track));
    }
    return members;
  };

  // 1. playlists — a multi-disc game is one entry, not three
  for (const playlist of byExt('.m3u')) {
    if (!free(playlist)) continue;
    const members = [claim(playlist)];
    for (const line of parseM3u(await readText(playlist))) {
      const target = lookup(line);
      if (!free(target)) continue;
      members.push(claim(target));
      if (extOf(target.name) === '.cue') members.push(...await tracksOfCue(target));
    }
    discs.push({ mainFile: playlist.name, members });
  }

  // 2. cue sheets and the tracks they name
  for (const cue of byExt('.cue')) {
    if (!free(cue)) continue;
    const members = [claim(cue), ...await tracksOfCue(cue)];
    discs.push({ mainFile: cue.name, members });
  }

  // 3. anything that boots on its own (.chd, .pbp, .exe, …), and finally raw
  //    .bin dumps nothing claimed — single-track images with no cue sheet
  for (const ext of DISC_EXTENSIONS) {
    if (ext === '.m3u' || ext === '.cue') continue;
    for (const entry of byExt(ext)) {
      if (!free(entry)) continue;
      discs.push({ mainFile: entry.name, members: [claim(entry)] });
    }
  }

  // A folder per game is the common layout, and the folder name is usually
  // tidier than "Track 01.bin" — but only trust it when it holds one disc.
  const folderTitle = discs.length === 1 && name ? titleFromFileName(name) : null;

  return discs.map((disc) => ({
    key: `${path}/${disc.mainFile}`,
    folder: path || name,
    title: folderTitle || titleFromFileName(disc.mainFile),
    mainFile: disc.mainFile,
    handles: disc.members.map((entry) => ({ name: entry.name, handle: entry }))
  }));
}

export interface ScanOptions {
  maxDepth?: number;
  maxFiles?: number;
  onProgress?: (n: number) => void;
}

/** Walk a linked folder and return every disc found in it. */
export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle,
  { maxDepth = 4, maxFiles = 4000, onProgress }: ScanOptions = {}
): Promise<SizedDisc[]> {
  const folders: FolderScan[] = [];
  let seen = 0;

  async function walk(handle: FileSystemDirectoryHandle, path: string, depth: number): Promise<void> {
    const files: FileSystemFileHandle[] = [];
    const dirs: FileSystemDirectoryHandle[] = [];

    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        if (isDiscMember(entry.name)) files.push(entry);
        if (++seen > maxFiles) throw new Error(`that folder holds more than ${maxFiles} files — pick a narrower one`);
      } else if (depth < maxDepth) {
        dirs.push(entry);
      }
    }

    if (files.length) folders.push({ name: handle.name, path, files });
    onProgress?.(seen);
    for (const dir of dirs) await walk(dir, path ? `${path}/${dir.name}` : dir.name, depth + 1);
  }

  await walk(dirHandle, '', 0);

  const discs: FoundDisc[] = [];
  for (const folder of folders) discs.push(...await groupFolder(folder));

  // sizes come from the file metadata, not its contents — cheap even for a
  // shelf full of CD images
  return Promise.all(discs.map(async (disc) => {
    let size = 0;
    for (const { handle } of disc.handles) size += (await handle.getFile()).size;
    return { ...disc, size, dirHandle };
  }));
}

function isDiscMember(name: string): boolean {
  const ext = extOf(name);
  return DISC_EXTENSIONS.includes(ext) || TRACK_EXTENSIONS.includes(ext);
}

/* ---------------- permission ---------------- */

/* Only a linked disc carries handles; a copied one has neither field. Read
   through this rather than off the union, so a copied disc is simply
   "nothing to ask about" instead of a type error at every call site. */
interface PermissionSource {
  dirHandle?: FileSystemDirectoryHandle;
  handles?: DiscHandle[];
}

/** Anything the shelf may be asked about: a stored record or a fresh scan result. */
export type PermissionTarget = DiscRecord | SizedDisc;

export async function readPermission(
  disc: PermissionTarget | null | undefined,
  { request = false }: { request?: boolean } = {}
): Promise<PermissionState> {
  const source = disc as PermissionSource | null | undefined;
  const target = source?.dirHandle || source?.handles?.[0]?.handle;
  // Handles that carry no permission model (OPFS) are always readable.
  if (!target?.queryPermission) return 'granted';

  let state = await target.queryPermission({ mode: 'read' });
  if (state === 'prompt' && request && target.requestPermission) {
    state = await target.requestPermission({ mode: 'read' });
  }
  return state;
}

/**
 * The files of a disc, whichever way it was added. For a linked folder this
 * may prompt for permission, so call it from a user gesture.
 */
export async function resolveDiscFiles(disc: DiscRecord): Promise<DiscFile[]> {
  if (disc.source !== 'fsa') return disc.files || [];

  const state = await readPermission(disc, { request: true });
  if (state !== 'granted') throw new Error('Access to that folder was declined');

  try {
    return await Promise.all(disc.handles.map(async ({ name, handle }) => ({
      name,
      blob: await handle.getFile()
    })));
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') {
      throw new Error('The disc is no longer where it was — it was moved, renamed or deleted. Link the folder again.');
    }
    throw err;
  }
}
