/**
 * The game's reading of the scenery files `npm run kit` writes: a half-precision number turned back into a float,
 * a part of a model turned into a mesh the renderer takes, the manifest checked, the whole kit unpacked, and the
 * loader that fetches the files and hands the masks to be decoded. Everything but `loadScenery` is pure, so it is
 * tested without a page, and `loadScenery` is handed its fetcher and decoder. The converter's packing lives in
 * `scripts/` and may not be imported here, since the page cannot carry a node script, so the two are held equal
 * by tests. Without the checks the files would be trusted as the converter wrote them, and a short, stale or
 * mismatched file would draw trees out of whatever bytes came next.
 */
import type { Mesh } from 'artshape-render/mesh/types';
import type { PALETTE } from './palette';

/** Where a part's arrays are in the scenery buffer, as `scenery.json` (version 2) says: byte offsets, four-aligned. */
export interface SceneryPart {
  vertices: number;
  indexCount: number;
  positionsOffset: number;
  normalsOffset: number;
  uvsOffset: number;
  indicesOffset: number;
}

/** The value an IEEE half's bits stand for: a sign, five bits of exponent (bias 15) and ten of fraction. */
export const float16ToFloat32 = (bits: number): number => {
  const sign = bits & 0x8000 ? -1 : 1;
  const e = (bits >> 10) & 31;
  const m = bits & 1023;
  if (e === 0) return sign * m * 2 ** -24;
  if (e === 31) return m === 0 ? sign * Infinity : NaN;
  return sign * (1 + m / 1024) * 2 ** (e - 15);
};

const halves = (buffer: ArrayBuffer, offset: number, count: number): Float32Array => {
  const view = new DataView(buffer);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = float16ToFloat32(view.getUint16(offset + i * 2, true));
  return out;
};

/** Refuses an array that is not four-byte aligned or runs past the buffer, by name. */
const check = (buffer: ArrayBuffer, name: string, offset: number, bytes: number): void => {
  if (!Number.isInteger(offset) || offset % 4 !== 0)
    throw new Error(`scenery-misaligned: ${name} starts at ${offset}, which is not on a four-byte boundary`);
  if (offset < 0 || offset + bytes > buffer.byteLength)
    throw new Error(`scenery-out-of-range: ${name} at ${offset} for ${bytes} bytes runs past the ${buffer.byteLength}`);
};

/**
 * A part as a mesh: float32 positions and normals decoded from halves, the uvs copied as they were, and the
 * indices widened to 32 bits as the renderer wants them. The arrays are copied out, so the buffer may be freed.
 */
export const unpackPart = (part: SceneryPart, buffer: ArrayBuffer): Mesh => {
  const n = part.vertices;
  check(buffer, 'positions', part.positionsOffset, n * 6);
  check(buffer, 'normals', part.normalsOffset, n * 6);
  check(buffer, 'uvs', part.uvsOffset, n * 8);
  check(buffer, 'indices', part.indicesOffset, part.indexCount * 2);
  const view = new DataView(buffer);
  const uvs = new Float32Array(n * 2);
  for (let i = 0; i < uvs.length; i++) uvs[i] = view.getFloat32(part.uvsOffset + i * 4, true);
  const indices = new Uint32Array(part.indexCount);
  for (let i = 0; i < indices.length; i++) indices[i] = view.getUint16(part.indicesOffset + i * 2, true);
  return {
    positions: halves(buffer, part.positionsOffset, n * 3),
    normals: halves(buffer, part.normalsOffset, n * 3),
    uvs,
    indices,
  };
};

/** The roles a part may have, as the converter's `ROLES` gives them: a test holds the two lists equal. */
export const SCENERY_ROLES = ['bark', 'leaves', 'pine', 'flowers', 'grass', 'stone', 'mushroom'] as const;
export type SceneryRole = (typeof SCENERY_ROLES)[number];

/**
 * The palette key each role is coloured from: the one place a part's role becomes a colour, so a new role cannot be
 * drawn in whatever the last one was. A test holds it to every role and to the palette.
 */
