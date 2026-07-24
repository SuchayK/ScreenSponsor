import type { Placement } from "./types";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type InterpolatedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Placements only carry sparse box keyframes (one per analyzed chunk frame),
 * not one per rendered video frame. Interpolate between the nearest pair so
 * playback looks smooth; swap this out for real tracking later.
 */
export function getInterpolatedBox(
  placement: Placement,
  currentTime: number,
): InterpolatedBox | null {
  if (currentTime < placement.startTime || currentTime > placement.endTime) {
    return null;
  }

  const boxes = placement.boxes;
  if (boxes.length === 0) return null;
  if (boxes.length === 1 || currentTime <= boxes[0].timestamp) {
    return boxes[0];
  }
  const last = boxes[boxes.length - 1];
  if (currentTime >= last.timestamp) return last;

  let prev = boxes[0];
  let next = last;
  for (let i = 0; i < boxes.length - 1; i++) {
    if (boxes[i].timestamp <= currentTime && boxes[i + 1].timestamp >= currentTime) {
      prev = boxes[i];
      next = boxes[i + 1];
      break;
    }
  }

  if (next.timestamp === prev.timestamp) return prev;
  const t = (currentTime - prev.timestamp) / (next.timestamp - prev.timestamp);

  return {
    x: lerp(prev.x, next.x, t),
    y: lerp(prev.y, next.y, t),
    width: lerp(prev.width, next.width, t),
    height: lerp(prev.height, next.height, t),
  };
}

export function getActivePlacements(
  placements: Placement[],
  currentTime: number,
): Array<{ placement: Placement; box: InterpolatedBox }> {
  const active: Array<{ placement: Placement; box: InterpolatedBox }> = [];
  for (const placement of placements) {
    const box = getInterpolatedBox(placement, currentTime);
    if (box) active.push({ placement, box });
  }
  return active;
}
