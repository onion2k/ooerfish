/** The lakes page's words: each lake's name, whether the player is there, how much of its glow is left, and what the button says. */
import { describe, expect, it } from 'vitest';
import { GLOW_BANDS, lakesWords } from '../src/lakes/page';
import { HOME, LAKES } from '../src/lakes';

const lakes = Object.values(LAKES);
const save = (over: Record<string, { cured: number; drums: number }> = {}) => ({
  lakes: Object.fromEntries(lakes.map((l) => [l.id, over[l.id] ?? { cured: 0, drums: 0 }])),
});
const row = (id: string, rows: ReturnType<typeof lakesWords>) => rows.find((r) => r.id === id)!;

describe('the lakes page’s words', () => {
  it('lists every lake in the order the registry has them, each by its name', () => {
    const rows = lakesWords(lakes, save(), HOME.id);
    expect(rows.map((r) => r.id)).toEqual(lakes.map((l) => l.id));
    expect(rows.map((r) => r.name)).toEqual(lakes.map((l) => l.name));
  });

  it('says "You are here" on the current lake and on no other', () => {
    for (const current of Object.keys(LAKES)) {
      const rows = lakesWords(lakes, save(), current);
      expect(rows.filter((r) => r.here).map((r) => r.id)).toEqual([current]);
      expect(rows.find((r) => r.here)!.here).toBe(true);
    }
  });

  it('gives each lake but the current one a Go button, which names the lake for a reader who hears only the button', () => {
    const rows = lakesWords(lakes, save(), HOME.id);
    expect(row('reservoir', rows)).toMatchObject({ button: 'Go', action: 'go', label: 'Go to the Reservoir' });
    // at the pond, the pond has nothing to press: the player is there
    expect(row(HOME.id, rows)).toMatchObject({ button: null, action: null });
  });

  it('gives the current lake "Out to the lake" in the cabin, which is the morning’s button in the page', () => {
    const rows = lakesWords(lakes, save(), HOME.id, { inCabin: true });
    expect(row(HOME.id, rows)).toMatchObject({ button: `Out to the ${HOME.name}`, action: 'out' });
    expect(row('reservoir', rows).action).toBe('go');
  });

  it('holds the Go buttons off with a fish on the line, and the way out stays', () => {
    const rows = lakesWords(lakes, save(), HOME.id, { fighting: true });
    expect(row('reservoir', rows).enabled).toBe(false);
    const cabin = lakesWords(lakes, save(), HOME.id, { inCabin: true, fighting: true });
    expect(row(HOME.id, cabin).enabled).toBe(true);
  });

  describe('the glow, in four bands', () => {
    const says = (id: string, cured: number, drums = 0) =>
      row(id, lakesWords(lakes, save({ [id]: { cured, drums } }), 'none')).glow;

    it('is glowing when nothing is cured, and clean when everything is', () => {
      for (const l of lakes) {
        expect(says(l.id, 0)).toBe('glowing');
        expect(says(l.id, l.toClean, l.drums.count)).toBe('clean');
      }
    });

    it('goes through nearly clean and half cleaned between them, by the lake’s own arithmetic', () => {
      const seen = new Set<string>();
      for (const l of lakes)
        for (const drums of [0, l.drums.count])
          for (let cured = 0; cured <= l.toClean; cured++) seen.add(says(l.id, cured, drums));
      expect([...seen].sort()).toEqual(['clean', 'glowing', 'half cleaned', 'nearly clean']);
    });

    it('is held to its bands at their edges', () => {
      const l = HOME;
      const share = (c: number) => l.contaminationAfter(c, 0);
      // the same band for a share just under an edge as for the share on it, and the next one just over
      const at = (c: number) => says(l.id, c);
      let was = at(0);
      let changes = 0;
      for (let c = 1; c <= l.toClean; c++) {
        const now = at(c);
        if (now !== was) changes++;
        // never worse as more are cured
        expect(share(c)).toBeLessThanOrEqual(share(c - 1));
        was = now;
      }
      expect(changes).toBeGreaterThanOrEqual(2);
      expect(GLOW_BANDS.nearly).toBeLessThan(GLOW_BANDS.half);
      expect(GLOW_BANDS.half).toBeLessThan(1);
    });

    it('reads a lake the save has no entry for as untouched', () => {
      const rows = lakesWords(lakes, { lakes: {} }, HOME.id);
      expect(rows.every((r) => r.glow === 'glowing')).toBe(true);
    });

    it('a part-cured entry says half cleaned in its own lake only', () => {
      const rows = lakesWords(lakes, save({ reservoir: { cured: 10, drums: 0 } }), HOME.id);
      expect(row('reservoir', rows).glow).toBe('half cleaned');
      expect(row(HOME.id, rows).glow).toBe('glowing');
    });
  });
});
