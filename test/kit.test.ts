/**
 * The kit converter's working parts: reading a GLB's chunks, turning the axes, shrinking a card's alpha and
 * rescaling its uvs, and refusing a file that is not the one the game was built from. The converter turns files
 * from outside into files the game loads without a second look, so each of these is a thing that goes wrong
 * quietly: a flipped triangle is a hole in a tree, and a mask that lost its coverage is a thinner bush.
 * The GLBs here are hand-made and tiny; none comes from the kit.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  KitError,
  MAX_PART_VERTICES,
  alphaCoverage,
  cardNormals,
  checkHash,
  encodeHalf,
  pack,
  parseGlb,
  prune,
  readParts,
  roleOf,
  shrinkAlpha,
  squareUvs,
  turnAxes,
} from '../scripts/kitting';

const text = (s: string) => new TextEncoder().encode(s);

/** A GLB around the given JSON and bin, padded as the format asks (JSON with spaces, bin with zeros). */
const glb = (json: unknown, bin = new Uint8Array(0), parts: { json?: number; bin?: number } = {}): Uint8Array => {
  const pad = (b: Uint8Array, fill: number) => {
    const out = new Uint8Array(Math.ceil(b.length / 4) * 4).fill(fill);
    out.set(b);
    return out;
  };
  const j = pad(text(JSON.stringify(json)), 0x20);
  const b = pad(bin, 0);
  const total = 12 + 8 + j.length + (b.length ? 8 + b.length : 0);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, j.length + (parts.json ?? 0), true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(j, 20);
  if (b.length) {
    v.setUint32(20 + j.length, b.length + (parts.bin ?? 0), true);
    v.setUint32(24 + j.length, 0x004e4942, true);
    out.set(b, 28 + j.length);
  }
  return out;
};

/** One triangle with the given positions and normal, uvs, uint16 indices, in a node with the given transform. */
const triangle = (positions: number[], normal: number[], uvs: number[], node: object = {}, material = 'Rocks') => {
  const floats = [...positions, ...normal, ...normal, ...normal, ...uvs];
  const bin = new Uint8Array(floats.length * 4 + 8);
  const v = new DataView(bin.buffer);
  floats.forEach((f, i) => v.setFloat32(i * 4, f, true));
  [0, 1, 2].forEach((x, i) => v.setUint16(floats.length * 4 + i * 2, x, true));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, ...node }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ name: material }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 36 },
      { buffer: 0, byteOffset: 72, byteLength: 24 },
      { buffer: 0, byteOffset: 96, byteLength: 6 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  return glb(json, bin);
};

const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a: ArrayLike<number>, b: ArrayLike<number>) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('a GLB read by hand', () => {
  it('finds the JSON and the BIN chunks', () => {
    const { json, bin } = parseGlb(glb({ asset: { version: '2.0' } }, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])));
    expect((json as { asset?: { version?: string } }).asset?.version).toBe('2.0');
    expect(Array.from(bin)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('refuses a bad magic by name', () => {
    const bytes = glb({ asset: {} });
    bytes[0] = 0x58;
    expect(() => parseGlb(bytes)).toThrowError(KitError);
    expect(() => parseGlb(bytes)).toThrowError(/glb-bad-magic/);
  });

  it('refuses a chunk that runs past the end of the file by name', () => {
    const bytes = glb({ asset: {} }, new Uint8Array(8), { bin: 64 });
    expect(() => parseGlb(bytes)).toThrowError(/glb-truncated/);
    expect(() => parseGlb(bytes.subarray(0, 10))).toThrowError(/glb-truncated/);
  });

  it('refuses a file with no JSON chunk by name', () => {
    const bytes = new Uint8Array(12);
    const v = new DataView(bytes.buffer);
    v.setUint32(0, 0x46546c67, true);
    v.setUint32(4, 2, true);
    v.setUint32(8, 12, true);
    expect(() => parseGlb(bytes)).toThrowError(/glb-no-json/);
  });
});

describe('the axes turned from the glTF way up to the game’s', () => {
  it('sends (x, y, z) to (x, -z, y)', () => {
    expect(Array.from(turnAxes(new Float32Array([1, 2, 3])))).toEqual([1, -3, 2]);
  });

  it('keeps a known triangle’s winding: its edges still cross along its normal', () => {
    // counter-clockwise seen from +y, facing up in glTF's way up
    const p = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, -1]);
    const n = new Float32Array([0, 1, 0]);
    const before = cross(sub(p.subarray(3, 6), p.subarray(0, 3)), sub(p.subarray(6, 9), p.subarray(0, 3)));
    expect(dot(before, Array.from(n))).toBeGreaterThan(0);
    const tp = turnAxes(p);
    const tn = turnAxes(n);
    const after = cross(sub(tp.subarray(3, 6), tp.subarray(0, 3)), sub(tp.subarray(6, 9), tp.subarray(0, 3)));
    expect(Array.from(tn)).toEqual([0, 0, 1]);
    expect(dot(after, Array.from(tn))).toBeGreaterThan(0);
    // and not merely the same side: the same direction
    expect(after[0]).toBeCloseTo(0);
    expect(after[1]).toBeCloseTo(0);
    expect(after[2]).toBeCloseTo(before[1]);
  });
});

