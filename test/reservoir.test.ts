/**
 * The Reservoir (`docs/lakes.md`, part 5): the second lake's content held to its figures: its shape, its dam, its
 * boulders, fish, drums and cure arithmetic, and that the scene and the game build and play from it with the cliff,
 * jetty and cabin all gone.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAINT_STRIDE } from 'artshape-render/mesh/paint';
import { Angler } from '../src/angler';
import { places } from '../src/bedfinds';
import { damMesh } from '../src/dam';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { KINDS } from '../src/lake';
import { DUCK_POND } from '../src/lakes/duckpond';
import { LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DRUM_RULES } from '../src/rules';
import { Scene, sceneryFigures } from '../src/scene';
import { SCENERY_ROLES, readKit, readManifest, type Kit } from '../src/scenery';
import { surface } from '../src/water/surface';
import { DT } from './helpers';

const R = RESERVOIR;
const kit: Kit = readKit(
  readManifest(JSON.parse(readFileSync('public/scenery/scenery.json', 'utf8'))),
  (() => {
    const b = readFileSync('public/scenery/scenery.bin');
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  })(),
);
void SCENERY_ROLES;

/** The most triangles the Reservoir's scene may draw: the pond's figure and the dam, the bigger surface and the bigger bed. */
const TRIANGLE_CEILING = 400_000;
/** The most triangles the Reservoir's water surface may take: the pond's 60,000 and a half as much again for a lake half as big again. */
const SURFACE_CEILING = 90_000;

describe('the Reservoir as a Lake', () => {
  it('is named, registered, and not the home', () => {
    expect(R.id).toBe('reservoir');
    expect(R.name).toBe('the Reservoir');
    expect(LAKES.reservoir).toBe(R);
    expect(R).not.toBe(DUCK_POND);
  });

  it('has no cliff, jetty or cabin, and a dam in their place', () => {
    expect(R.cliff).toBeNull();
    expect(R.jetty).toBeNull();
    expect(R.cabin).toBeNull();
    expect(R.dam).toBeTruthy();
  });

  it('is in the water in the middle and not past the shore, at sixty-four angles', () => {
    expect(R.inside(0, 0)).toBe(true);
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const r = R.shoreRadius(angle);
      const at = (k: number): [number, number] => [Math.cos(angle) * r * k * R.stretch, Math.sin(angle) * r * k];
      expect(R.inside(...at(0.9)), `angle ${i}`).toBe(R.boulderGap(...at(0.9)) > 0);
      expect(R.inShore(...at(0.9)), `angle ${i}`).toBe(true);
      expect(R.inside(...at(1.05)), `angle ${i}`).toBe(false);
      expect(R.inShore(...at(1.05)), `angle ${i}`).toBe(false);
    }
  });

  it('is about one and six tenths the pond across, and a half as deep again', () => {
    const across = (lake: typeof R) => 2 * lake.shoreRadius(0) * lake.stretch;
    // east to west, where the dam does not cut it
    expect(across(R) / across(DUCK_POND)).toBeGreaterThan(1.4);
    expect(across(R) / across(DUCK_POND)).toBeLessThan(1.8);
    expect(R.maxDepth / DUCK_POND.maxDepth).toBeCloseTo(1.5, 5);
  });

  it('is deepest near the middle, about one and a half times the pond’s deepest', () => {
    let deepest = 0;
    for (let x = -10; x <= 10; x += 2) for (let y = -10; y <= 10; y += 2) deepest = Math.max(deepest, R.bedDepth(x, y));
    expect(deepest).toBeGreaterThan(R.maxDepth * 0.9);
    expect(deepest / DUCK_POND.maxDepth).toBeGreaterThan(1.35);
    expect(deepest / DUCK_POND.maxDepth).toBeLessThan(1.55);
    for (const [x, y] of [
      [30, 0],
      [-40, -20],
      [0, -40],
    ])
      expect(R.bedDepth(x, y)).toBeLessThan(deepest);
  });

  it('shelves to nothing at the shore and is nought on land', () => {
    expect(R.bedDepth(0, -R.shoreRadius(-Math.PI / 2))).toBeCloseTo(0, 5);
    expect(R.bedDepth(0, R.shoreRadius(Math.PI / 2) + 5)).toBe(0);
    expect(R.bedDepth(200, 0)).toBe(0);
  });
});

