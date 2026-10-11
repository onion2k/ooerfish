/**
 * Takes models out of the scenery the kit converter wrote, without the kit's GLBs.
 *
 *   npm run kit:prune -- <kind> [<kind> ...]
 *
 * It reads `public/scenery/scenery.json` and `scenery.bin`, drops every model of the kinds named (`prune` in
 * `kitting.ts` says how, and which masks go with them), and writes the two files and the masks that are left again.
 * The folder is generated, so this is how it is changed: never by hand. It is for models the game has stopped using,
 * and `scripts/kit-sources.json` loses them too, so that the next full `npm run kit` agrees with what is written.
 * The files are rewritten whole from the same input every time, so a second run from the same files is the same
 * bytes; a run on files already pruned refuses, since it would have nothing to do.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { KitError, prune, type ManifestFile } from './kitting';

const OUT = 'public/scenery';
const gz = (b: Uint8Array): number => gzipSync(b).length;

/** Every file of the folder gzipped on its own, as `sceneryBytes` counts it, and the sum. */
const weigh = (): { files: Record<string, number>; total: number } => {
  const files: Record<string, number> = {};
  let total = 0;
  for (const f of readdirSync(OUT).sort()) {
    files[f] = gz(readFileSync(join(OUT, f)));
    total += files[f];
  }
  return { files, total };
};

const main = (): void => {
  const kinds = process.argv.slice(2);
  if (kinds.length === 0 || kinds.some((k) => k.startsWith('-')))
    throw new KitError('usage', 'name the kinds to drop: npm run kit:prune -- tree pine');
  const before = weigh();
  const manifest = JSON.parse(readFileSync(join(OUT, 'scenery.json'), 'utf8')) as ManifestFile;
  const bin = readFileSync(join(OUT, 'scenery.bin'));
  const pruned = prune(manifest, bin, kinds);

  writeFileSync(join(OUT, 'scenery.bin'), pruned.bin);
  writeFileSync(join(OUT, 'scenery.json'), Buffer.from(JSON.stringify(pruned.manifest, null, 1) + '\n'));
  for (const mask of pruned.dropped.masks) rmSync(join(OUT, mask));

  const after = weigh();
  console.log(`dropped ${pruned.dropped.models.length} models: ${pruned.dropped.models.join(', ')}`);
  console.log(`dropped ${pruned.dropped.masks.length} masks: ${pruned.dropped.masks.join(', ') || 'none'}`);
  console.log(`scenery.bin ${bin.length} -> ${pruned.bin.length} bytes`);
  console.log(`public/scenery gzipped, each file on its own: ${before.total} -> ${after.total} bytes`);
};

try {
  main();
} catch (e) {
  if (e instanceof KitError) {
    console.error(`kit:prune: refused: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
