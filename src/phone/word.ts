/**
 * The phone's large word: what the next gesture will do, from the phase of the bite and of the lure. Pure, and handed
 * the phases and not the game, so a test says every pair. Without it the phone would show a fight's bar and leave its
 * owner guessing whether a tap now strikes, reels or casts.
 */
import type { BitePhase } from '../bite';
import type { LurePhase } from '../lure';
import type { Word } from './protocol';

/**
 * The fish comes first, since a hooked lure is in its mouth and a landed one is back on the rod: a strike is asked for
 * while the window is open, a reel while the fish is on, the catch to be put away once it is landed. Otherwise the
 * rod is raised to cast when the lure is ready or lying on the bank, and the phone says nothing while the lure is in
 * the air or sinking and waiting, since there is nothing to do but wait.
 */
export function phoneWord(bite: BitePhase, lure: LurePhase): Word {
  if (bite === 'biting') return 'Strike!';
  if (bite === 'hooked') return 'Reel';
  if (bite === 'landed') return 'Tap the catch';
  if (lure === 'ready' || lure === 'lying') return 'Cast';
  return '';
}