describe('the Reservoir’s boulders', () => {
  it('are two, inside the water, clear of the shore and apart', () => {
    expect(R.boulders).toHaveLength(2);
    expect(R.domes).toHaveLength(2);
    for (const b of R.boulders) {
      expect(R.inShore(b.x, b.y, b.radius + 1)).toBe(true);
      expect(R.bedDepth(b.x, b.y)).toBeGreaterThanOrEqual(0);
    }
    const [a, b] = R.boulders;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius + 10);
  });

  it('rise out of the water and shallow the bed round them, and keep the fish and casts off', () => {
    for (const b of R.boulders) {
      expect(R.ground(b.x, b.y)).toBeGreaterThan(0);
      expect(R.inside(b.x, b.y)).toBe(false);
      expect(R.boulderGap(b.x, b.y)).toBeLessThan(0);
      expect(R.nearestBoulder(b.x + 0.1, b.y)).toBe(b);
    }
  });

  it('have rocks and seeds of their own, not the pond’s', () => {
    expect(R.scenery.seeds.boulder).not.toBe(DUCK_POND.scenery.seeds.boulder);
    expect(R.scenery.seeds.scene).not.toBe(DUCK_POND.scenery.seeds.scene);
    expect(R.scenery.seeds.dressing).not.toBe(DUCK_POND.scenery.seeds.dressing);
  });
});

describe('the Reservoir’s dam', () => {
  const spec = R.dam!.spec;

  it('stands along the north: the water ends on its face, a straight line, for its whole length', () => {
    for (let x = -38; x <= 56; x += 4) {
      const angle = Math.atan2(spec.faceY, x / R.stretch);
      const r = R.shoreRadius(angle);
      const y = Math.sin(angle) * r;
      expect(y, `x ${x}`).toBeCloseTo(spec.faceY, 5);
      expect(R.inside(x, spec.faceY - 0.5)).toBe(true);
      expect(R.inside(x, spec.faceY + 0.5)).toBe(false);
    }
  });

  it('is longer than a pond’s shore is wide and well inside the oval’s ends', () => {
    expect(spec.half).toBeGreaterThan(30);
    expect(spec.half).toBeLessThan(R.radius * R.stretch);
  });

  it('has the ground rising behind its face to the walkway’s height, flat across its crest, and falling to the banks', () => {
    expect(R.groundUnder(0, spec.faceY - 1)).toBeLessThan(0.01);
    expect(R.groundUnder(0, spec.faceY + spec.setBack + spec.batter + 0.01)).toBeGreaterThan(spec.top * 0.9);
    for (const x of [-30, 0, 20, 30]) expect(R.groundUnder(x, spec.faceY + spec.crest - 0.5)).toBeCloseTo(spec.top, 1);
    const far = spec.faceY + spec.setBack + spec.crest + spec.hold + spec.fall + 1;
    expect(R.groundUnder(0, far)).toBeLessThan(R.bankTop + 0.01);
    // monotone down behind the crest, so the lawn never climbs again
    let last = Infinity;
    for (let y = spec.faceY + spec.crest; y < far; y += 1) {
      const g = R.groundUnder(0, y);
      expect(g).toBeLessThanOrEqual(last + 1e-9);
      last = g;
    }
  });

  it('steps down into the banks past its ends and is nothing beyond them', () => {
    expect(R.dam!.height(0)).toBe(1);
    expect(R.dam!.height(spec.half + spec.ends + 1)).toBe(0);
    expect(R.groundUnder(spec.half + spec.ends + 5, spec.faceY + 2)).toBeLessThan(R.bankTop + 0.01);
  });

  it('keeps the grass and the clumps off the wall and its walkway', () => {
    expect(R.onCabinOrDeck(0, spec.faceY + 1)).toBe(true);
    expect(R.onCabinOrDeck(0, spec.faceY + spec.crest + 5)).toBe(false);
    expect(R.onCabinOrDeck(0, 0)).toBe(false);
  });

  it('is a painted solid, on the cliff’s set, built the same each time and kept', () => {
    const mesh = damMesh(R)!;
    expect(mesh).toBeTruthy();
    const vertices = mesh.positions.length / 3;
    expect(mesh.paint.length).toBe(PAINT_STRIDE * vertices);
    for (let v = 0; v < vertices; v++) expect(mesh.paint[v * PAINT_STRIDE + 11]).toBe(2);
    // split: every triangle has its own vertices
    expect(vertices).toBe(mesh.indices.length);
    expect(damMesh(R)).toBe(mesh);
    const hash = (m: typeof mesh) => Array.from(m.positions).join() + '|' + Array.from(m.paint).join();
    // a lake of the same shape with a new identity builds the mesh again, equal to the first
    expect(hash(damMesh({ ...R })!)).toBe(hash(mesh));
    expect(mesh.indices.length / 3).toBeLessThan(2000);
  });

  it('stands over the ground it ends in, and stands to the walkway’s height along its length', () => {
    const mesh = damMesh(R)!;
    let highest = -Infinity;
    for (let i = 2; i < mesh.positions.length; i += 3) highest = Math.max(highest, mesh.positions[i]);
    // the hut stands on the walkway
    expect(highest).toBeCloseTo(spec.top + 0.05 + spec.hut.high, 1);
  });

  it('is not the pond’s, which has none', () => {
    expect(DUCK_POND.dam ?? null).toBeNull();
    expect(damMesh(DUCK_POND)).toBeNull();
  });
});

