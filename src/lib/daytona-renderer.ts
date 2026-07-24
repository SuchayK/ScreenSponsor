import { Daytona, type Sandbox } from "@daytonaio/sdk";

export type DaytonaRenderManifest = {
  job_id: string;
  source_url: string;
  asset_url: string;
  placement_mode: "wall" | "counter";
  quad: Array<{ x: number; y: number }>;
  start_ms: number;
  end_ms: number;
  disclosure: string;
  artifact_upload_urls?: { final?: string; result?: string };
  [key: string]: unknown;
};

export type DaytonaWorkerResult = {
  status: string;
  artifacts?: { final?: string; vision?: string; [key: string]: unknown };
  tracking?: Record<string, unknown>;
  [key: string]: unknown;
};

export type DaytonaRenderResult =
  | { configured: false; executed: false; reason: "not_configured" }
  | { configured: true; executed: false; reason: "sandbox_failed" }
  | {
      configured: true;
      executed: true;
      sandboxId: string;
      workerResult: DaytonaWorkerResult;
      finalArtifact: Buffer;
      resultManifest: Buffer;
      uploads: { final: boolean; result: boolean };
    };

const JOB_PATH = "/workspace/job.json";
const RESULT_PATH = "/workspace/result.json";
const WORKER_COMMAND = `python -m scenesponsor_worker run --job ${JOB_PATH} --result ${RESULT_PATH}`;

function configuration() {
  const apiKey = process.env.DAYTONA_API_KEY;
  const snapshot = process.env.DAYTONA_SNAPSHOT_ID;
  if (!apiKey || !snapshot) return undefined;
  return { apiKey, snapshot };
}
function isWorkerResult(value: unknown): value is DaytonaWorkerResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DaytonaWorkerResult;
  return typeof candidate.status === "string" && (!candidate.artifacts || typeof candidate.artifacts === "object");
}

function safeArtifactPath(workerResult: DaytonaWorkerResult) {
  const path = workerResult.artifacts?.final;
  if (typeof path !== "string" || !path.startsWith("/workspace/") || path.includes("..")) {
    throw new Error("Daytona worker did not return a safe final artifact path");
  }
  return path;
}

async function uploadSignedArtifact(url: string | undefined, body: Buffer, contentType: string) {
  if (!url) return false;
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Signed artifact upload failed with status ${response.status}`);
  return true;
}

/**
 * Execute the committed SceneSponsor worker in an isolated Daytona snapshot.
 * Missing credentials and provider failures are returned to the caller so it
 * can use the local FFmpeg renderer. Every created sandbox is deleted in the
 * finally block, including failures during upload or artifact download.
 */
export async function renderInDaytona(manifest: DaytonaRenderManifest): Promise<DaytonaRenderResult> {
  const config = configuration();
  if (!config) return { configured: false, executed: false, reason: "not_configured" };

  const daytona = new Daytona({
    apiKey: config.apiKey,
    ...(process.env.DAYTONA_API_URL ? { apiUrl: process.env.DAYTONA_API_URL } : {}),
    ...(process.env.DAYTONA_TARGET ? { target: process.env.DAYTONA_TARGET } : {}),
  });
  let sandbox: Sandbox | undefined;

  try {
    sandbox = await daytona.create(
      {
        snapshot: config.snapshot,
        language: "python",
        ephemeral: true,
        ttlMinutes: 10,
        labels: { application: "scenesponsor", job: manifest.job_id.slice(0, 63) },
        ...(process.env.DAYTONA_DOMAIN_ALLOW_LIST
          ? { domainAllowList: process.env.DAYTONA_DOMAIN_ALLOW_LIST }
          : {}),
      },
      { timeout: 90 },
    );

    await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(manifest)), JOB_PATH, 30);
    const execution = await sandbox.process.executeCommand(WORKER_COMMAND, "/workspace", undefined, 180);
    if (execution.exitCode !== 0) throw new Error("SceneSponsor Daytona worker exited unsuccessfully");

    const resultManifest = await sandbox.fs.downloadFile(RESULT_PATH, 30);
    const parsed: unknown = JSON.parse(resultManifest.toString("utf8"));
    if (!isWorkerResult(parsed) || parsed.status !== "ok") throw new Error("SceneSponsor Daytona worker returned an invalid result");

    const finalArtifact = await sandbox.fs.downloadFile(safeArtifactPath(parsed), 120);
    const [finalUploaded, resultUploaded] = await Promise.all([
      uploadSignedArtifact(manifest.artifact_upload_urls?.final, finalArtifact, "video/mp4"),
      uploadSignedArtifact(manifest.artifact_upload_urls?.result, resultManifest, "application/json"),
    ]);

    return {
      configured: true,
      executed: true,
      sandboxId: sandbox.id,
      workerResult: parsed,
      finalArtifact,
      resultManifest,
      uploads: { final: finalUploaded, result: resultUploaded },
    };
  } catch {
    return { configured: true, executed: false, reason: "sandbox_failed" };
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox, 60, true);
      } catch {
        // The 10-minute TTL remains a second cleanup guarantee if deletion fails.
      }
    }
    try {
      await daytona[Symbol.asyncDispose]();
    } catch {
      // Closing SDK telemetry must not hide the render result.
    }
  }
}