describe('a card’s alpha shrunk to a mask', () => {
  /** A 1024-wide image with a soft-edged disc of leaf in it, as a card might have. */
  const card = (w: number, h: number) => {
    const a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - w * 0.4, y - h * 0.5) / (h * 0.35);
        // a soft rim, and a scatter of holes that a box filter will blur to grey
        const hole = (x * 7 + y * 13) % 5 === 0 && d < 0.9;
        a[y * w + x] = hole ? 0 : Math.max(0, Math.min(255, Math.round((1.15 - d) * 600)));
      }
    return a;
  };

  it('keeps the share of texels at half alpha or more within two per cent', () => {
    for (const [w, h] of [
      [1024, 1024],
      [1024, 997],
    ]) {
      const a = card(w, h);
      const side = Math.max(w, h);
      // the original's share, over the padded square both are counted in
      const padded = new Uint8Array(side * side);
      for (let y = 0; y < h; y++) padded.set(a.subarray(y * w, y * w + w), y * side);
      const want = alphaCoverage(padded);
      const mask = shrinkAlpha(a, w, h, 256);
      expect(mask.length).toBe(256 * 256);
      const got = alphaCoverage(mask);
      expect(want).toBeGreaterThan(0.1);
      expect(Math.abs(got - want), `${w}x${h}: ${got} against ${want}`).toBeLessThan(0.02);
    }
  });

  it('pads a non-square image with clear texels at the bottom and right', () => {
    const w = 8;
    const h = 6;
    const mask = shrinkAlpha(new Uint8Array(w * h).fill(255), w, h, 4);
    // 8x8 padded to 4x4: each mask texel is a 2x2 box, and the bottom row of boxes is half image, half padding
    expect(Array.from(mask.subarray(0, 4))).toEqual([255, 255, 255, 255]);
    expect(Array.from(mask.subarray(8, 12)).every((x) => x === 255)).toBe(true);
    expect(Array.from(mask.subarray(12, 16)).every((x) => x === 0)).toBe(true);
  });
});

describe('uvs of a part drawn from a non-square image', () => {
  it('are rescaled so they land on the same texels once the image is padded to square', () => {
    const w = 1024;
    const h = 997;
    const side = 1024;
    const uv = new Float32Array([0, 0, 1, 1, 0.5, 0.25]);
    const out = squareUvs(uv, w, h);
    for (let i = 0; i < 3; i++) {
      // the texel in the original, and in the padded image, in pixels
      expect(out[i * 2] * side).toBeCloseTo(uv[i * 2] * w, 3);
      expect(out[i * 2 + 1] * side).toBeCloseTo(uv[i * 2 + 1] * h, 3);
    }
    expect(out[3]).toBeCloseTo(997 / 1024, 6);
  });

  it('leaves the uvs of a square image as they were', () => {
    const uv = new Float32Array([0.1, 0.9, 0.5, 0.5]);
    expect(Array.from(squareUvs(uv, 1024, 1024))).toEqual(Array.from(uv));
  });
});

