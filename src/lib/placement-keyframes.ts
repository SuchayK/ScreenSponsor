import type { NormalizedQuad, PlacementCandidate } from "@/types";

const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;

export function interpolateQuad(candidate: PlacementCandidate, timestampMs: number): NormalizedQuad | null {
  if (timestampMs < candidate.startMs || timestampMs > candidate.endMs) return null;

  const frames = candidate.keyframes?.slice().sort((a, b) => a.timestampMs - b.timestampMs);
  if (!frames?.length) return candidate.quad;
  if (frames.length === 1 || timestampMs <= frames[0].timestampMs) return frames[0].quad;
  const last = frames[frames.length - 1];
  if (timestampMs >= last.timestampMs) return last.quad;

  const beforeIndex = frames.findIndex((frame, index) =>
    index < frames.length - 1 && frame.timestampMs <= timestampMs && frames[index + 1].timestampMs >= timestampMs,
  );
  const before = frames[Math.max(0, beforeIndex)];
  const after = frames[Math.max(0, beforeIndex) + 1];
  const amount = (timestampMs - before.timestampMs) / (after.timestampMs - before.timestampMs);

  return before.quad.map((point, index) => ({
    x: lerp(point.x, after.quad[index].x, amount),
    y: lerp(point.y, after.quad[index].y, amount),
  })) as NormalizedQuad;
}

export function quadBounds(quad: NormalizedQuad) {
  const xs = quad.map(point => point.x);
  const ys = quad.map(point => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}
