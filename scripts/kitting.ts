/**
 * The kit converter's working parts, apart from the files it reads and writes: a GLB read by hand, the axes
 * turned to the game's, a card's alpha shrunk to a mask, and the parts packed into one buffer and its manifest.
 * `kit.ts` is the file reading and writing; this is what can be wrong without any run of it showing, so the
 * tests reach it directly. Without the checks here a changed or damaged file from outside would be written into
 * the scenery the game then trusts: every refusal is a `KitError` with a code that names what was wrong.
 */
import { createHash } from 'node:crypto';

export class KitError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'KitError';
  }
}

/** What a part is made of, which the game maps to one palette key; the kit's material names say which. */
export type Role = 'bark' | 'leaves' | 'pine' | 'flowers' | 'grass' | 'stone' | 'mushroom';

export const ROLES: Readonly<Record<string, Role | undefined>> = {
  Bark_NormalTree: 'bark',
  Leaves_NormalTree: 'leaves',
  Leaves_TwistedTree: 'leaves',
  Leaves: 'leaves',
  Leaves_Pine: 'pine',
  Flowers: 'flowers',
  Grass: 'grass',
  PathRocks: 'stone',
  Rocks: 'stone',
  Mushrooms: 'mushroom',
};

/** The roles drawn as alpha-blended cards, whose texture is kept as a mask. */
export const CARD_ROLES: ReadonlySet<Role> = new Set<Role>(['leaves', 'pine', 'flowers']);

export const roleOf = (material: string): Role => {
  const role = ROLES[material];
  if (role === undefined) throw new KitError('unknown-material', `no role is known for the material "${material}"`);
  return role;
};

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** A glTF document: only what the converter reads of it is typed, since the rest is not looked at. */
export interface Gltf {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: { primitives: GltfPrimitive[] }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[];
  textures?: { source?: number }[];
  images?: { name?: string; bufferView?: number; mimeType?: string }[];
  accessors?: {
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    normalized?: boolean;
    sparse?: unknown;
  }[];
  bufferViews?: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}
interface GltfNode {
  children?: number[];
  mesh?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}
interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

/** Splits a GLB into its JSON document and its binary chunk. */
export const parseGlb = (bytes: Uint8Array): { json: Gltf; bin: Uint8Array } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12) throw new KitError('glb-truncated', 'the file is shorter than a GLB header');
  if (view.getUint32(0, true) !== MAGIC) throw new KitError('glb-bad-magic', 'the file does not begin with "glTF"');
  if (view.getUint32(4, true) !== 2) throw new KitError('glb-bad-version', 'only GLB version 2 is read');
  let json: Gltf | undefined;
  let bin: Uint8Array = new Uint8Array(0);
  let at = 12;
  while (at < bytes.length) {
    if (at + 8 > bytes.length) throw new KitError('glb-truncated', 'a chunk header runs past the end of the file');
    const length = view.getUint32(at, true);
    const type = view.getUint32(at + 4, true);
    const start = at + 8;
    if (start + length > bytes.length) throw new KitError('glb-truncated', 'a chunk runs past the end of the file');
    if (type === JSON_CHUNK && json === undefined) {
      try {
        json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + length))) as Gltf;
      } catch {
        throw new KitError('glb-bad-json', 'the JSON chunk does not parse');
      }
    } else if (type === BIN_CHUNK && bin.length === 0) {
      bin = bytes.subarray(start, start + length);
    }
    at = start + length;
  }
  if (json === undefined) throw new KitError('glb-no-json', 'the file has no JSON chunk');
  return { json, bin };
};

export const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Refuses a file that is not the one the game was built from, by its name. */
export const checkHash = (name: string, bytes: Uint8Array, expected: string): void => {
  const got = sha256Hex(bytes);
  if (got !== expected) throw new KitError('hash-mismatch', `${name} hashes to ${got}, not the ${expected} listed`);
};

/** Glb's Y-up to the game's Z-up, (x, y, z) to (x, -z, y): a quarter turn about x, so winding is kept. */
export const turnAxes = (a: Float32Array): Float32Array => {
  const out = new Float32Array(a.length);
  for (let i = 0; i + 2 < a.length; i += 3) {
    out[i] = a[i];
    out[i + 1] = 0 - a[i + 2];
    out[i + 2] = a[i + 1];
  }
  return out;
};

/** The share of texels at half alpha or more: what the cut-out of a card covers. */
export const alphaCoverage = (alpha: Uint8Array): number => {
  let n = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= 128) n++;
  return alpha.length === 0 ? 0 : n / alpha.length;
};

