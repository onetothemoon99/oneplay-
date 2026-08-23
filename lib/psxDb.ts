/* ---------------------------------------------------------
   ONEPLAY — local PlayStation disc storage

   Disc images are far too big for localStorage, so everything the
   PS1 player needs lives in IndexedDB, on the player's own machine:

     discs   — the files that make up a disc (cue + tracks, chd, pbp…)
     bios    — optional BIOS dumps, copied into RetroArch's system dir
     states  — save states, per disc, per slot
     sram    — memory card data, written back after every session

   Client-only. Every call is guarded so importing this from a
   component that also renders on the server is safe.
--------------------------------------------------------- */

const DB_NAME = 'pshub-psx';
const DB_VERSION = 1;

export const STATE_SLOTS = [1, 2, 3];

/* ---------------- record shapes ---------------- */

/** Where a copied disc came from, when it was not the local disk. */
export interface DiscOrigin {
  kind: 'drive';
  files: { id: string; name: string }[];
}

/** One file of a disc, already in memory. */
export interface DiscFile {
  name: string;
  blob: File;
}

/** One file of a linked disc, still on disk. */
export interface DiscHandle {
  name: string;
  handle: FileSystemFileHandle;
}

interface DiscCounters {
  addedAt: number;
  lastPlayedAt: number;
  plays: number;
  seconds: number;
}

interface DiscCommon extends DiscCounters {
  id: string;
  title: string;
  mainFile: string;
  size: number;
}

/** A disc copied into IndexedDB. */
export interface CopiedDisc extends DiscCommon {
  source: 'idb';
  origin: DiscOrigin | null;
  files: DiscFile[];
}

/** A disc left where it is, on disk, behind File System Access handles. */
export interface LinkedDisc extends DiscCommon {
  source: 'fsa';
  handles: DiscHandle[];
  dirHandle: FileSystemDirectoryHandle;
  folder: string;
  key: string;
}

export type DiscRecord = CopiedDisc | LinkedDisc;

export interface BiosRecord {
  name: string;
  blob: File;
  size: number;
  addedAt: number;
}

export interface StateRecord {
  id: string;
  discId: string;
  slot: number;
  blob: Blob;
  thumbnail: Blob | null;
  size: number;
  savedAt: number;
}

export interface SramRecord {
  discId: string;
  blob: Blob;
  size: number;
  savedAt: number;
}

/* ---------------- plumbing ---------------- */

const supported = () => typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!supported()) return Promise.reject(new Error('IndexedDB is not available in this browser'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('discs')) db.createObjectStore('discs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('bios')) db.createObjectStore('bios', { keyPath: 'name' });
      if (!db.objectStoreNames.contains('states')) {
        db.createObjectStore('states', { keyPath: 'id' }).createIndex('discId', 'discId');
      }
      if (!db.objectStoreNames.contains('sram')) db.createObjectStore('sram', { keyPath: 'discId' });
    };
    request.onsuccess = () => {
      request.result.onclose = () => { dbPromise = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('another tab is upgrading the database'));
  });

  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let result: T | undefined;
    const request = work(tx.objectStore(storeName));
    if (request) request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  }));
}

/* ---------------- discs ---------------- */

const freshRecord = (): DiscCounters => ({ addedAt: Date.now(), lastPlayedAt: 0, plays: 0, seconds: 0 });

export interface PutDiscInput {
  id: string;
  title: string;
  mainFile: string;
  files: File[];
  origin?: DiscOrigin | null;
}

/**
 * A disc copied into the browser. Works everywhere, spends storage quota.
 *
 * `origin` records where the copy came from when it was not the local disk —
 * `{ kind: 'drive', files: [{ id, name }] }` for a Google Drive import, so the
 * shelf can say so and the file can be fetched again later.
 */
export async function putDisc({ id, title, mainFile, files, origin }: PutDiscInput): Promise<CopiedDisc> {
  const record: CopiedDisc = {
    ...freshRecord(),
    id,
    title,
    mainFile,
    source: 'idb',
    origin: origin || null,
    files: files.map((file) => ({ name: file.name, blob: file })),
    size: files.reduce((total, file) => total + file.size, 0)
  };
  await run('discs', 'readwrite', (store) => store.put(record));
  return record;
}

export interface PutLinkedDiscInput {
  id: string;
  title: string;
  mainFile: string;
  size: number;
  key: string;
  folder: string;
  handles: DiscHandle[];
  dirHandle: FileSystemDirectoryHandle;
}

/**
 * A disc left where it is, on disk. Only the handles are stored — they survive
 * structured cloning, so IndexedDB can hold them — and the files are read at
 * boot. See lib/psxFs.ts.
 */