export const ROLE_COLOUR: Record<SceneryRole, keyof typeof PALETTE> = {
  bark: 'trunk',
  leaves: 'leaves',
  pine: 'pine',
  flowers: 'flowers',
  grass: 'grass',
  stone: 'stone',
  mushroom: 'mushroom',
};

/** What the game does with a model, as `scripts/kit-sources.json` says: a test holds the two lists equal. */
export const KINDS = ['bush', 'clover', 'fern', 'flowers', 'grass', 'mushroom', 'pebble', 'pine', 'tree'] as const;

/** The manifest's version and array types that this reader knows. */
const VERSION = 2;
const ARRAYS = { positions: 'float16', normals: 'float16', uvs: 'float32', indices: 'uint16' };
/** The largest mask the renderer's card array is given. */
const MASK_MAX = 1024;

export interface ManifestPart extends SceneryPart {
  role: SceneryRole;
  /** 1-based into `masks`, or 0 for a part drawn plain. */
  layer: number;
}

export interface ManifestModel {
  name: string;
  kind: string;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  triangles: number;
  parts: ManifestPart[];
}

export interface Manifest {
  version: number;
  maskSize: number;
  masks: string[];
  models: ManifestModel[];
}

const fail = (code: string, what: string): never => {
  throw new Error(`${code}: ${what}`);
};

const whole = (code: string, what: string, v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) fail(code, `${what} is ${String(v)}, not a whole number`);
  return v as number;
};

const record = (code: string, what: string, v: unknown): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(code, `${what} is not an object`);
  return v as Record<string, unknown>;
};

const triple = (code: string, what: string, v: unknown): [number, number, number] => {
  if (!Array.isArray(v) || v.length !== 3 || v.some((n) => typeof n !== 'number' || !Number.isFinite(n)))
    fail(code, `${what} is not three numbers`);
  return v as [number, number, number];
};

/** The manifest, checked as if anyone had written it; what is not known is refused by name. */
export const readManifest = (json: unknown): Manifest => {
  const m = record('scenery-manifest', 'the manifest', json);
  if (m.version !== VERSION) fail('scenery-version', `version ${String(m.version)} is not the one known, ${VERSION}`);
  const arrays = record('scenery-arrays', 'arrays', m.arrays);
  const keys = Object.keys(arrays).sort().join();
  const want = Object.keys(ARRAYS).sort().join();
  if (keys !== want || Object.entries(ARRAYS).some(([k, t]) => arrays[k] !== t))
    fail('scenery-arrays', `the array types ${JSON.stringify(arrays)} are not ${JSON.stringify(ARRAYS)}`);
  const maskSize = whole('scenery-mask-size', 'the mask size', m.maskSize);
  if (maskSize < 1 || (maskSize & (maskSize - 1)) !== 0 || maskSize > MASK_MAX)
    fail('scenery-mask-size', `${maskSize} is not a power of two up to ${MASK_MAX}`);
  if (!Array.isArray(m.masks) || m.masks.some((f) => typeof f !== 'string' || f === ''))
    fail('scenery-masks', 'masks is not a list of file names');
  const masks = m.masks as string[];
  if (!Array.isArray(m.models)) fail('scenery-models', 'models is not a list');
  const seen = new Set<string>();
  const models = (m.models as unknown[]).map((raw, n): ManifestModel => {
    const model = record('scenery-model', `model ${n}`, raw);
    const name = model.name;
    if (typeof name !== 'string' || name === '') return fail('scenery-model', `model ${n} has no name`);
    if (seen.has(name)) fail('scenery-duplicate', `the model "${name}" is in the manifest twice`);
    seen.add(name);
    if (!(KINDS as readonly unknown[]).includes(model.kind))
      fail('scenery-kind', `"${name}" has the kind "${String(model.kind)}", which is not known`);
    const bounds = record('scenery-model', `${name}'s bounds`, model.bounds);
    if (!Array.isArray(model.parts)) fail('scenery-model', `${name} has no parts`);
    const parts = (model.parts as unknown[]).map((rawPart): ManifestPart => {
      const p = record('scenery-model', `a part of ${name}`, rawPart);
      if (!(SCENERY_ROLES as readonly unknown[]).includes(p.role))
        fail('scenery-role', `a part of "${name}" has the role "${String(p.role)}", which is not known`);
      const layer = whole('scenery-layer', `a layer of ${name}`, p.layer);
      if (layer > masks.length)
        fail('scenery-layer', `a part of "${name}" is on layer ${layer} of ${masks.length} masks`);
      return {
        role: p.role as SceneryRole,
        layer,
        vertices: whole('scenery-count', `${name}'s vertices`, p.vertices),
        indexCount: whole('scenery-count', `${name}'s indexCount`, p.indexCount),
        positionsOffset: whole('scenery-offset', `${name}'s positionsOffset`, p.positionsOffset),
        normalsOffset: whole('scenery-offset', `${name}'s normalsOffset`, p.normalsOffset),
        uvsOffset: whole('scenery-offset', `${name}'s uvsOffset`, p.uvsOffset),
        indicesOffset: whole('scenery-offset', `${name}'s indicesOffset`, p.indicesOffset),
      };
    });
    return {
      name,
      kind: model.kind as string,
      bounds: {
        min: triple('scenery-model', `${name}'s bounds`, bounds.min),
        max: triple('scenery-model', `${name}'s bounds`, bounds.max),
      },
      triangles: whole('scenery-count', `${name}'s triangles`, model.triangles),
      parts,
    };
  });
  return { version: VERSION, maskSize, masks, models };
};

