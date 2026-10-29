/**
 * The photograph (`docs/photo.md`): a record of figures, not pixels, from which the page draws the lake again. What is
 * in frame, and the words of a row of the album, are pure sums here, tested without a page; `Game` keeps the album.
 */
import { WEATHER_NAMES } from './calendar';
import { PHOTOS, type Weather } from './lake';
import type { Lake } from './lakes/lake';
import { theLake } from './lakes/page';

/** The orbit's target and spherical coordinates when the picture was taken, which is all of a camera the page needs. */
export interface PhotoView {
  x: number;
  y: number;
  z: number;
  azimuth: number;
  polar: number;
  radius: number;
}

/** One photograph of the album: where, when and in what weather it was taken, from where, and what was in frame. */
export interface Photo {
  /** The id of the lake it was taken at. */
  lake: string;
  /** The day it was taken on, and the clock's fraction of that day. */
  day: number;
  time: number;
  weather: Weather;
  view: PhotoView;
  /** The ids of the kinds of fish in frame, each once, in slot order. */
  kinds: string[];
  /** True when the clock's look was night, which is when an eel lights the water. */
  lit: boolean;
}

/**
 * Whether the point (x, y, z) is in frame: in front of the camera, inside the clip box (depth in [0, 1], as WebGPU
 * clips it) and within `reach` of the camera's `eye`, so a speck across the lake does not count. `viewProjection` is
 * the camera's, column-major.
 */
export function inFrame(
  viewProjection: Float32Array,
  eye: readonly [number, number, number],
  x: number,
  y: number,
  z: number,
  reach: number,
): boolean {
  const m = viewProjection;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!(w > 0)) return false;
  const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    nz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  if (Math.abs(nx) > 1 || Math.abs(ny) > 1 || nz < 0 || nz > 1) return false;
  return Math.hypot(x - eye[0], y - eye[1], z - eye[2]) <= reach;
}

/** "a pike", "an eel": the article a name takes. */
const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

/** "a X", "a X and a Y", "a X, a Y and a Z"; "nothing in particular" with none. */
function kindsOf(ids: readonly string[], kinds: readonly { id: string; name: string }[]): string {
  const said = ids.map((id) => withArticle((kinds.find((k) => k.id === id)?.name ?? id).toLowerCase()));
  if (said.length === 0) return 'nothing in particular';
  if (said.length === 1) return said[0];
  return `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}`;
}

/** The lake's name as a photograph says it: the lake's own, or its id for one the game no longer has. */
function lakeOf(id: string, lakes: Readonly<Record<string, Lake>>): string {
  const lake = lakes[id] as Lake | undefined;
  return lake ? theLake(lake.name) : id;
}

/**
 * A row of the album in words: "Day 3, morning at the Reservoir, in rain: a pink dawn fish and a pike." Nothing is said
 * of sunny weather, and a photograph of no fish is of "nothing in particular". `hourName` names the hour from the clock.
 */
export function photoWords(
  photo: Photo,
  lakes: Readonly<Record<string, Lake>>,
  kinds: readonly { id: string; name: string }[],
  hourName: (time: number) => string,
): string {
  const weather = WEATHER_NAMES[photo.weather];
  const wet = weather === undefined ? '' : photo.weather === 'shower' ? ', in a sun-shower' : `, in ${weather}`;
  return `Day ${photo.day}, ${hourName(photo.time)} at ${lakeOf(photo.lake, lakes)}${wet}: ${kindsOf(photo.kinds, kinds)}.`;
}

/** The viewfinder's line for a photograph about to be taken, or one looked at: "Day 3, morning, the Reservoir". */
export function photoLine(
  photo: Pick<Photo, 'lake' | 'day' | 'time'>,
  lakes: Readonly<Record<string, Lake>>,
  hourName: (time: number) => string,
): string {
  return `Day ${photo.day}, ${hourName(photo.time)}, ${lakeOf(photo.lake, lakes)}`;
}

/** One row of the journal's album: its place in the album, its words, and whether Look is offered for it. */
export interface AlbumRow {
  index: number;
  /** The row's words; at another lake than the page's they end by saying where it was taken, in place of a Look button. */
  words: string;
  /** Whether the photograph was taken at the lake the page is at, which is the only place it can be looked at. */
  here: boolean;
}

/** The journal's section "Photographs": a row each in the order taken, and the count out of the album's twelve. */
export interface AlbumWords {
  title: string;
  rows: AlbumRow[];
  count: string;
}

/**
 * The album as the journal lists it. A photograph is looked at only where it was taken, since the lake is drawn again
 * from what is there, so `hereId` (the lake the page is at) decides which rows offer Look; the rest say where they were
 * taken, so the player knows why there is no button.
 */
export function albumWords(
  photos: readonly Photo[],
  lakes: Readonly<Record<string, Lake>>,
  hereId: string,
  kinds: readonly { id: string; name: string }[],
  hourName: (time: number) => string,
): AlbumWords {
  return {
    title: 'Photographs',
    rows: photos.map((photo, index): AlbumRow => {
      const here = photo.lake === hereId;
      const words = photoWords(photo, lakes, kinds, hourName);
      return { index, words: here ? words : `${words} Taken at ${lakeOf(photo.lake, lakes)}.`, here };
    }),
    count: `photographs: ${photos.length} of ${PHOTOS.most}`,
  };
}