describe('the sources the kit is held to', () => {
  const bytes = text('a model');
  const hash = createHash('sha256').update(bytes).digest('hex');

  it('accepts a file whose hash is the one listed', () => {
    expect(() => checkHash('Tree_x.glb', bytes, hash)).not.toThrow();
  });

  it('refuses a file whose hash differs, naming it', () => {
    expect(() => checkHash('Tree_x.glb', text('another model'), hash)).toThrowError(/hash-mismatch.*Tree_x\.glb/);
  });
});

describe('a model read into parts', () => {
  it('applies the node transform, and names the material’s role', () => {
    // a node scaled by two and moved up one, holding a triangle
    const bytes = triangle([0, 0, 0, 1, 0, 0, 0, 0, -1], [0, 1, 0], [0, 0, 1, 0, 0, 1], {
      scale: [2, 2, 2],
      translation: [0, 1, 0],
    });
    const { json, bin } = parseGlb(bytes);
    const parts = readParts(json, bin);
    expect(parts).toHaveLength(1);
    expect(parts[0].material).toBe('Rocks');
    expect(Array.from(parts[0].positions)).toEqual([0, 1, 0, 2, 1, 0, 0, 1, -2]);
    expect(Array.from(parts[0].normals.subarray(0, 3))).toEqual([0, 1, 0]);
    expect(Array.from(parts[0].indices)).toEqual([0, 1, 2]);
  });

  it('turns a normal by the inverse transpose, so a stretched node does not skew it off its surface', () => {
    // stretched to twice the height, a face leaning at forty-five degrees leans less steeply on a normal
    const s = Math.SQRT1_2;
    const bytes = triangle([0, 0, 0, 1, 1, 0, 0, 0, 1], [0, s, s], [0, 0, 1, 0, 0, 1], { scale: [1, 2, 1] });
    const { json, bin } = parseGlb(bytes);
    const n = readParts(json, bin)[0].normals;
    expect(n[0]).toBeCloseTo(0);
    expect(n[2] / n[1]).toBeCloseTo(2);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1);
  });
});

/** The value a half-precision bit pattern stands for, worked out from the format's definition for the test alone. */
const halfValue = (bits: number): number => {
  const sign = bits & 0x8000 ? -1 : 1;
  const e = (bits >> 10) & 31;
  const m = bits & 1023;
  return e === 0 ? sign * m * 2 ** -24 : sign * (1 + m / 1024) * 2 ** (e - 15);
};

describe('a number written as an IEEE half', () => {
  it('is exact for every value a half can hold', () => {
    for (const v of [0, 1, -1, 0.5, -2, 3.5, 1024, 2 ** -14, 2 ** -24, 65504, -65504, 0.333251953125])
      expect(halfValue(encodeHalf(v))).toBe(v);
  });

  it('keeps the sign of a zero', () => {
    expect(encodeHalf(0)).toBe(0);
    expect(encodeHalf(-0)).toBe(0x8000);
  });

  it('is within half a unit in the last place for any other value', () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 2000; i++) {
      const v = (next() - 0.5) * 2 * 10 ** (next() * 8 - 4);
      const got = halfValue(encodeHalf(v));
      expect(Math.abs(got - v)).toBeLessThanOrEqual(Math.max(Math.abs(v) * 2 ** -11, 2 ** -25));
    }
  });

  it('rounds a tie to the even neighbour', () => {
    // 1 + 2^-11 is midway between 1 (even) and 1 + 2^-10; 1 + 3 * 2^-11 is midway between 1 + 2^-10 (odd) and 1 + 2^-9
    expect(encodeHalf(1 + 2 ** -11)).toBe(0x3c00);
    expect(encodeHalf(1 + 3 * 2 ** -11)).toBe(0x3c02);
  });

  it('reaches the subnormals, and flushes what is under half the smallest to zero', () => {
    expect(halfValue(encodeHalf(3 * 2 ** -24))).toBe(3 * 2 ** -24);
    expect(halfValue(encodeHalf(1.4 * 2 ** -24))).toBe(2 ** -24);
    expect(encodeHalf(0.4 * 2 ** -24)).toBe(0);
    expect(encodeHalf(0.5 * 2 ** -24)).toBe(0); // the tie goes to the even neighbour, zero
  });

  it('carries a mantissa that rounds up into the next exponent', () => {
    expect(halfValue(encodeHalf(2 - 2 ** -12))).toBe(2);
  });

  it('refuses what is over range, infinite or not a number, by name, rather than clamping a vertex', () => {
    for (const v of [65520, -65520, 1e9, Infinity, -Infinity, NaN])
      expect(() => encodeHalf(v)).toThrowError(/half-range/);
    expect(halfValue(encodeHalf(65519))).toBe(65504);
  });
});