/**
 * An image's alpha padded to a square, clear at the bottom and right, then shrunk with a box filter to `size`
 * squared, and scaled so that as many texels are at half alpha or more as the original had. A box filter blurs a
 * speckled edge to grey and loses coverage, which would thin every leaf; the scale puts it back.
 */
export const shrinkAlpha = (alpha: Uint8Array, width: number, height: number, size: number): Uint8Array => {
  const side = Math.max(width, height);
  const step = side / size;
  const mean = new Float32Array(size * size);
  let before = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= 128) before++;
  const want = before / (side * side);
  // exact box weights per axis, so that a side which is not a multiple of the size still averages fairly
  const spans = (extent: number): { from: number; to: number; w: number[] }[] =>
    Array.from({ length: size }, (_, o) => {
      const lo = o * step;
      const hi = lo + step;
      const from = Math.floor(lo);
      const to = Math.min(extent, Math.ceil(hi));
      const w: number[] = [];
      for (let i = from; i < to; i++) w.push((Math.min(i + 1, hi) - Math.max(i, lo)) / step);
      return { from, to, w };
    });
  const cols = spans(width);
  const rows = spans(height);
  for (let oy = 0; oy < size; oy++)
    for (let ox = 0; ox < size; ox++) {
      let sum = 0;
      const r = rows[oy];
      const c = cols[ox];
      for (let y = r.from; y < r.to; y++) {
        let line = 0;
        for (let x = c.from; x < c.to; x++) line += alpha[y * width + x] * c.w[x - c.from];
        sum += line * r.w[y - r.from];
      }
      mean[oy * size + ox] = sum;
    }
  const countAt = (k: number): number => {
    let n = 0;
    for (let i = 0; i < mean.length; i++) if (mean[i] * k >= 127.5) n++;
    return n;
  };
  const target = Math.round(want * mean.length);
  // The smallest scale that reaches the original's coverage, and the largest that gives no more than that: the
  // scale nearest one inside that span, so a mask that already matches is left exactly as it was.
  let lo = 0;
  let hi = 256;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (countAt(mid) >= target) hi = mid;
    else lo = mid;
  }
  const smallest = hi;
  const reached = countAt(smallest);
  let top = 256;
  lo = smallest;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + top) / 2;
    if (countAt(mid) <= reached) lo = mid;
    else top = mid;
  }
  const k = Math.min(Math.max(1, smallest), lo);
  const out = new Uint8Array(mean.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.round(mean[i] * k));
  return out;
};

/** How a card's normals are made: as the kit has them, those of its face, or the kit's turned to the face's side. */
export type CardNormals = 'kit' | 'face' | 'turned';
export const CARD_NORMALS: readonly CardNormals[] = ['kit', 'face', 'turned'];

/**
 * The normals of a leaf card. The kit's broadleaf canopies carry rounded normals that mostly face away from their
 * own cards, and the renderer flips a normal on a card's back face, so half a canopy would catch the rim light at
 * full strength. 'face' gives each corner the unit normal of its triangles (weighted by area where several share it);
 * 'turned' keeps the kit's normal wherever it already faces the card's front and mirrors it across the card
 * where it does not, so the rounded shading stays. Without this choice a canopy is as pale as its worst normals.
 */
export const cardNormals = (
  mode: CardNormals,
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
): Float32Array => {
  if (mode === 'kit') return normals;
  const face = new Float32Array(positions.length);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const e1x = positions[b] - positions[a];
    const e1y = positions[b + 1] - positions[a + 1];
    const e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a];
    const e2y = positions[c + 1] - positions[a + 1];
    const e2z = positions[c + 2] - positions[a + 2];
    // the cross product's length is twice the triangle's area, which is the weight wanted
    const x = e1y * e2z - e1z * e2y;
    const y = e1z * e2x - e1x * e2z;
    const z = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      face[v] += x;
      face[v + 1] += y;
      face[v + 2] += z;
    }
  }
  const out = new Float32Array(normals.length);
  for (let v = 0; v + 2 < face.length; v += 3) {
    const len = Math.hypot(face[v], face[v + 1], face[v + 2]);
    if (len === 0) {
      // a corner with no area under it has no face to follow
      out.set(normals.subarray(v, v + 3), v);
      continue;
    }
    const fx = face[v] / len;
    const fy = face[v + 1] / len;
    const fz = face[v + 2] / len;
    if (mode === 'face') {
      out[v] = fx;
      out[v + 1] = fy;
      out[v + 2] = fz;
      continue;
    }
    const nx = normals[v];
    const ny = normals[v + 1];
    const nz = normals[v + 2];
    const d = nx * fx + ny * fy + nz * fz;
    if (d >= 0) {
      out[v] = nx;
      out[v + 1] = ny;
      out[v + 2] = nz;
      continue;
    }
    const tx = nx - 2 * d * fx;
    const ty = ny - 2 * d * fy;
    const tz = nz - 2 * d * fz;
    const l = Math.hypot(tx, ty, tz) || 1;
    out[v] = tx / l;
    out[v + 1] = ty / l;
    out[v + 2] = tz / l;
  }
  return out;
};

