/**
 * The look: toon shading under a sky, after ooergolf's clean toy (its
 * `LOOK.md`), lighter and more pastel, as `DESIGN.md` asks, at four times of
 * day. One place for it, so every scene and picture is drawn alike.
 *
 * Each time of day is data: its sky, its sun, how much light there is all
 * round, and how bright a fish's glow reads. The sky the water mirrors is
 * made from the same colours as the sky drawn behind it, so the reflection
 * of dusk is dusk's, and not the renderer's stock daylight.
 */
import type { GameRenderer } from 'artshape-render/game/renderer';
import type { Gpu } from 'artshape-render/gpu/context';
import { bakeEnvironment, type EnvImage, type Environment } from 'artshape-render/render/env';
import { PALETTE, mix, type Colour } from './palette';

/**
 * ooergolf's clean toy: edges at four samples a pixel, the toon bands eased
 * over a narrow width, the shade a cool colour and not a grey, a warm rim,
 * the sky's light from above and a bounce from the grass below.
 */
export const TOY = {
  antialias: 'msaa',
  bandSoftness: 0.06,
  shadeColour: [0.36, 0.55, 0.66] as Colour,
  rim: 0.2,
  rimColour: [1, 0.95, 0.85] as Colour,
  rimWidth: 0.18,
  skyLight: [0.55, 0.7, 0.92] as Colour,
  groundLight: [0.4, 0.45, 0.2] as Colour,
  form: 4,
  shadowSoftness: 1.5,
  waterShadow: true,
} as const;

export interface TimeOfDay {
  name: 'night' | 'dawn' | 'day' | 'dusk';
  /** Where it falls in the day, from midnight (0) to midnight (1). */
  at: number;
  zenith: Colour;
  horizon: Colour;
  /** Toward the sun (the moon, at night), and its light. */
  sun: [number, number, number];
  sunColour: Colour;
  /** The light that comes from all round, as a share of the day's. */
  ambient: number;
  /** How bright the whole picture is drawn: the toon bands are at a colour's full strength, so night is made dark here. */
  exposure: number;
  /** How bright a fish's glow is drawn. */
  glow: number;
}

export const TIMES: readonly TimeOfDay[] = [
  {
    name: 'night',
    exposure: 0.42,
    at: 0,
    zenith: PALETTE.nightZenith,
    horizon: PALETTE.nightHorizon,
    sun: [-0.3, 0.4, 0.86],
    sunColour: PALETTE.moonlight,
    ambient: 0.25,
    glow: 2.2,
  },
  {
    name: 'dawn',
    exposure: 0.9,
    at: 0.25,
    zenith: PALETTE.dawnZenith,
    horizon: PALETTE.dawnHorizon,
    sun: [0.9, -0.25, 0.35],
    sunColour: PALETTE.dawnlight,
    ambient: 0.75,
    glow: 1.0,
  },
  {
    name: 'day',
    exposure: 0.92,
    at: 0.5,
    zenith: PALETTE.dayZenith,
    horizon: PALETTE.dayHorizon,
    sun: [0.45, -0.5, 0.74],
    sunColour: PALETTE.daylight,
    ambient: 1,
    glow: 0.6,
  },
  {
    name: 'dusk',
    exposure: 0.8,
    at: 0.75,
    zenith: PALETTE.duskZenith,
    horizon: PALETTE.duskHorizon,
    sun: [-0.9, 0.2, 0.3],
    sunColour: PALETTE.dusklight,
    ambient: 0.65,
    glow: 1.4,
  },
];

/** The time of that name; one not known is refused, and the day is given in its place. */
export function timeNamed(name: string): TimeOfDay {
  return TIMES.find((t) => t.name === name) ?? TIMES[2];
}

/** The time of day nearest a point in the day, round the clock. */
export function nearestTime(at: number): TimeOfDay {
  const gap = (t: TimeOfDay) => {
    const d = Math.abs(at - t.at) % 1;
    return Math.min(d, 1 - d);
  };
  return TIMES.reduce((best, t) => (gap(t) < gap(best) ? t : best));
}

/** How many rows the sky the water mirrors is made of: it is a soft gradient, and needs few. */
export const SKY_SIZE = 64;

/**
 * The sky the water mirrors, as an image for the renderer to bake its
 * environment from: an equirectangular gradient from the zenith's colour
 * overhead to the horizon's, with a soft glow round the sun, and below the
 * horizon the horizon's colour darkening, which the water folds up and does
 * not show. Row nought is straight up.
 */
export function skyImage(time: TimeOfDay): EnvImage {
  const width = SKY_SIZE * 2,
    height = SKY_SIZE;
  const data = new Float32Array(width * height * 4);
  const [sx, sy, sz] = time.sun;
  const sl = Math.hypot(sx, sy, sz);
  for (let row = 0; row < height; row++) {
    // how far up from the horizon, from one straight up to minus one straight down, at the middle of the row
    const up = Math.cos(((row + 0.5) / height) * Math.PI);
    for (let col = 0; col < width; col++) {
      const round = ((col + 0.5) / width) * Math.PI * 2;
      const across = Math.sqrt(Math.max(0, 1 - up * up));
      const d: [number, number, number] = [Math.cos(round) * across, Math.sin(round) * across, up];
      const toSun = Math.max(0, (d[0] * sx + d[1] * sy + d[2] * sz) / sl);
      let c: Colour =
        up >= 0
          ? mix(time.horizon, time.zenith, Math.min(1, up / 0.9) ** 0.8)
          : mix(time.horizon, PALETTE.grass, Math.min(1, -up * 3));
      c = mix(c, time.sunColour, toSun ** 24 * 0.5);
      const i = (row * width + col) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 1;
    }
  }
  return { width, height, data, scale: 1 };
}

/** The environments baked so far, one a time of day: four at the most, made the first time each is drawn. */
const baked = new Map<string, Environment>();

/** Put the look on `renderer` at a time of day, and resolve once the pipelines it asks for are compiled. */
export async function light(renderer: GameRenderer, ctx: Gpu, time: TimeOfDay): Promise<void> {
  renderer.look = {
    ...renderer.look,
    sunDir: time.sun,
    // toon light is at a colour's full strength, so the sun is bright and the colours are shown straight
    sunColour: time.sunColour,
    exposure: time.exposure,
    ambient: time.ambient,
    background: time.horizon,
    sky: { zenith: time.zenith, horizon: time.horizon, height: 0.25 },
    shading: 'toon',
    ...TOY,
    skyLight: mix([0, 0, 0], TOY.skyLight, time.ambient),
    groundLight: mix([0, 0, 0], TOY.groundLight, time.ambient),
  };
  renderer.post = { ...renderer.post, vignette: 0, grain: 0, tone: 'soft' };
  let env = baked.get(time.name);
  if (!env) {
    env = bakeEnvironment(ctx, 'daylight', { size: 128, mips: 6, image: skyImage(time) });
    baked.set(time.name, env);
  }
  renderer.setEnvironment(env.specular, env.brdf, env.mips);
  await renderer.prepare();
}
