import type { FrameMeta } from "./ffmpeg";

export function buildFrameChunks(
  frames: FrameMeta[],
  chunkSize: number,
  overlap: number,
): FrameMeta[][] {
  if (frames.length === 0) return [];
  const step = Math.max(1, chunkSize - overlap);
  const chunks: FrameMeta[][] = [];

  for (let start = 0; start < frames.length; start += step) {
    const chunk = frames.slice(start, start + chunkSize);
    if (chunk.length === 0) break;
    chunks.push(chunk);
    if (start + chunkSize >= frames.length) break;
  }

  return chunks;
}
