import type { BoxKeyframe, Placement } from "../../src/lib/placements/types";
import {
  MERGE_CENTER_DISTANCE_THRESHOLD,
  MERGE_IOU_THRESHOLD,
  MERGE_TIME_GAP_TOLERANCE_SECONDS,
} from "./config";

function boxIou(a: BoxKeyframe, b: BoxKeyframe): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const interX = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const interArea = interX * interY;

  const unionArea = a.width * a.height + b.width * b.height - interArea;
  return unionArea <= 0 ? 0 : interArea / unionArea;
}

function boxCenterDistance(a: BoxKeyframe, b: BoxKeyframe): number {
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;
  return Math.hypot(acx - bcx, acy - bcy);
}

function closestBox(boxes: BoxKeyframe[], timestamp: number): BoxKeyframe {
  return boxes.reduce((closest, box) =>
    Math.abs(box.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp) ? box : closest,
  );
}

function timeWindowsOverlap(a: Placement, b: Placement): boolean {
  return (
    a.startTime <= b.endTime + MERGE_TIME_GAP_TOLERANCE_SECONDS &&
    b.startTime <= a.endTime + MERGE_TIME_GAP_TOLERANCE_SECONDS
  );
}

function boxesSimilar(a: Placement, b: Placement): boolean {
  const midpoint = (Math.max(a.startTime, b.startTime) + Math.min(a.endTime, b.endTime)) / 2;
  const boxA = closestBox(a.boxes, midpoint);
  const boxB = closestBox(b.boxes, midpoint);
  return (
    boxIou(boxA, boxB) >= MERGE_IOU_THRESHOLD ||
    boxCenterDistance(boxA, boxB) <= MERGE_CENTER_DISTANCE_THRESHOLD
  );
}

function isSamePhysicalPlacement(a: Placement, b: Placement): boolean {
  return (
    a.category === b.category &&
    a.placementType === b.placementType &&
    timeWindowsOverlap(a, b) &&
    boxesSimilar(a, b)
  );
}

class DisjointSet {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootA] = rootB;
  }
}

function mergeCluster(placements: Placement[]): Placement {
  const primary = placements.reduce((best, p) => (p.confidence > best.confidence ? p : best));

  const boxByTimestamp = new Map<number, BoxKeyframe>();
  for (const placement of placements) {
    for (const box of placement.boxes) {
      const key = Math.round(box.timestamp * 100) / 100;
      if (!boxByTimestamp.has(key)) boxByTimestamp.set(key, box);
    }
  }
  const boxes = [...boxByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);

  const sourceChunks = [...new Set(placements.flatMap((p) => p.sourceChunks ?? []))].sort(
    (a, b) => a - b,
  );

  return {
    ...primary,
    startTime: Math.min(...placements.map((p) => p.startTime)),
    endTime: Math.max(...placements.map((p) => p.endTime)),
    boxes,
    confidence: placements.reduce((sum, p) => sum + p.confidence, 0) / placements.length,
    occlusionRisk: placements.reduce((sum, p) => sum + p.occlusionRisk, 0) / placements.length,
    overallScore: placements.reduce((sum, p) => sum + p.overallScore, 0) / placements.length,
    sourceChunks,
    reason: [...new Set(placements.map((p) => p.reason))].join(" | "),
  };
}

/** Chunks overlap, so the same physical opportunity can surface multiple times; collapse those. */
export function mergePlacements(placements: Placement[]): Placement[] {
  const sets = new DisjointSet(placements.length);

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      if (isSamePhysicalPlacement(placements[i], placements[j])) {
        sets.union(i, j);
      }
    }
  }

  const clusters = new Map<number, Placement[]>();
  placements.forEach((placement, index) => {
    const root = sets.find(index);
    const cluster = clusters.get(root) ?? [];
    cluster.push(placement);
    clusters.set(root, cluster);
  });

  return [...clusters.values()].map(mergeCluster);
}
