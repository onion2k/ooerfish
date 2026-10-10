/**
 * Turns the Quaternius Stylized Nature MegaKit (CC0) into the game's own compact scenery files.
 *
 *   npm run kit -- <folder of .glb files> [--card-normals=face|kit|turned] (face by default)
 *
 * It reads `scripts/kit-sources.json`, refuses any file missing or whose sha256 differs (by its name), and
 * writes `public/scenery/`: `scenery.bin` (positions and normals as float16, uvs as float32 and indices as uint16 of every model part,
 * little-endian, four-byte aligned, in the game's Z-up axes), `scenery.json` (where each part is, its role and card layer) and one 256 by 256 alpha
 * mask for each card image used (greyscale with alpha, white, as the renderer reads only the alpha). The folder
 * is generated: it is built again by this script and never edited by hand. The files come from outside and are
 * read as bytes only; the working parts are in `kitting.ts`, and this file is the reading and writing.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PNG } from 'pngjs';
import {
  CARD_NORMALS,
  CARD_ROLES,
  cardNormals,
  type CardNormals,
  KitError,
  checkHash,
  pack,
  parseGlb,
  readImage,
  readParts,
  roleOf,
  shrinkAlpha,
  squareUvs,
  turnAxes,
  type PackedPart,
} from './kitting';

const SOURCES = 'scripts/kit-sources.json';
const OUT = 'public/scenery';
/** The side of a mask, in texels: a leaf's cut-out is coarse, and a card is a few pixels on the screen. */
const MASK_SIZE = 256;
const VERSION = 2;
/** What each array of a part is, so a reader never guesses; `src/scenery.ts` reads exactly these. */
const ARRAYS = { positions: 'float16', normals: 'float16', uvs: 'float32', indices: 'uint16' };

interface Source {
  file: string;
  name: string;
  polyPizzaId: string;
  sha256: string;
  kind: string;
}

const round = (x: number): number => Math.round(x * 10000) / 10000;
const gz = (b: Uint8Array): number => gzipSync(b).length;

const main = (): void => {
  const args = process.argv.slice(2);
  const flag = args.find((a) => a.startsWith('--card-normals='));
  // The kit's broadleaf and bush leaves carry rounded normals that face away from their cards, and the renderer turns
  // a card's normal over on its back, so half a canopy caught the rim light and went cream at night. The shipped
  // scenery wears each card's own face normal; the others are kept for comparing.
  const mode = (flag === undefined ? 'face' : flag.slice('--card-normals='.length)) as CardNormals;
  if (!CARD_NORMALS.includes(mode))
    throw new KitError('usage', `--card-normals is one of ${CARD_NORMALS.join(', ')}, not "${mode}"`);
  const folder = args.find((a) => !a.startsWith('--'));
  if (folder === undefined) throw new KitError('usage', 'give the folder of kit .glb files: npm run kit -- <folder>');
  const sources = (JSON.parse(readFileSync(SOURCES, 'utf8')) as { models: Source[] }).models;
  if (sources.length === 0) throw new KitError('no-sources', `${SOURCES} lists no models`);

  /** The decoded image for each card image used, by the name the kit gave it, in layer order. */
  const images = new Map<string, { sha: string; width: number; height: number; alpha: Uint8Array }>();
  const models: { name: string; kind: string; parts: PackedPart[] }[] = [];

  for (const source of sources) {
    const path = join(resolve(folder), source.file);
    if (!existsSync(path)) throw new KitError('missing-file', `${source.file} is not in ${folder}`);
    const bytes = readFileSync(path);
    checkHash(source.file, bytes, source.sha256);
    const { json, bin } = parseGlb(bytes);
    const parts: PackedPart[] = [];
    for (const part of readParts(json, bin)) {
      const role = roleOf(part.material);
      let layer = 0;
      let uvs = part.uvs;
      if (CARD_ROLES.has(role)) {
        if (part.image === null) throw new KitError('bad-image', `${source.file}: ${part.material} has no image`);
        const { name, bytes: png } = readImage(json, bin, part.image);
        if (!/^[A-Za-z0-9_.-]+\.png$/.test(name))
          throw new KitError('bad-image', `${source.file}: image name "${name}"`);
        const sha = createHash('sha256').update(png).digest('hex');
        let held = images.get(name);
        if (held === undefined) {
          const decoded = PNG.sync.read(Buffer.from(png));
          const alpha = new Uint8Array(decoded.width * decoded.height);
          for (let i = 0; i < alpha.length; i++) alpha[i] = decoded.data[i * 4 + 3];
          held = { sha, width: decoded.width, height: decoded.height, alpha };
          images.set(name, held);
        } else if (held.sha !== sha) {
          throw new KitError('image-differs', `${source.file}: ${name} is not the same image the other models carry`);
        }
        layer = [...images.keys()].indexOf(name) + 1;
        uvs = squareUvs(part.uvs, held.width, held.height);
      }
      parts.push({
        role,
        layer,
        positions: turnAxes(part.positions),
        normals: turnAxes(layer > 0 ? cardNormals(mode, part.positions, part.normals, part.indices) : part.normals),
        uvs,
        indices: part.indices,
      });
    }
    models.push({ name: source.name, kind: source.kind, parts });
  }

  const packed = pack(models);
  const masks = [...images.entries()].map(([name, img]) => {
    const alpha = shrinkAlpha(img.alpha, img.width, img.height, MASK_SIZE);
    const rgba = Buffer.alloc(MASK_SIZE * MASK_SIZE * 4, 255);
    for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i];
    const png = PNG.sync.write({ width: MASK_SIZE, height: MASK_SIZE, data: rgba } as PNG, {
      colorType: 4,
      inputColorType: 6,
      inputHasAlpha: true,
      deflateLevel: 9,
    });
    return { file: `mask-${name}`, source: name, png };
  });
  const manifest = {
    version: VERSION,
    note: 'Generated by npm run kit from the Quaternius Stylized Nature MegaKit (CC0). Never edited: built again.',
    arrays: ARRAYS,
    maskSize: MASK_SIZE,
    masks: masks.map((m) => m.file),
    models: packed.models.map((m) => ({
      ...m,
      bounds: { min: m.bounds.min.map(round), max: m.bounds.max.map(round) },
    })),
  };

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const json = Buffer.from(JSON.stringify(manifest, null, 1) + '\n');
  writeFileSync(join(OUT, 'scenery.bin'), packed.bin);
  writeFileSync(join(OUT, 'scenery.json'), json);
  for (const m of masks) writeFileSync(join(OUT, m.file), m.png);

  for (const m of packed.models)
    console.log(`${m.name.padEnd(34)} ${String(m.triangles).padStart(6)} tris ${String(m.bytes).padStart(8)} bytes`);
  for (const m of masks) console.log(`${m.file.padEnd(34)} ${String(m.png.length).padStart(15)} bytes`);
  let all = 0;
  let allGz = 0;
  for (const f of readdirSync(OUT)) {
    const b = readFileSync(join(OUT, f));
    all += b.length;
    allGz += gz(b);
  }
  console.log(`scenery.bin ${packed.bin.length} bytes, ${gz(packed.bin)} gzipped`);
  console.log(`public/scenery ${all} bytes, ${allGz} gzipped (each file on its own)`);
};

try {
  main();
} catch (e) {
  if (e instanceof KitError) {
    console.error(`kit: refused: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
