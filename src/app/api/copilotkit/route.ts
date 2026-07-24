import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "CopilotKit requires FIREWORKS_API_KEY for live creator chat." },
      { status: 503 },
    );
  }

  const runtime = new CopilotRuntime();
  const serviceAdapter = new OpenAIAdapter({
    openai: new OpenAI({
      apiKey,
      baseURL: "https://api.fireworks.ai/inference/v1",
    }),
    model: process.env.FIREWORKS_VIDEO_MODEL || "accounts/fireworks/models/kimi-k2p6",
    keepSystemRole: true,
    disableParallelToolCalls: true,
  });
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(request);
}
