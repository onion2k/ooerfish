/**
 * The page's mode: look, where a drag turns the camera in every view; cast, where the camera is held at the shore
 * and a drag back aims a cast; and row (`docs/boat.md`, C2), where a drag looks round as in look and a tap on the water
 * rows the boat there and a tap on the bank lands. The rules for moving between them are here, pure, so they are
 * tested without a page; the page does what the answer says. Without them the camera could be left turned away from the
 * angler while a drag cast, or a view picked on the panel could leave the page in a mode that holds the camera still.
 */

export type Mode = 'look' | 'cast' | 'row';

/**
 * What happens to the mode: the Cast button or the key (`toggle`), the Row button or its key (`row`), the mode asked for
 * by name (`cast`, `look`), a view picked on the panel (`view`), and a row or a landing begun by a tap (`done`).
 */
export type ModeEvent = 'toggle' | 'cast' | 'look' | 'view' | 'row' | 'done';

/** The mode that follows, and what the camera does: `shore` is put at the Shore view, `keep` is left where it is. */
export interface ModeStep {
  mode: Mode;
  camera: 'shore' | 'keep';
}

/**
 * The mode after an event. Cast always stands at the shore (from the boat's seat, aboard); a view picked is a wish to
 * look, and the view moves the camera itself; the Row button toggles look and row, and takes cast to row; the Cast
 * button leaves row for cast.
 */
export function nextMode(mode: Mode, event: ModeEvent): ModeStep {
  let to: Mode = 'look';
  switch (event) {
    case 'toggle':
      to = mode === 'look' ? 'cast' : mode === 'cast' ? 'look' : 'cast';
      break;
    case 'cast':
      to = 'cast';
      break;
    case 'row':
      to = mode === 'row' ? 'look' : 'row';
      break;
    case 'look':
    case 'view':
    case 'done':
      to = 'look';
      break;
  }
  return { mode: to, camera: to === 'cast' ? 'shore' : 'keep' };
}

/** Whether a drag turns the camera: it does in look and in row, and in cast it aims instead. */
export const orbits = (mode: Mode): boolean => mode !== 'cast';

/** What the Cast button says it will do next, and what the hint says a drag or a tap does now. */
export function wording(mode: Mode): { button: string; hint: string } {
  if (mode === 'row') return { button: 'Cast', hint: 'tap the water to row there, tap the bank to land' };
  return mode === 'look'
    ? { button: 'Cast', hint: 'drag to look round, wheel to zoom, C to cast' }
    : { button: 'Look round', hint: 'drag back to cast, tap to strike, hold to reel, C to look round' };
}

/** The hint under the greyed Cast button while the lure is snagged (`docs/boat.md`, C4): the line is held until it is freed. */
export const SNAGGED_HINT = 'snagged: hold to tug, let go to free it';

/** The Anchor button's words: what it does next, so "Weigh anchor" while the anchor is down (`docs/boat.md`, C3). */
export function anchorWording(anchored: boolean): string {
  return anchored ? 'Weigh anchor' : 'Drop anchor';
}

/** What the Row button says it will do next: Row in look and cast, and Look round when row mode is on. */
export function rowWording(mode: Mode): { button: string } {
  return { button: mode === 'row' ? 'Look round' : 'Row' };
}

/** The Prop button's words (`docs/boat.md`, C5): what it does next, so "Take the rod" while the rod is propped. */
export function propWording(propped: boolean): string {
  return propped ? 'Take the rod' : 'Prop the rod';
}
