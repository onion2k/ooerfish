/**
 * A drag on the screen, as a cast, as ooergolf strikes: pulled back, and the cast flies the other way, as the camera
 * sees it; as hard as the drag is long against a share of the screen's shorter side, so the same drag is the same
 * cast on a phone and a desk; and nothing at all inside a small dead zone, which is how a drag is taken back. Pure.
 */

/** A full cast is a drag of this share of the screen's shorter side; one shorter than `dead` is no cast. */
export const AIM_DRAG = { full: 0.35, dead: 0.04 } as const;

/**
 * The cast a drag of (`dx`, `dy`) CSS pixels (right and down) makes, on a screen whose shorter side is `short`
 * pixels, from a camera facing `heading` round the compass; null inside the dead zone.
 */
export function aimFrom(
  dx: number,
  dy: number,
  short: number,
  heading: number,
): { angle: number; power: number } | null {
  const length = Math.hypot(dx, dy) / short;
  if (!(length >= AIM_DRAG.dead)) return null;
  // the other way from the drag: up the screen is the camera's forward, its right is the camera's right
  const forward = dy,
    right = -dx;
  const fx = Math.cos(heading),
    fy = Math.sin(heading);
  const angle = Math.atan2(fy * forward - fx * right, fx * forward + fy * right);
  return { angle, power: Math.min(1, length / AIM_DRAG.full) };
}
