/* ---------------------------------------------------------
   Downloads the PlayStation (pcsx_rearmed) libretro core built
   for Emscripten and unpacks it into public/cores/, so the Play
   page can load the emulator from our own origin instead of a
   third-party CDN at runtime.

   Idempotent: re-running is a no-op once the files are there
   (pass --force to re-download). Wired into `npm run psx:core`
   and `prebuild`, so deployments get the core automatically.
--------------------------------------------------------- */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const CORE = 'pcsx_rearmed';
const REPO = 'arianrhodsandlot/retroarch-emscripten-build';
const VERSION = 'v1.22.2';
const URL = `https://cdn.jsdelivr.net/gh/${REPO}@${VERSION}/retroarch/${CORE}_libretro.zip`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'cores');
const force = process.argv.includes('--force');

/* -------- a very small zip reader (deflate + stored only) -------- */
function unzip(buf: Buffer): Record<string, Buffer> {
  const eocd: number = (() => {
    for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) return i;
    throw new Error('not a zip file (no end-of-central-directory record)');
  })();

  const entries: Record<string, Buffer> = {};
  let ptr = buf.readUInt32LE(eocd + 16);          // central directory offset
  const count = buf.readUInt16LE(eocd + 10);      // entries on this disk

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    const localOffset = buf.readUInt32LE(ptr + 42);

    // the local header repeats the name/extra with its own lengths
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(start, start + compressedSize);

    if (!name.endsWith('/')) {
      if (method === 0) entries[name] = raw;
      else if (method === 8) entries[name] = inflateRawSync(raw);
      else throw new Error(`unsupported compression method ${method} for ${name}`);
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function main(): Promise<void> {
  const targets = [`${CORE}_libretro.js`, `${CORE}_libretro.wasm`];
  if (!force && targets.every((f) => existsSync(join(outDir, f)))) {
    console.log(`[psx-core] ${CORE} already in public/cores — skipping (use --force to refresh)`);
    return;
  }

  console.log(`[psx-core] downloading ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);

  const files = unzip(Buffer.from(await res.arrayBuffer()));
  await mkdir(outDir, { recursive: true });

  for (const target of targets) {
    const key = Object.keys(files).find((name) => name.endsWith(target));
    if (!key) throw new Error(`${target} is missing from the archive`);
    await writeFile(join(outDir, target), files[key]);
    console.log(`[psx-core] wrote public/cores/${target} (${(files[key].length / 1048576).toFixed(1)} MB)`);
  }
}

main().catch((err: Error) => {
  console.error('[psx-core]', err.message);
  process.exit(1);
});
