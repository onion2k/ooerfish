/**
 * The look: toon shading under a sky, after ooergolf's clean toy (its
 * `LOOK.md`), lighter and more pastel, as `DESIGN.md` asks, at four times of
 * day. One place for it, so every scene and picture is drawn alike.
 *
 * Each time of day is data: its sky, its sun, how much light there is all
 * round, and how much the water glitters. The sky the water mirrors is
 * made from the same colours as the sky drawn behind it, so the reflection
 * of dusk is dusk's, and not the renderer's stock daylight.
 */
import { PAINT_DEFAULT, type PaintSet } from 'artshape-render/game/paint';
import type { GameRenderer } from 'artshape-render/game/renderer';
import type { Gpu } from 'artshape-render/gpu/context';
import { bakeEnvironment, type EnvImage, type Environment } from 'artshape-render/render/env';
import { moonLight } from './calendar';
import { MOON, SEASON_DRESSING, type Season } from './lake';
import { PALETTE, mix, type Colour } from './palette';

/**
 * ooergolf's clean toy: edges at four samples a pixel, the toon bands eased
 * over a narrow width, the shade a cool colour and not a grey, a warm rim,
 * the sky's light from above and a bounce from the grass below. Since the
 * painted edge it is a deeper, cooler shade with a dim cool fill and a
 * stronger rim, the values the experiments' best frames used (E of
 * artshape-render's `docs/specs/painted-experiments.md`, E12): a matte chalk lip needs a face dark
 * enough to stand against, and the old fill lit a grey to about 200 of 255.
 */
export const TOY = {
  antialias: 'msaa',
  bandSoftness: 0.06,
  shadeColour: [0.13, 0.19, 0.34] as Colour,
  rim: 0.4,
  rimColour: [1, 0.95, 0.85] as Colour,
  rimWidth: 0.18,
  skyLight: [0.2, 0.25, 0.42] as Colour,
  groundLight: [0.15, 0.17, 0.13] as Colour,
  // the package holds form to three, as it does for ooergolf, which asks for four: what is asked is kept
  form: 4,
  shadowSoftness: 1.5,
  waterShadow: true,
} as const;

/**
 * The corners' shade: the renderer's screen-space occlusion at a heavy hand, over twelve units, tinted fully toward the
 * shade colour and taken by the direct light by a quarter, so the creases under the rocks, the cabin and the trees go
 * deep and cool and not grey. The page's economy has the pass on, as the package's full economy does.
 */
export const OCCLUSION = {
  occlusion: 4,
  occlusionRadius: 12,
  occlusionTint: 1,
  occlusionDirect: 0.25,
} as const;

/** The painted edge's three sets, which a mesh names by its `set`: the boulders' chalk, the timber's lip and the cliff's. */
export const ROCK_PAINT: Required<PaintSet> = { ...PAINT_DEFAULT, lightColour: PALETTE.chalk };
/** The cliff's wall reads from further off, so a bolder stroke from lower folds, in a cooler chalk. */
export const CLIFF_PAINT: Required<PaintSet> = {
  ...ROCK_PAINT,
  widthFacet: 0.06,
  gate: 0.45,
  lightColour: PALETTE.chalkCool,
};
/** Timber's lip is faint and warm, with none of the rock's marks: a hand's flat brush on a rock, not on a board. */
export const WOOD_PAINT: Required<PaintSet> = {
  ...PAINT_DEFAULT,
  lightColour: PALETTE.chalkWarm,
  light: 0.5,
  widthFacet: 0.05,
  gate: 0.5,
  markValue: 0,
  markEnd: 0,
  markHue: 0,
};
export const PAINT: Required<PaintSet>[] = [ROCK_PAINT, WOOD_PAINT, CLIFF_PAINT];

/**
 * The sets the look carries: `PAINT` with the paint on, and with it off every set's `light` and `dark` at nought, so the
 * meshes stay painted and the build draws them plain, which lets the picture and the viewer compare in place.
 */
export function paintFor(paint: 'on' | 'off', sets: Required<PaintSet>[] = PAINT): Required<PaintSet>[] {
  return paint === 'on' ? sets : sets.map((set) => ({ ...set, light: 0, dark: 0 }));
}

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
  /** How much see-through water glitters: the renderer's glitter is the sun's hue at its full, the moon's too. */
  glitter: number;
}

export const TIMES: readonly TimeOfDay[] = [
  {
    name: 'night',
    exposure: 0.42,
    at: 0,
    zenith: PALETTE.nightZenith,
    horizon: PALETTE.nightHorizon,
    // about 25 degrees above the horizon, on the bearing it always had, so the moon is in the shore view's frame
    // (it was 59 degrees, over the angler's head); the moonlit shadow and the toon bands move with it, once, meant
    sun: [-0.5438, 0.725, 0.4226],
    sunColour: PALETTE.moonlight,
    ambient: 0.25,
    glitter: 0.12,
  },
  {
    name: 'dawn',
    exposure: 0.9,
    at: 0.25,
    zenith: PALETTE.dawnZenith,
    horizon: PALETTE.dawnHorizon,
    // low ahead of the angler, north over the lake, so the sun lies in a lane across the water (docs/crystal-2.md)
    sun: [0.45, 0.8, 0.35],
    sunColour: PALETTE.dawnlight,
    ambient: 0.75,
    glitter: 0.6,
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
    glitter: 1,
  },
  {
    name: 'dusk',
    exposure: 0.8,
    at: 0.75,
    zenith: PALETTE.duskZenith,
    horizon: PALETTE.duskHorizon,
    // low ahead of the angler, north over the lake, as dawn's is, mirrored to the west
    sun: [-0.45, 0.8, 0.3],
    sunColour: PALETTE.dusklight,
    ambient: 0.65,
    glitter: 0.5,
  },
];