export async function putLinkedDisc(
  { id, title, mainFile, size, key, folder, handles, dirHandle }: PutLinkedDiscInput
): Promise<LinkedDisc> {
  const record: LinkedDisc = {
    ...freshRecord(),
    id,
    title,
    mainFile,
    source: 'fsa',
    handles,
    dirHandle,
    folder,
    key,
    size
  };
  await run('discs', 'readwrite', (store) => store.put(record));
  return record;
}

/** How many files back this disc, whichever way it was added. */
export const discFileCount = (disc?: DiscRecord | null): number => {
  if (!disc) return 0;
  return (disc.source === 'fsa' ? disc.handles : disc.files)?.length || 0;
};

/** Records written before linked folders existed are all copies. */
export const discSource = (disc?: DiscRecord | null): 'fsa' | 'idb' => (disc?.source === 'fsa' ? 'fsa' : 'idb');

export function getDisc(id: string): Promise<DiscRecord | undefined> {
  return run<DiscRecord>('discs', 'readonly', (store) => store.get(id));
}

export async function listDiscs(): Promise<DiscRecord[]> {
  const all = (await run<DiscRecord[]>('discs', 'readonly', (store) => store.getAll())) || [];
  return all.sort((a, b) => (b.lastPlayedAt || b.addedAt) - (a.lastPlayedAt || a.addedAt));
}

export async function deleteDisc(id: string): Promise<void> {
  await run('discs', 'readwrite', (store) => store.delete(id));
  await run('sram', 'readwrite', (store) => store.delete(id));
  const states = await listStates(id);
  await Promise.all(states.map((state) => deleteState(state.id)));
}

export async function renameDisc(id: string, title: string): Promise<DiscRecord | null> {
  const disc = await getDisc(id);
  if (!disc) return null;
  disc.title = title;
  await run('discs', 'readwrite', (store) => store.put(disc));
  return disc;
}

/** Bumps the play counter / clock the same way `Store.addPlay` does for the canvas games. */
export async function recordSession(id: string, seconds: number): Promise<DiscRecord | null> {
  const disc = await getDisc(id);
  if (!disc) return null;
  disc.plays = (disc.plays || 0) + 1;
  disc.seconds = (disc.seconds || 0) + Math.round(seconds || 0);
  disc.lastPlayedAt = Date.now();
  await run('discs', 'readwrite', (store) => store.put(disc));
  return disc;
}

/* ---------------- bios ---------------- */

export async function putBios(file: File): Promise<BiosRecord> {
  const record: BiosRecord = { name: file.name, blob: file, size: file.size, addedAt: Date.now() };
  await run('bios', 'readwrite', (store) => store.put(record));
  return record;
}

export async function listBios(): Promise<BiosRecord[]> {
  return (await run<BiosRecord[]>('bios', 'readonly', (store) => store.getAll())) || [];
}

export function deleteBios(name: string): Promise<unknown> {
  return run('bios', 'readwrite', (store) => store.delete(name));
}

/* ---------------- save states ---------------- */

const stateKey = (discId: string, slot: number) => `${discId}::${slot}`;

export interface PutStateInput {
  discId: string;
  slot: number;
  state: Blob;
  thumbnail?: Blob | null;
}

export async function putState({ discId, slot, state, thumbnail }: PutStateInput): Promise<StateRecord> {
  const record: StateRecord = {
    id: stateKey(discId, slot),
    discId,
    slot,
    blob: state,
    thumbnail: thumbnail || null,
    size: state.size,
    savedAt: Date.now()
  };
  await run('states', 'readwrite', (store) => store.put(record));
  return record;
}

export function getState(discId: string, slot: number): Promise<StateRecord | undefined> {
  return run<StateRecord>('states', 'readonly', (store) => store.get(stateKey(discId, slot)));
}

export async function listStates(discId: string): Promise<StateRecord[]> {
  const all = (await run<StateRecord[]>('states', 'readonly', (store) => store.getAll())) || [];
  return all.filter((state) => state.discId === discId).sort((a, b) => a.slot - b.slot);
}

export function deleteState(id: string): Promise<unknown> {
  return run('states', 'readwrite', (store) => store.delete(id));
}

/* ---------------- memory card ---------------- */

export function putSram(discId: string, blob: Blob): Promise<unknown> {
  return run('sram', 'readwrite', (store) => store.put({ discId, blob, size: blob.size, savedAt: Date.now() }));
}

export function getSram(discId: string): Promise<SramRecord | undefined> {
  return run<SramRecord>('sram', 'readonly', (store) => store.get(discId));
}

/* ---------------- housekeeping ---------------- */

/** Asks the browser not to evict our discs when disk space runs low. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted?.()) return true;
  try { return await navigator.storage.persist(); } catch { return false; }
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
