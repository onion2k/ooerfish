/**
 * The game's side of the scenery file: half-precision numbers read back, and a part turned into a mesh. The file
 * is written by `scripts/kitting.ts` and read by `src/scenery.ts`, which may not share code across the build and
 * run line (the page cannot import a node script), so what the two agree on is held here, by packing a part and
 * unpacking it. A reader out by one exponent bias or one index width puts every tree somewhere else.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeHalf, pack, ROLES, type PackedPart } from '../scripts/kitting';
import { float16ToFloat32, KINDS, loadScenery, readKit, readManifest, SCENERY_ROLES, unpackPart } from '../src/scenery';

describe('a half read back', () => {
  it('is the value its bits stand for, for every pattern that is a number', () => {
    for (let bits = 0; bits < 65536; bits++) {
      if (((bits >> 10) & 31) === 31) continue;
      expect(encodeHalf(float16ToFloat32(bits))).toBe(bits === 0x8000 ? 0x8000 : bits);
    }
  });

  it('knows the landmarks', () => {
    expect(float16ToFloat32(0x3c00)).toBe(1);
    expect(float16ToFloat32(0xc000)).toBe(-2);
    expect(float16ToFloat32(0x7bff)).toBe(65504);
    expect(float16ToFloat32(0x0001)).toBe(2 ** -24);
    expect(float16ToFloat32(0x0400)).toBe(2 ** -14);
    expect(Object.is(float16ToFloat32(0x8000), -0)).toBe(true);
  });
});

/** The packed bytes in a buffer of their own, less `cut` from the end. */
const buffer = (bin: Uint8Array, cut = 0): ArrayBuffer => {
  const out = new Uint8Array(bin.length - cut);
  out.set(bin.subarray(0, out.length));
  return out.buffer;
};

const sample = (vertices: number): PackedPart => {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const positions = new Float32Array(vertices * 3).map(() => (next() - 0.5) * 8);
  positions[0] = 0;
  positions[1] = 1e-5;
  const normals = new Float32Array(vertices * 3);
  for (let v = 0; v < vertices; v++) {
    const x = next() - 0.5;
    const y = next() - 0.5;
    const z = next() - 0.2;
    const l = Math.hypot(x, y, z);
    normals.set([x / l, y / l, z / l], v * 3);
  }
  const uvs = new Float32Array(vertices * 2).map(() => next());
  const indices = new Uint32Array(Array.from({ length: 12 }, (_, i) => (i * 7) % vertices));
  return { role: 'stone', layer: 0, positions, normals, uvs, indices };
};

describe('a packed part unpacked', () => {
  for (const vertices of [5, 64, 65535]) {
    it(`comes back as a mesh to within half precision (${vertices} vertices)`, () => {
      const original = sample(vertices);
      const { bin, models } = pack([
        { name: 'pad', kind: 'k', parts: [sample(3)] },
        { name: 'm', kind: 'k', parts: [original] },
      ]);
      const bytes = buffer(bin);
      const mesh = unpackPart(models[1].parts[0], bytes);
      expect(mesh.positions).toBeInstanceOf(Float32Array);
      expect(mesh.indices).toBeInstanceOf(Uint32Array);
      expect(mesh.positions).toHaveLength(vertices * 3);
      for (let i = 0; i < mesh.positions.length; i++)
        expect(Math.abs(mesh.positions[i] - original.positions[i])).toBeLessThanOrEqual(
          Math.max(Math.abs(original.positions[i]) * 2 ** -11, 2 ** -25),
        );
      for (let v = 0; v < vertices; v += Math.ceil(vertices / 500)) {
        const [x, y, z] = [mesh.normals[v * 3], mesh.normals[v * 3 + 1], mesh.normals[v * 3 + 2]];
        expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(1e-3);
      }
      expect(Array.from(mesh.uvs)).toEqual(Array.from(original.uvs));
      expect(Array.from(mesh.indices)).toEqual(Array.from(original.indices));
    });
  }

  it('refuses an entry that reaches past the buffer, by name', () => {
    const { bin, models } = pack([{ name: 'm', kind: 'k', parts: [sample(5)] }]);
    const bytes = buffer(bin, 4);
    expect(() => unpackPart(models[0].parts[0], bytes)).toThrowError(/scenery-out-of-range/);
  });

  it('refuses an entry whose array is not four-byte aligned, by name', () => {
    const { bin, models } = pack([{ name: 'm', kind: 'k', parts: [sample(5)] }]);
    const bytes = buffer(bin);
    expect(() =>
      unpackPart({ ...models[0].parts[0], uvsOffset: models[0].parts[0].uvsOffset + 2 }, bytes),
    ).toThrowError(/scenery-misaligned/);
  });
});