describe('the Reservoir’s fish', () => {
  it('are sixteen, five bream, seven perch and four pike', () => {
    expect(R.fishCount).toBe(16);
    expect(R.fishKinds).toHaveLength(16);
    const of = (k: number) => R.fishKinds.filter((f) => f === k).length;
    expect(KINDS.map((k) => k.id).slice(0, 3)).toEqual(['bream', 'perch', 'pike']);
    expect([of(0), of(1), of(2)]).toEqual([5, 7, 4]);
  });

  it('are placed in water by a game, all inside', () => {
    const game = reservoirGame();
    for (let i = 0; i < game.fish.count; i++) expect(R.inside(game.fish.x[i], game.fish.y[i])).toBe(true);
    expect(game.fish.count).toBe(16);
  });
});

describe('the Reservoir’s drums', () => {
  const spots = places(R.drums, R);

  it('are three, on the bed, in the water and apart', () => {
    expect(R.drums.count).toBe(3);
    expect(spots).toHaveLength(3);
    for (const [x, y] of spots) {
      expect(R.inside(x, y, R.drums.where.margin)).toBe(true);
      expect(R.bedDepth(x, y)).toBeGreaterThanOrEqual(R.drums.where.depth[0]);
      expect(R.bedDepth(x, y)).toBeLessThanOrEqual(R.drums.where.depth[1]);
    }
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++)
        expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThanOrEqual(
          R.drums.where.apart,
        );
  });

  it('are the same every time, and within the cast’s reach of the angler', () => {
    expect(places(R.drums, R)).toEqual(spots);
    for (const [x, y] of spots) expect(Math.hypot(x - R.from[0], y - R.from[1])).toBeLessThan(R.castReach);
  });

  it('are the only things on the bed: no treasures', () => {
    expect(R.treasures.count).toBe(0);
    expect(R.treasures.list).toHaveLength(0);
  });
});

describe('the Reservoir’s cure', () => {
  it('is sick at nought and clean once sixteen fish and three drums are in', () => {
    expect(R.contaminationAfter(0, 0)).toBe(1);
    expect(R.contaminationAfter(16, 3)).toBe(0);
    expect(R.toClean).toBe(16);
    expect(R.total).toBe(16 + 3 * DRUM_RULES.worth);
  });

  it('falls with each fish and each drum and never below nought', () => {
    expect(R.contaminationAfter(8, 0)).toBeCloseTo(1 - 8 / R.total, 10);
    expect(R.contaminationAfter(8, 1)).toBeLessThan(R.contaminationAfter(8, 0));
    expect(R.contaminationAfter(99, 99)).toBe(0);
  });
});