/** The lists made, by season and then by phase: looked up each frame, so no key is built to find one. */
const made = new Map<Season, (readonly TimeOfDay[] | undefined)[]>();

/**
 * The four times of a season at a phase of the moon: `TIMES` with each look's zenith, horizon and sun colour mixed
 * toward the season's tint and its fill scaled, then the night's ambient, moonlight, zenith, horizon and glitter
 * scaled by `moonLight(phase)` (the tint mixes first, then the phase scales). Exposure is not scaled, since the fish's
 * glow is added before it and must read brighter against a darker night; the sky and ground light follow the ambient
 * through `lookFor`. Dawn, day and dusk are the same at every phase, and the full moon (the default) in summer is
 * `TIMES` itself. Memoised by season and phase: the same pair is the same list of the same objects.
 */
export function timesFor(season: Season, phase: number = MOON.full): readonly TimeOfDay[] {
  let phases = made.get(season);
  if (!phases) made.set(season, (phases = []));
  let list = phases[phase];
  if (!list) {
    const { sky, ambient } = SEASON_DRESSING[season];
    const k = moonLight(phase);
    list =
      sky.mix === 0 && ambient === 1 && k === 1
        ? TIMES
        : TIMES.map((t) => {
            const seasonal = {
              ...t,
              zenith: mix(t.zenith, sky.tint, sky.mix),
              horizon: mix(t.horizon, sky.tint, sky.mix),
              sunColour: mix(t.sunColour, sky.tint, sky.mix * 0.5),
              ambient: t.ambient * ambient,
            };
            if (t.name !== 'night' || k === 1) return seasonal;
            const dim = (c: Colour): Colour => mix([0, 0, 0], c, k);
            return {
              ...seasonal,
              zenith: dim(seasonal.zenith),
              horizon: dim(seasonal.horizon),
              sunColour: dim(seasonal.sunColour),
              ambient: seasonal.ambient * k,
              glitter: seasonal.glitter * k,
            };
          });
    phases[phase] = list;
  }
  return list;
}

/** The time of that name in a list of times (summer's by default); one not known is refused, and the day is given in its place. */
export function timeNamed(name: string, times: readonly TimeOfDay[] = TIMES): TimeOfDay {
  return times.find((t) => t.name === name) ?? times[2];
}

/** The time of day nearest a point in the day, round the clock, in a list of times (summer's by default). */
export function nearestTime(at: number, times: readonly TimeOfDay[] = TIMES): TimeOfDay {
  const gap = (t: TimeOfDay) => {
    const d = Math.abs(at - t.at) % 1;
    return Math.min(d, 1 - d);
  };
  return times.reduce((best, t) => (gap(t) < gap(best) ? t : best));
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

/** The environments baked so far, one a season and time of day (`summer:dawn`): four to a season, made the first time each is drawn. */
const baked = new Map<string, Environment>();

/**
 * What the look sets on the renderer at a time of day: the sun, the exposure, the toon shading with its shade, rim and
 * corners, the fill scaled by the time's `ambient` (the shade and the occlusion are the same at every time), and the
 * paint sets. A function of its arguments, so a test can read what the renderer is handed without a renderer.
 */
export function lookFor(time: TimeOfDay, paint: 'on' | 'off' = 'on') {
  return {
    sunDir: time.sun,
    // toon light is at a colour's full strength, so the sun is bright and the colours are shown straight
    sunColour: time.sunColour,
    exposure: time.exposure,
    ambient: time.ambient,
    background: time.horizon,
    sky: { zenith: time.zenith, horizon: time.horizon, height: 0.25 },
    shading: 'toon' as const,
    ...TOY,
    ...OCCLUSION,
    skyLight: mix([0, 0, 0], TOY.skyLight, time.ambient),
    groundLight: mix([0, 0, 0], TOY.groundLight, time.ambient),
    paint: paintFor(paint),
  };
}

/** The environment of a time of day, baked the first time it is asked for (8 to 12 ms) and kept. */
function environment(ctx: Gpu, time: TimeOfDay, season: Season): Environment {
  const key = `${season}:${time.name}`;
  let env = baked.get(key);
  if (!env) {
    env = bakeEnvironment(ctx, 'daylight', { size: 128, mips: 6, image: skyImage(time) });
    baked.set(key, env);
  }
  return env;
}

/**
 * Every time of day's environment baked now, in a season, so that the light stepping in play is a uniform write and no
 * hitch: the page does it for the first season right after its first frame is up and not before, to keep it off the
 * boot figure, and for a new season at its wake, in the cabin.
 */
export function bakeLooks(ctx: Gpu, season: Season = 'summer'): void {
  for (const t of timesFor(season)) environment(ctx, t, season);
}

/** How many looks have their environment baked: nought before the first look, four once a season's all are, and four more for each season after. */
export function looksBaked(): number {
  return baked.size;
}

/**
 * Put the look on `renderer` at a time of day, and resolve once the pipelines it asks for are compiled. The look
 * itself is set before the first wait, so a caller that does not wait has it for the next frame.
 */
export async function light(
  renderer: GameRenderer,
  ctx: Gpu,
  time: TimeOfDay,
  paint: 'on' | 'off' = 'on',
  season: Season = 'summer',
): Promise<void> {
  renderer.look = { ...renderer.look, ...lookFor(time, paint) };
  renderer.post = { ...renderer.post, vignette: 0, grain: 0, tone: 'soft' };
  const env = environment(ctx, time, season);
  renderer.setEnvironment(env.specular, env.brdf, env.mips);
  await renderer.prepare();
}