/** The uvs of a part drawn from a width by height image, so they land on the same texels once it is padded square. */
export const squareUvs = (uvs: Float32Array, width: number, height: number): Float32Array => {
  const side = Math.max(width, height);
  const out = new Float32Array(uvs.length);
  for (let i = 0; i + 1 < uvs.length; i += 2) {
    out[i] = (uvs[i] * width) / side;
    out[i + 1] = (uvs[i + 1] * height) / side;
  }
  return out;
};

/** One drawable piece of a model, as the file had it: one material, one set of buffers, in glTF's axes. */
export interface Part {
  material: string;
  /** The image the material's base colour reads, or null if it has none. */
  image: number | null;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

type Mat = number[];
const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major product a * b. */
const mul = (a: Mat, b: Mat): Mat => {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};

const localMatrix = (n: GltfNode): Mat => {
  if (n.matrix !== undefined) {
    if (n.matrix.length !== 16) throw new KitError('bad-node', 'a node matrix is not sixteen numbers');
    return n.matrix;
  }
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  const x = qx / len;
  const y = qy / len;
  const z = qz / len;
  const w = qw / len;
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
};

/** Reads an accessor's floats (or integers) out of the binary chunk, honouring the view's stride. */
const readAccessor = (
  json: Gltf,
  bin: Uint8Array,
  index: number,
  type: string,
  components: readonly number[],
): Float32Array | Uint32Array => {
  const acc = json.accessors?.[index];
  if (acc === undefined) throw new KitError('bad-accessor', `accessor ${index} does not exist`);
  if (acc.type !== type) throw new KitError('bad-accessor', `accessor ${index} is ${acc.type}, not ${type}`);
  if (!components.includes(acc.componentType))
    throw new KitError(
      'bad-accessor',
      `accessor ${index} has component type ${acc.componentType}, not ${components.join(' or ')}`,
    );
  if (acc.sparse !== undefined || acc.normalized === true || acc.bufferView === undefined)
    throw new KitError('bad-accessor', `accessor ${index} is sparse, normalised or has no view, which is not read`);
  const view = json.bufferViews?.[acc.bufferView];
  if (view === undefined) throw new KitError('bad-accessor', `accessor ${index} has no buffer view`);
  const per = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type] ?? 0;
  const size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType] ?? 0;
  const stride = view.byteStride ?? per * size;
  const base = bin.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const last = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0) + (acc.count - 1) * stride + per * size;
  if (acc.count > 0 && (last > bin.length || last > (view.byteOffset ?? 0) + view.byteLength))
    throw new KitError('glb-truncated', `accessor ${index} runs past its buffer`);
  const dv = new DataView(bin.buffer);
  const out = acc.componentType === 5126 ? new Float32Array(acc.count * per) : new Uint32Array(acc.count * per);
  for (let i = 0; i < acc.count; i++)
    for (let c = 0; c < per; c++) {
      const at = base + i * stride + c * size;
      out[i * per + c] =
        acc.componentType === 5126
          ? dv.getFloat32(at, true)
          : acc.componentType === 5125
            ? dv.getUint32(at, true)
            : acc.componentType === 5123
              ? dv.getUint16(at, true)
              : dv.getUint8(at);
    }
  return out;
};

/** Every mesh primitive in the default scene, as parts with their node transforms applied (in glTF's axes). */
export const readParts = (json: Gltf, bin: Uint8Array): Part[] => {
  const parts: Part[] = [];
  const nodes = json.nodes ?? [];
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  const visit = (index: number, parent: Mat, depth: number): void => {
    const node = nodes[index] as GltfNode | undefined;
    if (node === undefined || depth > 32) throw new KitError('bad-node', `node ${index} is missing or nested too deep`);
    const m = mul(parent, localMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = json.meshes?.[node.mesh];
      if (mesh === undefined) throw new KitError('bad-node', `mesh ${node.mesh} does not exist`);
      for (const prim of mesh.primitives) parts.push(readPrimitive(json, bin, prim, m));
    }
    for (const child of node.children ?? []) visit(child, m, depth + 1);
  };
  for (const root of roots) visit(root, IDENTITY, 0);
  return parts;
};

