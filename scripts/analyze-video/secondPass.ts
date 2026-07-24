import type { FrameMeta } from "./ffmpeg";
import { callFireworksForJson } from "./fireworks";
import {
  CritiqueScoresSchema,
  type Placement,
  type PlacementCandidate,
} from "../../src/lib/placements/types";
import { CRITIQUE_SYSTEM_PROMPT } from "./prompts";
import { CRITIQUE_FRAME_SAMPLE } from "./config";

function sampleFramesInRange(
  frames: FrameMeta[],
  startTime: number,
  endTime: number,
  count: number,
): FrameMeta[] {
  const inRange = frames.filter((f) => f.timestamp >= startTime && f.timestamp <= endTime);
  const pool = inRange.length > 0 ? inRange : frames;
  if (pool.length <= count) return pool;

  const sampled: FrameMeta[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (pool.length - 1)) / (count - 1));
    sampled.push(pool[idx]);
  }
  return sampled;
}

export async function runCritique(
  apiKey: string,
  candidate: PlacementCandidate,
  allFrames: FrameMeta[],
): Promise<Placement> {
  const frames = sampleFramesInRange(
    allFrames,
    candidate.startTime,
    candidate.endTime,
    CRITIQUE_FRAME_SAMPLE,
  );

  const userText = `Proposed placement candidate (JSON):\n${JSON.stringify(candidate, null, 2)}\n\nReview the attached frames, which cover this candidate's time window, and score it.`;

  const scores = await callFireworksForJson({
    apiKey,
    systemPrompt: CRITIQUE_SYSTEM_PROMPT,
    userText,
    frames,
    schema: CritiqueScoresSchema,
  });

  return {
    ...candidate,
    overallScore: scores.overallScore,
  };
}