const DIR = 'public/scenery/';
/** The manifest as loose JSON, so a case can break it any way it likes. */
interface Loose {
  version?: unknown;
  maskSize: unknown;
  masks: unknown;
  arrays: Record<string, unknown>;
  models: { name: unknown; kind: unknown; parts: Record<string, unknown>[] }[];
}
const realJson = (): Loose => JSON.parse(readFileSync(DIR + 'scenery.json', 'utf8')) as Loose;
const maskNames = (): string[] => realJson().masks as string[];
const sources = (): { models: { name: string; kind: string }[] } =>
  JSON.parse(readFileSync('scripts/kit-sources.json', 'utf8')) as { models: { name: string; kind: string }[] };
const realBin = (): ArrayBuffer => {
  const b = readFileSync(DIR + 'scenery.bin');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe('the manifest read', () => {
  it('accepts the one the converter wrote', () => {
    const m = readManifest(realJson());
    expect(m.models).toHaveLength(23);
    expect(m.masks).toHaveLength(4);
  });

  /** Each case alters a copy of the real manifest and says what the refusal must name. */
  const cases: [string, (m: Loose) => void, RegExp][] = [
    ['a missing version', (m) => delete m.version, /scenery-version/],
    ['an unknown version', (m) => (m.version = 3), /scenery-version/],
    ['other array types', (m) => (m.arrays.positions = 'float32'), /scenery-arrays/],
    ['an extra array', (m) => (m.arrays.colours = 'uint8'), /scenery-arrays/],
    ['an unknown role', (m) => (m.models[0].parts[0].role = 'moss'), /scenery-role.*moss/],
    ['a model of a kind pruned away, the kit’s tree', (m) => (m.models[0].kind = 'tree'), /scenery-kind.*tree/],
    ['a layer past the masks', (m) => (m.models[0].parts[0].layer = 6), /scenery-layer/],
    ['a negative layer', (m) => (m.models[0].parts[0].layer = -1), /scenery-layer/],
    ['a mask size not a power of two', (m) => (m.maskSize = 300), /scenery-mask-size/],
    ['a mask size over 1024', (m) => (m.maskSize = 2048), /scenery-mask-size/],
    ['a negative count', (m) => (m.models[0].parts[0].vertices = -3), /scenery-count/],
    ['a fractional count', (m) => (m.models[0].parts[0].indexCount = 2.5), /scenery-count/],
    ['a negative offset', (m) => (m.models[0].parts[0].normalsOffset = -4), /scenery-offset/],
    ['a fractional offset', (m) => (m.models[0].parts[0].uvsOffset = 1.5), /scenery-offset/],
    ['a repeated model name', (m) => (m.models[1].name = m.models[0].name), /scenery-duplicate/],
    ['an unknown kind', (m) => (m.models[0].kind = 'dragon'), /scenery-kind.*dragon/],
    ['masks that are not a list', (m) => (m.masks = 'x'), /scenery-masks/],
  ];
  for (const [name, alter, message] of cases) {
    it(`refuses ${name}, by name`, () => {
      const m = realJson();
      alter(m);
      expect(() => readManifest(m)).toThrowError(message);
    });
  }

  it('refuses what is not an object', () => {
    expect(() => readManifest(null)).toThrowError(/scenery-manifest/);
    expect(() => readManifest('x')).toThrowError(/scenery-manifest/);
  });

  it('knows the roles and kinds the converter writes', () => {
    expect(new Set(SCENERY_ROLES)).toEqual(new Set(Object.values(ROLES)));
    const listed = sources().models;
    expect(new Set(KINDS)).toEqual(new Set(listed.map((m) => m.kind)));
  });
});

describe('the kit read', () => {
  it('holds all 23 models, in range, named as the sources name them', () => {
    const kit = readKit(readManifest(realJson()), realBin());
    const names = [...kit.models.keys()];
    const listed = sources().models;
    expect(names.sort()).toEqual(listed.map((m) => m.name).sort());
    expect(names).toHaveLength(23);
    let triangles = 0;
    for (const model of kit.models.values()) {
      triangles += model.triangles;
      for (const part of model.parts) {
        const vertices = part.mesh.positions.length / 3;
        expect(part.mesh.normals.length).toBe(vertices * 3);
        expect(part.mesh.uvs.length).toBe(vertices * 2);
        for (const i of part.mesh.indices) expect(i).toBeLessThan(vertices);
        expect(part.layer).toBeLessThanOrEqual(kit.maskFiles.length);
        if (['leaves', 'pine', 'flowers'].includes(part.role)) expect(part.layer).toBeGreaterThanOrEqual(1);
      }
    }
    expect(triangles).toBe(9519);
    expect(kit.maskFiles).toEqual(maskNames());
  });

  it('refuses an index out of range, by name', () => {
    const m = readManifest(realJson());
    const bin = realBin();
    const part = m.models[0].parts[0];
    new DataView(bin).setUint16(part.indicesOffset, part.vertices, true);
    expect(() => readKit(m, bin)).toThrowError(/scenery-index/);
  });

  it('refuses an offset past the bin, by name', () => {
    expect(() => readKit(readManifest(realJson()), realBin().slice(0, 1000))).toThrowError(/scenery-out-of-range/);
  });

  // The renderer turns a card's normal over on its back face, so a card whose normals face away from it is lit from
  // behind and catches the rim light: the kit's own leaf normals did, and a canopy went cream at night.
  it("gives every card normals on its own face's side", () => {
    const kit = readKit(readManifest(realJson()), realBin());
    for (const [name, model] of kit.models)
      for (const part of model.parts.filter((p) => p.layer > 0)) {
        const { positions: p, normals: n, indices } = part.mesh;
        let sum = 0,
          away = 0;
        for (let t = 0; t < indices.length; t += 3) {
          const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
          const e = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]);
          const f = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
          const face = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
          const length = Math.hypot(face[0], face[1], face[2]) || 1;
          for (const v of [a, b, c]) {
            const dot = (n[v * 3] * face[0] + n[v * 3 + 1] * face[1] + n[v * 3 + 2] * face[2]) / length;
            sum += dot;
            if (dot < 0) away++;
          }
        }
        // A corner shared across a sharp fold takes the mean of its faces and can lean past one of them: five of a
        // flower group's do. The kit's own leaf normals had two corners in three facing away; a hundredth is the line.
        expect(away / indices.length, `${name} ${part.role}: share of corners facing away`).toBeLessThanOrEqual(0.01);
        expect(sum / indices.length, `${name} ${part.role}: mean against its faces`).toBeGreaterThan(0.8);
      }
  });
});