export interface KitPart {
  mesh: Mesh;
  role: SceneryRole;
  layer: number;
}

export interface KitModel {
  name: string;
  kind: string;
  bounds: ManifestModel['bounds'];
  triangles: number;
  parts: KitPart[];
}

export interface Kit {
  models: Map<string, KitModel>;
  /** The mask files in layer order: a part's `layer` is a place in this list, counted from one. */
  maskFiles: string[];
}

/** Every part of every model unpacked, with each index checked to name a vertex the part has. */
export const readKit = (manifest: Manifest, bin: ArrayBuffer): Kit => {
  const models = new Map<string, KitModel>();
  for (const model of manifest.models) {
    const parts = model.parts.map((part): KitPart => {
      const mesh = unpackPart(part, bin);
      for (let i = 0; i < mesh.indices.length; i++)
        if (mesh.indices[i] >= part.vertices)
          fail('scenery-index', `"${model.name}" has index ${mesh.indices[i]} for ${part.vertices} vertices`);
      return { mesh, role: part.role, layer: part.layer };
    });
    models.set(model.name, {
      name: model.name,
      kind: model.kind,
      bounds: model.bounds,
      triangles: model.triangles,
      parts,
    });
  }
  return { models, maskFiles: [...manifest.masks] };
};

/**
 * Fetches the manifest, then the buffer and the masks together, and returns the kit with the masks decoded in
 * layer order. Handed its fetcher, base address and decoder, so a test serves it from disk.
 */
export const loadScenery = async (
  fetcher: (url: string) => Promise<Response>,
  base: string,
  decode: (blob: Blob) => Promise<ImageBitmap>,
): Promise<{ kit: Kit; masks: ImageBitmap[] }> => {
  const get = async (name: string): Promise<Response> => {
    const url = base + name;
    const response = await fetcher(url);
    if (!response.ok) fail('scenery-fetch', `${url} answered ${response.status}`);
    return response;
  };
  // the manifest says which masks there are, so it comes first; the buffer and the masks then come together
  const manifest = readManifest(await (await get('scenery.json')).json());
  const [bin, ...blobs] = await Promise.all([
    get('scenery.bin').then((r) => r.arrayBuffer()),
    ...manifest.masks.map(async (f) => (await get(f)).blob()),
  ]);
  const kit = readKit(manifest, bin);
  const masks = await Promise.all(blobs.map(decode));
  return { kit, masks };
};