describe('the angler at the Reservoir', () => {
  it('stands on the south bank, clear of the water, aiming north at the middle', () => {
    expect(R.inside(R.angler.x, R.angler.y)).toBe(false);
    expect(R.angler.y).toBeLessThan(-R.shoreRadius(-Math.PI / 2));
    expect(R.aim.angle).toBeCloseTo(Math.PI / 2, 10);
    // the tip stands out in front, and the cast's power reaches the middle: the distance is about the power times the reach
    const tipY = R.angler.y + R.angler.tipReach;
    expect(Math.abs(-tipY - R.aim.power * R.castReach)).toBeLessThan(1);
    expect(R.aim.power).toBeLessThan(1);
    expect(R.landAt[1]).toBeGreaterThan(-R.shoreRadius(-Math.PI / 2));
  });

  it('has the views the page asks for, the cabin’s the home’s', () => {
    expect(Object.keys(R.views).sort()).toEqual(['boat', 'cabin', 'cabinTall', 'overhead', 'phone', 'shore']);
    expect(R.views.cabin).toBe(DUCK_POND.views.cabin);
    expect(R.views.shore.radius).toBeGreaterThan(DUCK_POND.views.shore.radius);
  });
});

describe('a scene of the Reservoir', () => {
  const scene = new Scene(R);
  const groups = scene.static(kit);

  it('builds, with the dam’s wall and no cliff, and the same each time', () => {
    expect(groups.length).toBeGreaterThan(10);
    expect(groups.some((g) => g.mesh === damMesh(R))).toBe(true);
    const again = new Scene(R).static(kit);
    expect(again.length).toBe(groups.length);
    expect(again.map((g) => g.mesh.indices.length)).toEqual(groups.map((g) => g.mesh.indices.length));
  });

  it('draws no more than its ceiling of triangles, and its water under its own', () => {
    const figures = sceneryFigures(scene.placements(kit), R);
    expect(figures.triangles).toBeLessThan(TRIANGLE_CEILING);
    expect(surface(R).indices.length / 3).toBeLessThanOrEqual(SURFACE_CEILING);
  });

  it('stands no tree or clump on the wall or its walkway, nor in the water', () => {
    const spec = R.dam!.spec;
    for (const p of scene.placements(kit)) {
      if (p.kind === 'pebble') continue;
      expect(R.inside(p.x, p.y), `${p.kind} at ${p.x},${p.y}`).toBe(false);
      if (p.kind === 'tree') {
        const onWall = Math.abs(p.x) < spec.half && p.y > spec.faceY - 0.5 && p.y < spec.faceY + spec.crest + 0.5;
        expect(onWall, `tree at ${p.x},${p.y}`).toBe(false);
      }
    }
  });

  it('keeps the pond’s scene as it was: the pond builds its own with no dam', () => {
    expect(new Scene(DUCK_POND).static(kit).some((g) => g.mesh === damMesh(R))).toBe(false);
  });
});

function reservoirGame(seed = 1, json: string | null = null) {
  return new Game(new Progress(memoryStore(json), { [R.id]: R }), { lake: R, random: seeded(seed) });
}

describe('a game at the Reservoir', () => {
  it('writes a cure to the Reservoir’s own entry and not the pond’s, with both lakes in the save', () => {
    // the save keeps an entry a lake; a fish cured here must count here, or a journey would move the pond's cure
    const game = new Game(new Progress(memoryStore(null), LAKES), { lake: R, random: seeded(4) });
    const angler = new Angler(game, seeded(11));
    const cured = () => game.progress.save.lakes[R.id].cured;
    for (let f = 0; f < 60 * 60 * 90 && cured() < 1; f++) angler.step(DT);
    expect(cured(), 'the angler cured one at the Reservoir').toBe(1);
    expect(game.progress.save.lakes[DUCK_POND.id].cured).toBe(0);
  });

  it('opens with its sixteen fish and three drums and holds the invariants over 600 frames of the angler', () => {
    const game = reservoirGame(3);
    expect(game.lake).toBe(R);
    expect(game.drums.count).toBe(3);
    const angler = new Angler(game, seeded(9));
    for (let f = 0; f < 600; f++) {
      angler.step(DT);
      expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
  });

  it('holds them over a longer random play of casts, strikes and reels', () => {
    const game = reservoirGame(5);
    const random = seeded(77);
    for (let f = 0; f < 3000; f++) {
      const u = random();
      if (u < 0.01) game.cast(Math.PI / 2 + (random() - 0.5), random());
      else if (u < 0.02) game.strike();
      else if (u < 0.03) game.reelIn();
      game.reel(random() < 0.5);
      game.step(DT);
      if (f % 20 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
  });
});
