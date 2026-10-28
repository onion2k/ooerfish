/** `Game.answer`: the requests the save meets, marked once, kept, and told only when they happen in play. */
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { KINDS } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { HOME } from '../src/lakes';

const pike = KINDS.findIndex((k) => k.id === 'pike');

/** A game with a pike landed and waiting by the rod, weighing `kg`, and the answers it tells. */
function landed(kg: number, json: string | null = null) {
  const told: string[] = [];
  const store = memoryStore(json);
  const game = new Game(new Progress(store), { random: seeded(1), events: { answered: (id) => told.push(id) } });
  const i = [...game.fish.kind].findIndex((k, n) => k === pike && !game.fish.cured[n]);
  game.bite.phase = 'landed';
  game.bite.fish = i;
  game.fish.held = i;
  game.lure.phase = 'hooked';
  game.catchWeight = kg;
  return { game, store, told };
}

describe('answering the requests', () => {
  it('marks the biggest once on the stow that meets it, saves it and tells it', () => {
    const { game, store, told } = landed(3.5);
    expect(game.progress.save.requests).toEqual([]);
    game.stow();
    expect(game.progress.save.requests).toEqual(['biggest']);
    expect(told).toEqual(['biggest']);
    expect((JSON.parse(store.json!) as { requests: string[] }).requests).toEqual(['biggest']);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('does not answer a pike under the weight, and adds nothing on a second stow', () => {
    const light = landed(3.4);
    light.game.stow();
    expect(light.game.progress.save.requests).toEqual([]);
    expect(light.told).toEqual([]);

    const { game, told } = landed(3.6);
    game.stow();
    const j = [...game.fish.kind].findIndex((k, n) => k === pike && !game.fish.cured[n]);
    game.bite.phase = 'landed';
    game.bite.fish = j;
    game.fish.held = j;
    game.lure.phase = 'hooked';
    game.catchWeight = 4;
    game.stow();
    expect(game.progress.save.requests).toEqual(['biggest']);
    expect(told).toEqual(['biggest']);
  });

  it('answers the ducks on the haul that cleans the pond, in the order of the requests', () => {
    const told: string[] = [];
    const json = JSON.stringify({
      cured: HOME.toClean,
      drums: HOME.drums.count - 1,
      journal: { pike: { caught: 1, best: 4, first: 1 } },
    });
    const game = new Game(new Progress(memoryStore(json)), {
      random: seeded(1),
      events: { answered: (id) => told.push(id) },
    });
    // the load marked the biggest, silently; the haul brings the ducks
    expect(game.progress.save.requests).toEqual(['biggest']);
    expect(told).toEqual([]);
    game.bite.phase = 'landed';
    game.bite.drum = HOME.drums.count - 1;
    game.lure.phase = 'hooked';
    game.haul();
    expect(game.progress.save.requests).toEqual(['biggest', 'ducks']);
    expect(told).toEqual(['ducks']);
  });

  it('marks what a load already meets, silently, and writes nothing at the load', () => {
    const told: string[] = [];
    const store = memoryStore(JSON.stringify({ cured: 2, journal: { pike: { caught: 1, best: 3.8, first: 1 } } }));
    const before = store.json;
    const game = new Game(new Progress(store), { random: seeded(1), events: { answered: (id) => told.push(id) } });
    expect(game.progress.save.requests).toEqual(['biggest']);
    expect(told).toEqual([]);
    expect(store.json, 'loading alone must not write').toBe(before);
  });

  it('never removes an answered request', () => {
    const { game } = landed(3.5);
    game.stow();
    game.progress.entry(HOME.id).journal = {};
    game.answer(true);
    expect(game.progress.save.requests).toEqual(['biggest']);
  });
});
