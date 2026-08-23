/* ---------------------------------------------------------
   Copies the on-screen gamepad artwork out of virtual-gamepad-lib
   and into public/, where the Play page fetches it at runtime.

   The SVG is not imported through the bundler on purpose: the
   library's own docs reach for a `?raw` import, which is a
   build-tool-specific trick, and the pad is only ever needed on a
   touch device — fetching it keeps it out of the main bundle.

   Idempotent, and wired into `npm run predev` / `prebuild`
   alongside the PS1 core.
--------------------------------------------------------- */

import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = 'virtual-gamepad-lib';

// Two halves rather than the one-piece pad: pinned to the bottom corners they
// leave the middle of the screen — the game — visible.
const ASSETS = ['rounded/display-gamepad-left.svg', 'rounded/display-gamepad-right.svg'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'gamepad');

function findPackage(): string {
  let dir = root;
  for (;;) {
    const candidate = join(dir, 'node_modules', PACKAGE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir || dir === parse(dir).root) break;
    dir = parent;
  }
  throw new Error(`${PACKAGE} is not installed — run npm install`);
}

async function main(): Promise<void> {
  // Found by walking up node_modules rather than require.resolve(): the
  // package's `exports` map hides package.json, and its CommonJS entry points
  // at a file it does not actually ship — neither of which matters to the
  // bundler, but both break resolution from a plain Node script.
  const pkg = findPackage();
  await mkdir(outDir, { recursive: true });

  for (const asset of ASSETS) {
    const target = join(outDir, asset.split('/').pop()!);
    await copyFile(join(pkg, 'gamepad_assets', asset), target);
    console.log(`[gamepad] public/gamepad/${asset.split('/').pop()}`);
  }
}

main().catch((err: Error) => {
  console.error('[gamepad]', err.message);
  process.exit(1);
});
