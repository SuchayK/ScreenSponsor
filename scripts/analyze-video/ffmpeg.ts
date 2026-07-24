import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export class FfmpegNotFoundError extends Error {}
export class VideoNotFoundError extends Error {}
export class FfmpegExtractionError extends Error {}

export type FrameMeta = {
  frameIndex: number;
  timestamp: number;
  path: string;
};

export function assertFfmpegAvailable(): void {
  const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new FfmpegNotFoundError(
      "ffmpeg was not found on PATH. Install it (e.g. `brew install ffmpeg`) and try again.",
    );
  }
}

export function assertVideoExists(videoPath: string): void {
  if (!fs.existsSync(videoPath)) {
    throw new VideoNotFoundError(`Input video not found: ${videoPath}`);
  }
}

/** Extracts frames at a fixed FPS into `outDir`, returning per-frame timestamp metadata. */
export function extractFrames(
  videoPath: string,
  outDir: string,
  fps: number,
  frameWidth: number,
): FrameMeta[] {
  assertFfmpegAvailable();
  assertVideoExists(videoPath);
  fs.mkdirSync(outDir, { recursive: true });

  const pattern = path.join(outDir, "frame_%05d.jpg");
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-vf",
      `fps=${fps},scale=${frameWidth}:-2`,
      "-q:v",
      "2",
      pattern,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    throw new FfmpegExtractionError(`ffmpeg failed to extract frames: ${stderr.slice(-2000)}`);
  }

  const files = fs
    .readdirSync(outDir)
    .filter((name) => name.startsWith("frame_") && name.endsWith(".jpg"))
    .sort();

  return files.map((name, index) => ({
    frameIndex: index,
    timestamp: index / fps,
    path: path.join(outDir, name),
  }));
}

export function cleanupFrames(outDir: string): void {
  fs.rmSync(outDir, { recursive: true, force: true });
}
