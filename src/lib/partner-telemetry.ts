/** Optional partner adapters used by the live demo.
 *
 * Both adapters are deliberately fail-open: local/demo runs continue when a
 * partner credential is not configured. Set the corresponding endpoint and
 * token in production to send real job telemetry; no fabricated success is
 * reported to the UI.
 */
export type PartnerEvent = {
  jobId: string;
  stage: string;
  event: string;
  detail?: string;
  at?: string;
  metadata?: Record<string, unknown>;
};

async function postJson(url: string, token: string | undefined, payload: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Send an agent span to a Braintrust-compatible ingestion endpoint. */
export function traceBraintrust(event: PartnerEvent) {
  const url = process.env.BRAINTRUST_INGEST_URL;
  if (!url) return Promise.resolve(false);
  return postJson(url, process.env.BRAINTRUST_API_KEY, {
    ...event,
    source: "scenesponsor",
    type: "agent_event",
  });
}

/** Ask a Daytona-compatible service to record/execute a render workspace. */
export function reportDaytona(event: PartnerEvent) {
  const url = process.env.DAYTONA_API_URL;
  if (!url) return Promise.resolve(false);
  return postJson(`${url.replace(/\/$/, "")}/v1/workspaces/events`, process.env.DAYTONA_API_TOKEN, {
    ...event,
    project: "scenesponsor",
  });
}
