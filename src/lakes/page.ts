/**
 * The lakes page's words (`docs/lakes.md`): for each lake its name, whether the player is there, how much of its glow
 * is left said in words, and the button that goes to it. A pure function of the lakes and the save, so it is tested
 * without a page, and the page writes what it says each time it opens and not on a frame.
 */
import type { Lake } from './lake';

/** A lake's name with its article, whichever way the lake keeps it: "Duck Pond" is "the Duck Pond", and "the Reservoir" is already so. */
export function theLake(name: string): string {
  return /^the\s/i.test(name) ? name : `the ${name}`;
}

/** The same at the start of a sentence: "The Duck Pond", "The Reservoir". */
export function TheLake(name: string): string {
  const the = theLake(name);
  return the[0].toUpperCase() + the.slice(1);
}

/** What is said on the lake the player is at. */
export const YOU_ARE_HERE = 'You are here';

/**
 * Where the four bands of the glow left (a share from one, as sick as a lake starts, to nought, clean) end: clean is
 * nought and nothing more; nearly clean is up to a quarter left, which is every fish cured with the drums still on the
 * bed in the pond; half cleaned up to under two thirds left, and above that the lake is glowing still.
 */
export const GLOW_BANDS = { nearly: 0.25, half: 0.65 } as const;

/** The glow left as words: one of four. */
export function glowWords(glow: number): string {
  if (glow <= 0) return 'clean';
  if (glow <= GLOW_BANDS.nearly) return 'nearly clean';
  if (glow <= GLOW_BANDS.half) return 'half cleaned';
  return 'glowing';
}

/** What the page needs of the save: the cures and the drums of each lake. */
export interface LakesSaved {
  lakes: Readonly<Record<string, { cured: number; drums: number }>>;
}

export interface LakeRow {
  id: string;
  name: string;
  /** Whether the player is at this lake. */
  here: boolean;
  /** The glow left, in words: clean, nearly clean, half cleaned or glowing. */
  glow: string;
  /** The button's words, or none for the lake the player stands at, at that lake. */
  button: string | null;
  /** What the button is for a reader who hears it alone. */
  label: string | null;
  /** Go to another lake, or go out to the one the player is at, from the cabin; none where there is nothing to press. */
  action: 'go' | 'out' | null;
  /** Whether the button can be pressed: a journey is refused with a fish on the line. */
  enabled: boolean;
}

/**
 * The page's rows, one a lake in the order given. `current` is the id of the lake the player is at. From the cabin the
 * current lake's button is the morning's, "Out to the <lake>"; at the pond it has none, since the player is there.
 * With a fish `fighting` the buttons that would leave are held off, as the game would refuse them.
 */
export function lakesWords(
  lakes: readonly Lake[],
  save: LakesSaved,
  current: string,
  { inCabin = false, fighting = false }: { inCabin?: boolean; fighting?: boolean } = {},
): LakeRow[] {
  return lakes.map((lake): LakeRow => {
    const entry = save.lakes[lake.id] ?? { cured: 0, drums: 0 };
    const glow = glowWords(lake.contaminationAfter(entry.cured, entry.drums));
    const here = lake.id === current;
    if (!here)
      return {
        id: lake.id,
        name: lake.name,
        here,
        glow,
        button: 'Go',
        label: `Go to ${theLake(lake.name)}`,
        action: 'go',
        enabled: !fighting,
      };
    if (inCabin) {
      const button = `Out to ${theLake(lake.name)}`;
      return { id: lake.id, name: lake.name, here, glow, button, label: button, action: 'out', enabled: true };
    }
    return { id: lake.id, name: lake.name, here, glow, button: null, label: null, action: null, enabled: false };
  });
}