describe('parts packed into one buffer', () => {
  const part = (vertices: number, triangles = 1) => ({
    role: 'stone' as const,
    layer: 0,
    positions: new Float32Array(vertices * 3).map((_, i) => (i % 7) - 3),
    normals: new Float32Array(vertices * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)),
    uvs: new Float32Array(vertices * 2).map((_, i) => i / 100),
    indices: new Uint32Array(triangles * 3).map((_, i) => i % vertices),
  });

  it('starts every array on a four-byte boundary, whatever the counts', () => {
    // odd vertex counts and odd index counts are the ones that leave a half-width array two bytes short
    const { bin, models } = pack([
      { name: 'a', kind: 'k', parts: [part(3), part(5, 3), part(7, 1)] },
      { name: 'b', kind: 'k', parts: [part(9, 5)] },
    ]);
    for (const m of models)
      for (const p of m.parts)
        for (const at of [p.positionsOffset, p.normalsOffset, p.uvsOffset, p.indicesOffset]) expect(at % 4).toBe(0);
    expect(bin.length % 4).toBe(0);
  });

  it('keeps the arrays apart: each one’s offset is past the last one’s end', () => {
    const { models } = pack([{ name: 'a', kind: 'k', parts: [part(5, 3)] }]);
    const p = models[0].parts[0];
    expect(p.normalsOffset).toBeGreaterThanOrEqual(p.positionsOffset + 5 * 3 * 2);
    expect(p.uvsOffset).toBeGreaterThanOrEqual(p.normalsOffset + 5 * 3 * 2);
    expect(p.indicesOffset).toBeGreaterThanOrEqual(p.uvsOffset + 5 * 2 * 4);
    expect(models[0].bytes).toBeGreaterThanOrEqual(p.indicesOffset + 9 * 2 - p.positionsOffset);
  });

  it('refuses a part with more vertices than a sixteen-bit index reaches, by name', () => {
    expect(MAX_PART_VERTICES).toBe(65535);
    expect(() => pack([{ name: 'big', kind: 'k', parts: [part(65536)] }])).toThrowError(/part-too-large.*big/);
    expect(() => pack([{ name: 'ok', kind: 'k', parts: [part(65535)] }])).not.toThrow();
  });

  it('refuses a position that does not fit a half, naming the model', () => {
    const p = part(3);
    p.positions[4] = 70000;
    expect(() => pack([{ name: 'wide', kind: 'k', parts: [p] }])).toThrowError(/half-range/);
  });
});

describe('what a material is for', () => {
  it('refuses the dead tree’s bark, which no source uses, by name', () => {
    expect(() => roleOf('Bark_DeadTree')).toThrowError(/unknown-material.*Bark_DeadTree/);
    expect(roleOf('Bark_NormalTree')).toBe('bark');
  });
});

