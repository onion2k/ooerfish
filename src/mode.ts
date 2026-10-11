/**
 * The page's mode: look, where a drag turns the camera in every view, and cast, where the camera is held at the shore
 * and a drag back aims a cast. The rules for moving between them are here, pure, so they are tested without a page;
 * the page does what the answer says. Without them the camera could be left turned away from the angler while a drag
 * cast, or a view picked on the panel could leave the page in a mode that holds the camera still.
 */

export type Mode = 'look' | 'cast';

/**
 * What happens to the mode: the button or the key (`toggle`), the mode asked for by name (`cast`, `look`), and a view
 * picked on the panel (`view`).
 */
export type ModeEvent = 'toggle' | 'cast' | 'look' | 'view';

/** The mode that follows, and what the camera does: `shore` is put at the Shore view, `keep` is left where it is. */
export interface ModeStep {
  mode: Mode;
  camera: 'shore' | 'keep';
}

/** The mode after an event. Cast always stands at the shore; a view picked is a wish to look, and the view moves the camera itself. */
export function nextMode(mode: Mode, event: ModeEvent): ModeStep {
  const to: Mode = event === 'toggle' ? (mode === 'look' ? 'cast' : 'look') : event === 'cast' ? 'cast' : 'look';
  return { mode: to, camera: to === 'cast' ? 'shore' : 'keep' };
}

/** Whether a drag turns the camera: it does in look, and in cast it aims instead. */
export const orbits = (mode: Mode): boolean => mode === 'look';

/** What the button says it will do next, and what the hint says a drag does now. */
export function wording(mode: Mode): { button: string; hint: string } {
  return mode === 'look'
    ? { button: 'Cast', hint: 'drag to look round, wheel to zoom, C to cast' }
    : { button: 'Look round', hint: 'drag back to cast, tap to strike, hold to reel, C to look round' };
}
