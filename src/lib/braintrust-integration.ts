import { initLogger, type Logger } from "braintrust";

/**
 * Result returned by the optional Braintrust adapter. `sent` is only true after
 * the synchronous Braintrust logger and its buffer have completed without an
 * error, so callers never need to invent a successful partner trace.
 */
export type BraintrustWriteResult = {
  configured: boolean;
  sent: boolean;
  traceUrl?: string;
  reason?: "not_configured" | "ingest_failed";
};

export type BraintrustStageInput = {
  jobId: string;
  stage: string;
  progress: number;
  title: string;
  detail?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type BraintrustEvaluation = {
  name: string;
  score: number;
  passed: boolean;
  detail?: string;
};

export type BraintrustDecisionInput = {
  jobId: string;
  action: "approve" | "adjust" | "reject";
  allowed: boolean;
  stage: string;
  metadata?: Record<string, unknown>;
};

let logger: Logger<false> | undefined;

function configured() {
  return Boolean(process.env.BRAINTRUST_API_KEY && process.env.BRAINTRUST_PROJECT_NAME);
}
function getLogger() {
  if (logger) return logger;
  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.BRAINTRUST_PROJECT_NAME;
  if (!apiKey || !projectName) return undefined;

  // Synchronous flushing lets the return value accurately describe whether the
  // SDK accepted the event. The adapter remains fail-open if Braintrust is down.
  logger = initLogger({ apiKey, projectName, asyncFlush: false, setCurrent: false });
  return logger;
}

function scoreKey(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function writeSpan(
  name: string,
  input: unknown,
  output: unknown,
  metadata: Record<string, unknown>,
  scores?: Record<string, number>,
): Promise<BraintrustWriteResult> {
  if (!configured()) return { configured: false, sent: false, reason: "not_configured" };

  try {
    const activeLogger = getLogger();
    if (!activeLogger) return { configured: false, sent: false, reason: "not_configured" };
    const span = activeLogger.startSpan({
      name,
      type: "task",
      event: { input, metadata: { application: "SceneSponsor", ...metadata } },
    });
    span.log({ output, ...(scores ? { scores } : {}) });
    span.end();
    await activeLogger.flush();

    let traceUrl: string | undefined;
    try {
      traceUrl = span.link();
    } catch {
      // A trace can be ingested even when the SDK cannot construct an app link.
    }
    return { configured: true, sent: true, ...(traceUrl ? { traceUrl } : {}) };
  } catch {
    // Provider telemetry must never prevent analysis, rendering, or approval.
    return { configured: true, sent: false, reason: "ingest_failed" };
  }
}

/** Record one real pipeline-stage transition in the configured Braintrust project. */
export function logBraintrustStage(input: BraintrustStageInput) {
  return writeSpan(
    `stage.${input.stage}`,
    { jobId: input.jobId, source: input.source },
    { stage: input.stage, progress: input.progress, title: input.title, detail: input.detail },
    { jobId: input.jobId, stage: input.stage, source: input.source ?? "SceneSponsor", ...input.metadata },
  );
}

/** Record the quality gate as native Braintrust scores on a single evaluation span. */
export function logBraintrustEvaluations(jobId: string, evaluations: BraintrustEvaluation[]) {
  const scores = Object.fromEntries(evaluations.map((evaluation) => [scoreKey(evaluation.name), evaluation.score]));
  const passed = evaluations.length > 0 && evaluations.every((evaluation) => evaluation.passed);
  return writeSpan(
    "quality_gate",
    { jobId, checks: evaluations.map((evaluation) => evaluation.name) },
    { passed, evaluations },
    { jobId, stage: "evaluating", checkCount: evaluations.length },
    scores,
  );
}

/** Record the creator's approval interrupt outcome for an auditable final trace. */
export function logBraintrustDecision(input: BraintrustDecisionInput) {
  return writeSpan(
    "creator_decision",
    { jobId: input.jobId, stage: input.stage },
    { action: input.action, allowed: input.allowed },
    { jobId: input.jobId, stage: input.stage, actor: "creator", ...input.metadata },
    { decision_allowed: input.allowed ? 1 : 0 },
  );
}
