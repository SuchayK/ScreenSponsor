import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { requireFireworksApiKey } from "./env";
import { assertFfmpegAvailable, assertVideoExists, cleanupFrames, extractFrames } from "./ffmpeg";
import { buildFrameChunks } from "./chunking";
import { runFirstPass } from "./firstPass";
import { runCritique } from "./secondPass";
import { mergePlacements } from "./merge";
import { mapWithConcurrency } from "./concurrency";
import {
  ANALYZE_FPS,
  ANALYZE_FRAME_WIDTH,
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  CRITIQUE_CONCURRENCY,
  FIRST_PASS_CONCURRENCY,
  QUALITY_THRESHOLD,
} from "./config";
import {
  PlacementsFileSchema,
  type Placement,
  type PlacementCandidate,
  type PlacementsFile,
} from "../../src/lib/placements/types";

function resolveVideoField(videoPath: string): string {
  const publicDir = path.join(process.cwd(), "public");
  const resolved = path.resolve(videoPath);
  if (resolved.startsWith(publicDir + path.sep)) {
    return "/" + path.relative(publicDir, resolved).split(path.sep).join("/");
  }
  return `/${path.basename(resolved)}`;
}

async function main() {
  const videoArg = process.argv[2];
  if (!videoArg) {
    console.error("Usage: npm run analyze-video -- <path-to-video>");
    process.exit(1);
  }
  const videoPath = path.resolve(process.cwd(), videoArg);

  let apiKey: string;
  try {
    apiKey = requireFireworksApiKey();
    assertFfmpegAvailable();
    assertVideoExists(videoPath);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "scenesponsor-frames-"));

  try {
    console.log("Extracting frames...");
    const frames = extractFrames(videoPath, framesDir, ANALYZE_FPS, ANALYZE_FRAME_WIDTH);
    console.log(`Generated ${frames.length} frames at ${ANALYZE_FPS} FPS\n`);

    const chunks = buildFrameChunks(frames, CHUNK_SIZE, CHUNK_OVERLAP);
    const chunkResults = await mapWithConcurrency(
      chunks,
      FIRST_PASS_CONCURRENCY,
      async (chunk, i): Promise<PlacementCandidate[]> => {
        console.log(`Analyzing chunk ${i + 1}/${chunks.length}...`);
        try {
          const candidates = await runFirstPass(apiKey, chunk, i);
          console.log(`  chunk ${i + 1}/${chunks.length} done (${candidates.length} candidate(s))`);
          return candidates;
        } catch (err) {
          console.warn(
            `  Skipping chunk ${i + 1}/${chunks.length}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return [];
        }
      },
    );
    const rawCandidates: PlacementCandidate[] = chunkResults.flat();
    console.log(`\nFound ${rawCandidates.length} raw candidates\n`);

    console.log("Critiquing candidates...");
    const critiqueResults = await mapWithConcurrency(
      rawCandidates,
      CRITIQUE_CONCURRENCY,
      async (candidate): Promise<Placement | null> => {
        try {
          return await runCritique(apiKey, candidate, frames);
        } catch (err) {
          console.warn(
            `  Skipping candidate ${candidate.id}: critique failed (${
              err instanceof Error ? err.message : String(err)
            })`,
          );
          return null;
        }
      },
    );
    const critiqued = critiqueResults.filter((p): p is Placement => p !== null);
    const passed = critiqued.filter((p) => p.overallScore >= QUALITY_THRESHOLD);
    console.log(`${passed.length} passed quality threshold (>= ${QUALITY_THRESHOLD})\n`);

    console.log("Merging overlapping placements...");
    const merged = mergePlacements(passed);
    console.log(`Final placements: ${merged.length}\n`);

    const output: PlacementsFile = PlacementsFileSchema.parse({
      video: resolveVideoField(videoPath),
      fpsAnalyzed: ANALYZE_FPS,
      generatedAt: new Date().toISOString(),
      qualityThreshold: QUALITY_THRESHOLD,
      placements: merged,
    });

    const outPath = path.join(process.cwd(), "public", "placements.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Saved:\n${outPath}`);
  } finally {
    cleanupFrames(framesDir);
  }
}

main().catch((err) => {
  console.error(`\nAnalysis failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