const readPrimitive = (json: Gltf, bin: Uint8Array, prim: GltfPrimitive, m: Mat): Part => {
  if ((prim.mode ?? 4) !== 4) throw new KitError('bad-primitive', 'only triangle lists are read');
  const at: Partial<Record<string, number>> = prim.attributes;
  if (at.POSITION === undefined || at.NORMAL === undefined || at.TEXCOORD_0 === undefined || prim.indices === undefined)
    throw new KitError('bad-primitive', 'a primitive lacks positions, normals, uvs or indices');
  const positions = readAccessor(json, bin, at.POSITION, 'VEC3', [5126]) as Float32Array;
  const normals = readAccessor(json, bin, at.NORMAL, 'VEC3', [5126]) as Float32Array;
  const uvs = readAccessor(json, bin, at.TEXCOORD_0, 'VEC2', [5126]) as Float32Array;
  const indices = readAccessor(json, bin, prim.indices, 'SCALAR', [5121, 5123, 5125]) as Uint32Array;
  const count = positions.length / 3;
  if (normals.length !== positions.length || uvs.length / 2 !== count)
    throw new KitError('bad-primitive', 'positions, normals and uvs disagree on the vertex count');
  if (indices.length % 3 !== 0) throw new KitError('bad-primitive', 'the indices are not whole triangles');
  for (let i = 0; i < indices.length; i++)
    if (indices[i] >= count) throw new KitError('bad-primitive', 'an index is past the last vertex');
  // normals take the inverse transpose of the upper 3x3, which is the cofactor matrix up to the sign of its determinant
  const [a, d, g, , b, e, h, , c, f, i2] = [m[0], m[1], m[2], 0, m[4], m[5], m[6], 0, m[8], m[9], m[10]];
  const cof = [
    e * i2 - h * f,
    -(d * i2 - g * f),
    d * h - g * e,
    -(b * i2 - h * c),
    a * i2 - g * c,
    -(a * h - g * b),
    b * f - e * c,
    -(a * f - d * c),
    a * e - d * b,
  ];
  const det = a * cof[0] + b * cof[1] + c * cof[2];
  const sign = det < 0 ? -1 : 1;
  const p = new Float32Array(positions.length);
  const n = new Float32Array(normals.length);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    p[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
    p[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    p[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];
    // cof is the cofactor matrix, row by row, so each row dotted with the normal is one component
    const tx = (cof[0] * nx + cof[1] * ny + cof[2] * nz) * sign;
    const ty = (cof[3] * nx + cof[4] * ny + cof[5] * nz) * sign;
    const tz = (cof[6] * nx + cof[7] * ny + cof[8] * nz) * sign;
    const len = Math.hypot(tx, ty, tz) || 1;
    n[v * 3] = tx / len;
    n[v * 3 + 1] = ty / len;
    n[v * 3 + 2] = tz / len;
  }
  const material = prim.material === undefined ? undefined : json.materials?.[prim.material];
  if (material?.name === undefined) throw new KitError('bad-primitive', 'a primitive has no named material');
  const texture = material.pbrMetallicRoughness?.baseColorTexture?.index;
  const image = texture === undefined ? null : (json.textures?.[texture]?.source ?? null);
  return { material: material.name, image, positions: p, normals: n, uvs, indices };
};

/** The bytes of an embedded image, and the name the file gave it. */
export const readImage = (json: Gltf, bin: Uint8Array, index: number): { name: string; bytes: Uint8Array } => {
  const image = json.images?.[index];
  const view = image?.bufferView === undefined ? undefined : json.bufferViews?.[image.bufferView];
  if (image?.name === undefined || view === undefined)
    throw new KitError('bad-image', `image ${index} is missing, unnamed or not embedded`);
  const from = view.byteOffset ?? 0;
  if (from + view.byteLength > bin.length) throw new KitError('glb-truncated', `image ${index} runs past its buffer`);
  return { name: image.name, bytes: bin.subarray(from, from + view.byteLength) };
};

/** A part ready to be packed: game axes, uvs for the padded mask, its role, and its 1-based card layer or 0. */
export interface PackedPart {
  role: Role;
  layer: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface PartEntry {
  role: Role;
  layer: number;
  vertices: number;
  indexCount: number;
  positionsOffset: number;
  normalsOffset: number;
  uvsOffset: number;
  indicesOffset: number;
}

export interface ModelEntry {
  name: string;
  kind: string;
  /** In the game's axes, metres: [minX, minY, minZ] and [maxX, maxY, maxZ]. */
  bounds: { min: number[]; max: number[] };
  triangles: number;
  bytes: number;
  parts: PartEntry[];
}

/** The most vertices a part may have: a sixteen-bit index reaches 0 to 65,534, and the top value is kept back. */
export const MAX_PART_VERTICES = 65535;

/** The nearest whole number, a tie going to the even one, as IEEE rounding goes; Math.round sends ties up. */
const roundEven = (x: number): number => {
  const f = Math.floor(x);
  const d = x - f;
  return d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 === 0 ? f : f + 1;
};

/**
 * A number as the bits of an IEEE half (one sign bit, five of exponent, ten of fraction), rounded to the nearest
 * and a tie to the even. Subnormals are kept and what is under half the smallest becomes a signed zero. What a
 * half cannot hold (65520 and over, which would round past 65504, an infinity or a NaN) is refused by name and
 * not clamped, since a clamped vertex is a tree with a spike in it that nothing would then explain.
 */
export const encodeHalf = (value: number): number => {
  if (!Number.isFinite(value) || Math.abs(value) >= 65520)
    throw new KitError('half-range', `${value} does not fit an IEEE half (largest 65504)`);
  const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
  const a = Math.abs(value);
  if (a < 2 ** -14) return sign | roundEven(a * 2 ** 24);
  let e = Math.floor(Math.log2(a));
  // log2 can land a hair either side of a power of two, so the exponent is made to satisfy 2^e <= a < 2^(e+1)
  while (2 ** e > a) e--;
  while (2 ** (e + 1) <= a) e++;
  let q = roundEven((a / 2 ** e - 1) * 1024);
  if (q === 1024) {
    q = 0;
    e++;
  }
  return sign | ((e + 15) << 10) | q;
};

const encodeHalves = (a: Float32Array): Uint16Array => {
  const out = new Uint16Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = encodeHalf(a[i]);
  return out;
};

/**
 * Lays every model's parts end to end in one little-endian buffer and says where. Positions and normals are
 * halves (two bytes, and a model is a few metres across so the precision is a millimetre or better), indices are
 * sixteen bits, uvs stay whole floats since a card's texels are read from them. Every array starts on a four-byte
 * boundary, zero padded, so the game may view the file's floats and words in place.
 */
export const pack = (
  models: { name: string; kind: string; parts: PackedPart[] }[],
): { bin: Uint8Array; models: ModelEntry[] } => {
  const padded = (bytes: number): number => Math.ceil(bytes / 4) * 4;
  let total = 0;
  for (const m of models)
    for (const p of m.parts) {
      if (p.positions.length / 3 > MAX_PART_VERTICES)
        throw new KitError(
          'part-too-large',
          `${m.name} has a part of ${p.positions.length / 3} vertices, over the ${MAX_PART_VERTICES} a sixteen-bit index reaches`,
        );
      total +=
        padded(p.positions.length * 2) +
        padded(p.normals.length * 2) +
        padded(p.uvs.byteLength) +
        padded(p.indices.length * 2);
    }
  const bin = new Uint8Array(total);
  const view = new DataView(bin.buffer);
  let at = 0;
  const put = (a: Float32Array | Uint16Array): number => {
    const start = at;
    if (a instanceof Float32Array) a.forEach((v, i) => view.setFloat32(start + i * 4, v, true));
    else a.forEach((v, i) => view.setUint16(start + i * 2, v, true));
    at += padded(a.byteLength);
    return start;
  };
  const out: ModelEntry[] = [];
  for (const m of models) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let triangles = 0;
    const first = at;
    const parts: PartEntry[] = [];
    for (const p of m.parts) {
      for (let i = 0; i < p.positions.length; i++) {
        min[i % 3] = Math.min(min[i % 3], p.positions[i]);
        max[i % 3] = Math.max(max[i % 3], p.positions[i]);
      }
      triangles += p.indices.length / 3;
      parts.push({
        role: p.role,
        layer: p.layer,
        vertices: p.positions.length / 3,
        indexCount: p.indices.length,
        positionsOffset: put(encodeHalves(p.positions)),
        normalsOffset: put(encodeHalves(p.normals)),
        uvsOffset: put(p.uvs),
        indicesOffset: put(Uint16Array.from(p.indices)),
      });
    }
    out.push({ name: m.name, kind: m.kind, bounds: { min, max }, triangles, bytes: at - first, parts });
  }
  return { bin, models: out };
};