describe('the normals of a leaf card', () => {
  // A card folded a little along its diagonal, two triangles sharing two corners, with the rounded normals a
  // canopy's cards carry: some face the card's back, so a back face would flip them into the light.
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0.1]);
  const indices = new Uint32Array([0, 1, 2, 1, 3, 2]);
  const unit = (x: number, y: number, z: number): number[] => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  };
  const kit = new Float32Array([
    ...unit(0, 0, -1),
    ...unit(0.6, 0, -0.8),
    ...unit(0, 0.6, 0.8),
    ...unit(-0.6, 0.3, -0.5),
  ]);
  /** The face normal at each corner, worked out here from the triangles, weighted by area as a corner shared is. */
  const faceAt = (): number[][] => {
    const f = Array.from({ length: 4 }, () => [0, 0, 0]);
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
      const e1 = [0, 1, 2].map((k) => positions[b * 3 + k] - positions[a * 3 + k]);
      const e2 = [0, 1, 2].map((k) => positions[c * 3 + k] - positions[a * 3 + k]);
      const x = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      for (const v of [a, b, c]) for (let k = 0; k < 3; k++) f[v][k] += x[k];
    }
    return f.map((v) => unit(v[0], v[1], v[2]));
  };
  const dots = (n: Float32Array): number[] =>
    faceAt().map((f, v) => f[0] * n[v * 3] + f[1] * n[v * 3 + 1] + f[2] * n[v * 3 + 2]);

  it('keeps the kit’s own, as it was, by default', () => {
    expect(cardNormals('kit', positions, kit, indices)).toEqual(kit);
  });

  it('gives every corner the normal of the card’s face', () => {
    expect(Math.min(...dots(kit))).toBeLessThan(0);
    for (const d of dots(cardNormals('face', positions, kit, indices))) expect(d).toBeGreaterThan(0.99);
  });

  it('turns only the normals that face the card’s back, to its front, and leaves the rest', () => {
    const before = dots(kit);
    const turned = cardNormals('turned', positions, kit, indices);
    const after = dots(turned);
    expect(before.some((d) => d < 0) && before.some((d) => d >= 0)).toBe(true);
    for (let v = 0; v < 4; v++) {
      expect(after[v]).toBeGreaterThanOrEqual(-1e-6);
      expect(Math.hypot(turned[v * 3], turned[v * 3 + 1], turned[v * 3 + 2])).toBeCloseTo(1, 5);
      if (before[v] >= 0) for (let k = 0; k < 3; k++) expect(turned[v * 3 + k]).toBe(kit[v * 3 + k]);
      else expect(after[v]).toBeCloseTo(-before[v], 5);
    }
  });
});

