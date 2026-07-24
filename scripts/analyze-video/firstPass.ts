import crypto from "node:crypto";
import type { FrameMeta } from "./ffmpeg";
import { callFireworksForJson } from "./fireworks";
import { ModelFirstPassResponseSchema, type PlacementCandidate } from "../../src/lib/placements/types";
import { FIRST_PASS_SYSTEM_PROMPT } from "./prompts";

export async function runFirstPass(
  apiKey: string,
  chunk: FrameMeta[],
  chunkIndex: number,
): Promise<PlacementCandidate[]> {
  const userText = `These are ${chunk.length} sequential frames from a vertical creator video, spanning t=${chunk[0].timestamp.toFixed(2)}s to t=${chunk[chunk.length - 1].timestamp.toFixed(2)}s. Identify plausible product-placement opportunities.`;

  const result = await callFireworksForJson({
    apiKey,
    systemPrompt: FIRST_PASS_SYSTEM_PROMPT,
    userText,
    frames: chunk,
    schema: ModelFirstPassResponseSchema,
  });

  return result.candidates.map((candidate, index) => ({
    ...candidate,
    id: `chunk${chunkIndex}-${index}-${crypto.randomUUID().slice(0, 8)}`,
    sourceChunks: [chunkIndex],
    boxes: [...candidate.boxes].sort((a, b) => a.timestamp - b.timestamp),
  }));
}
