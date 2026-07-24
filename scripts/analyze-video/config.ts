export const FIREWORKS_MODEL = "accounts/fireworks/models/kimi-k2p6";
export const FIREWORKS_ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";

export const ANALYZE_FPS = 4;
/** Vision models tokenize images roughly proportional to pixel count; frames only need to be
 * large enough to localize objects, not read fine detail, so downscale before sending. */
export const ANALYZE_FRAME_WIDTH = Number(process.env.PLACEMENT_FRAME_WIDTH ?? 640);
export const CHUNK_SIZE = 16;
export const CHUNK_OVERLAP = 4;
export const CRITIQUE_FRAME_SAMPLE = 6;
export const MAX_MODEL_RETRIES = 3;
export const ANSWER_MARKER = "###ANSWER_JSON###";

export const FIRST_PASS_CONCURRENCY = Number(process.env.PLACEMENT_FIRST_PASS_CONCURRENCY ?? 4);
export const CRITIQUE_CONCURRENCY = Number(process.env.PLACEMENT_CRITIQUE_CONCURRENCY ?? 4);

export const QUALITY_THRESHOLD = Number(process.env.PLACEMENT_QUALITY_THRESHOLD ?? 80);

export const MERGE_TIME_GAP_TOLERANCE_SECONDS = 1;
export const MERGE_IOU_THRESHOLD = 0.25;
export const MERGE_CENTER_DISTANCE_THRESHOLD = 0.12;
