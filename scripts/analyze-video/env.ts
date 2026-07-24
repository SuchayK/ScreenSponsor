export class MissingApiKeyError extends Error {}

export function requireFireworksApiKey(): string {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) {
    throw new MissingApiKeyError(
      "FIREWORKS_API_KEY is not set. Add it to your environment or a local .env file (see .env.example).",
    );
  }
  return key;
}
