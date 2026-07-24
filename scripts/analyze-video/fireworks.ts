import fs from "node:fs";
import type { ZodType } from "zod";
import { ANSWER_MARKER, FIREWORKS_ENDPOINT, FIREWORKS_MODEL, MAX_MODEL_RETRIES } from "./config";

export class FireworksApiError extends Error {}
export class ModelOutputParseError extends Error {}

type FrameRef = { timestamp: number; path: string };

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function frameToContentParts(frame: FrameRef): ContentPart[] {
  const base64 = fs.readFileSync(frame.path).toString("base64");
  return [
    { type: "text", text: `Frame at t=${frame.timestamp.toFixed(2)}s` },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Thinking models can leak chain-of-thought into the content field; strip it defensively. */
function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * This model narrates its analysis in plain prose regardless of instructions not to. Rather than
 * fight that, the prompt asks it to emit an explicit marker before the real JSON answer; if the
 * marker is present, only look at what follows it (avoids latching onto a stray "{" in the prose).
 */
function afterAnswerMarker(text: string): string {
  const markerIndex = text.lastIndexOf(ANSWER_MARKER);
  return markerIndex === -1 ? text : text.slice(markerIndex + ANSWER_MARKER.length);
}

/** Scans for every balanced top-level {...} substring, not just the first "{" found. */
function findJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const start = text.indexOf("{", searchFrom);
    if (start === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) {
      searchFrom = start + 1;
    } else {
      candidates.push(text.slice(start, end + 1));
      searchFrom = end + 1;
    }
  }

  return candidates;
}

/** Tries every candidate JSON object against the schema, preferring later ones in the text. */
function extractValidatedJson<T>(text: string, schema: ZodType<T>): T {
  const candidates = findJsonCandidates(afterAnswerMarker(text));
  if (candidates.length === 0) {
    throw new ModelOutputParseError("No JSON object found in model output");
  }

  let lastError: unknown;
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      return schema.parse(JSON.parse(candidates[i]));
    } catch (err) {
      lastError = err;
    }
  }

  throw new ModelOutputParseError(
    `Found ${candidates.length} JSON object(s) in model output but none matched the schema: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function requestCompletion(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  frames: FrameRef[],
): Promise<string> {
  const content: ContentPart[] = [
    { type: "text", text: userText },
    ...frames.flatMap(frameToContentParts),
  ];

  const response = await fetch(FIREWORKS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FIREWORKS_MODEL,
      temperature: 0.2,
      max_tokens: 10000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new FireworksApiError(`Fireworks API error ${response.status}: ${body.slice(0, 1000)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = data.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
    throw new FireworksApiError("Fireworks response did not include message content");
  }
  return rawContent;
}

export async function callFireworksForJson<T>(params: {
  apiKey: string;
  systemPrompt: string;
  userText: string;
  frames: FrameRef[];
  schema: ZodType<T>;
  maxRetries?: number;
}): Promise<T> {
  const maxRetries = params.maxRetries ?? MAX_MODEL_RETRIES;
  let lastError: unknown;
  let lastRawContent = "";
  let correction = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await requestCompletion(
        params.apiKey,
        params.systemPrompt + correction,
        params.userText,
        params.frames,
      );
      lastRawContent = raw;
      const cleaned = stripThinkingTags(raw);
      return extractValidatedJson(cleaned, params.schema);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `  model call attempt ${attempt + 1}/${maxRetries + 1} failed: ${message}\n    raw output: ${lastRawContent.slice(0, 300).replace(/\n/g, " ")}`,
      );
      correction = `\n\nIMPORTANT: Your previous response was invalid (${message}). You may reason first, but you MUST then output the line ${ANSWER_MARKER} on its own, followed immediately by nothing but the valid JSON object.`;
      if (attempt < maxRetries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Fireworks model call failed after ${maxRetries + 1} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }\nLast raw output: ${lastRawContent.slice(0, 500).replace(/\n/g, " ")}`,
  );
}