describe('the scenery loaded', () => {
  const files = ['scenery.json', 'scenery.bin', ...maskNames()];
  const serve = (broken?: string) => {
    const asked: string[] = [];
    const fetcher = (url: string): Promise<Response> => {
      asked.push(url);
      const name = url.slice('/s/'.length);
      if (name === broken) return Promise.resolve(new Response('no', { status: 404 }));
      return Promise.resolve(new Response(new Uint8Array(readFileSync(DIR + name))));
    };
    return { asked, fetcher };
  };
  const decode = (blob: Blob) => Promise.resolve({ size: blob.size } as unknown as ImageBitmap);

  it('returns the kit and the masks in layer order, fetching each file once', async () => {
    const { asked, fetcher } = serve();
    const { kit, masks } = await loadScenery(fetcher, '/s/', decode);
    expect(kit.models.size).toBe(23);
    expect(masks).toHaveLength(4);
    expect([...asked].sort()).toEqual(files.map((f: string) => '/s/' + f).sort());
    masks.forEach((mask, i) =>
      expect((mask as unknown as { size: number }).size).toBe(readFileSync(DIR + kit.maskFiles[i]).length),
    );
  });

  for (const file of files) {
    it(`refuses a 404 for ${file}, naming its URL`, async () => {
      await expect(loadScenery(serve(file).fetcher, '/s/', decode)).rejects.toThrowError(
        new RegExp(`scenery-fetch.*/s/${file.replace('.', '\\.')}`),
      );
    });
  }
});