describe('a kit pruned of some kinds, with no GLB to hand', () => {
  const part = (vertices: number, layer = 0, seed = 0) => ({
    role: layer > 0 ? ('leaves' as const) : ('stone' as const),
    layer,
    positions: new Float32Array(vertices * 3).map((_, i) => ((i + seed) % 7) - 3),
    normals: new Float32Array(vertices * 3).map((_, i) => ((i + seed) % 3 === 2 ? 1 : 0)),
    uvs: new Float32Array(vertices * 2).map((_, i) => (i + seed) / 100),
    indices: new Uint32Array(6).map((_, i) => (i + seed) % vertices),
  });
  // a tree on the last mask, a bush on the second, a pebble on none, and the first mask used by nobody: as the real kit's
  // twisted tree's is, so a mask that is unused but not trailing must be kept, for it fixes the layers after it
  const packed = pack([
    { name: 'Pebble_a', kind: 'pebble', parts: [part(5, 0, 1)] },
    { name: 'Tree_a', kind: 'tree', parts: [part(7, 0, 2), part(9, 3, 3)] },
    { name: 'Bush_a', kind: 'bush', parts: [part(11, 2, 4)] },
    { name: 'Tree_b', kind: 'tree', parts: [part(13, 3, 5)] },
    { name: 'Pine_a', kind: 'pine', parts: [part(3, 3, 6)] },
  ]);
  const manifest = () => ({
    version: 2,
    note: 'n',
    arrays: { positions: 'float16', normals: 'float16', uvs: 'float32', indices: 'uint16' },
    maskSize: 256,
    masks: ['mask-one.png', 'mask-two.png', 'mask-three.png'],
    models: JSON.parse(JSON.stringify(packed.models)) as typeof packed.models,
  });
  const bytesOf = (bin: Uint8Array, p: (typeof packed.models)[0]['parts'][0]) => {
    const n = p.vertices;
    return [
      bin.slice(p.positionsOffset, p.positionsOffset + n * 6),
      bin.slice(p.normalsOffset, p.normalsOffset + n * 6),
      bin.slice(p.uvsOffset, p.uvsOffset + n * 8),
      bin.slice(p.indicesOffset, p.indicesOffset + p.indexCount * 2),
    ].map((b) => Array.from(b).join(','));
  };

  it('drops every model of the kinds named, and none of the others', () => {
    const out = prune(manifest(), packed.bin, ['tree', 'pine']);
    expect(out.manifest.models.map((m) => m.name)).toEqual(['Pebble_a', 'Bush_a']);
    expect(out.dropped.models.sort()).toEqual(['Pine_a', 'Tree_a', 'Tree_b']);
  });

  it('keeps each kept part’s bytes exactly, in the order they were, with every offset on a four-byte boundary', () => {
    const out = prune(manifest(), packed.bin, ['tree', 'pine']);
    const was = new Map(packed.models.map((m) => [m.name, m]));
    for (const m of out.manifest.models)
      m.parts.forEach((p, i) => {
        expect(bytesOf(out.bin, p), m.name).toEqual(bytesOf(packed.bin, was.get(m.name)!.parts[i]));
        for (const at of [p.positionsOffset, p.normalsOffset, p.uvsOffset, p.indicesOffset]) expect(at % 4).toBe(0);
      });
    expect(out.bin.length % 4).toBe(0);
  });

  it('packs the buffer tight: the survivors’ bytes and no more, so what was dropped is gone from it', () => {
    const out = prune(manifest(), packed.bin, ['tree', 'pine']);
    const kept = packed.models.filter((m) => ['Pebble_a', 'Bush_a'].includes(m.name)).reduce((n, m) => n + m.bytes, 0);
    expect(out.bin.length).toBe(kept);
    expect(out.manifest.models.map((m) => m.bytes)).toEqual(
      packed.models.filter((m) => ['Pebble_a', 'Bush_a'].includes(m.name)).map((m) => m.bytes),
    );
    expect(out.bin.length).toBeLessThan(packed.bin.length);
  });

  it('drops a trailing mask nobody uses now, and keeps one that is unused but in the middle, so no layer moves', () => {
    const out = prune(manifest(), packed.bin, ['tree', 'pine']);
    expect(out.manifest.masks).toEqual(['mask-one.png', 'mask-two.png']);
    expect(out.dropped.masks).toEqual(['mask-three.png']);
    expect(out.manifest.models.find((m) => m.name === 'Bush_a')!.parts[0].layer).toBe(2);
  });

  it('keeps a mask a surviving model still wears', () => {
    const out = prune(manifest(), packed.bin, ['pine']);
    expect(out.manifest.masks).toHaveLength(3);
    expect(out.dropped.masks).toEqual([]);
  });

  it('leaves everything else of the manifest as it was, and the input alone', () => {
    const before = JSON.stringify(manifest());
    const binBefore = Array.from(packed.bin).join();
    const m = manifest();
    const out = prune(m, packed.bin, ['tree']);
    expect(JSON.stringify(m)).toBe(before);
    expect(Array.from(packed.bin).join()).toBe(binBefore);
    expect(out.manifest.version).toBe(2);
    expect(out.manifest.note).toBe('n');
    expect(out.manifest.maskSize).toBe(256);
    expect(out.manifest.arrays).toEqual(m.arrays);
  });

  it('gives the same bytes every time', () => {
    const a = prune(manifest(), packed.bin, ['tree', 'pine']);
    const b = prune(manifest(), packed.bin, ['pine', 'tree']);
    expect(Array.from(a.bin)).toEqual(Array.from(b.bin));
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it('refuses a kind the kit has no model of, a prune that would leave nothing, and a buffer too short, by name', () => {
    expect(() => prune(manifest(), packed.bin, ['tree', 'dragon'])).toThrowError(/prune-nothing.*dragon/);
    expect(() => prune(manifest(), packed.bin, [])).toThrowError(/prune-nothing/);
    expect(() => prune(manifest(), packed.bin, ['tree', 'pine', 'bush', 'pebble'])).toThrowError(/prune-empty/);
    expect(() => prune(manifest(), packed.bin.slice(0, 40), ['tree'])).toThrowError(/prune-range/);
  });
});
