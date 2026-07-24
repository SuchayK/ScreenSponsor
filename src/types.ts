export type PlacementMode = "wall" | "counter";
export type JobStage = "uploaded" | "analyzing" | "proposing" | "critiquing" | "needs_adjustment" | "matching" | "tracking" | "rendering" | "evaluating" | "awaiting_approval" | "completed" | "rejected" | "failed";
export type Point = { x: number; y: number };
export type NormalizedQuad = [Point, Point, Point, Point];
export type PlacementKeyframe = { timestampMs: number; quad: NormalizedQuad };

export interface PlacementCandidate {
  id: string; mode: PlacementMode; quad: NormalizedQuad; startMs: number; endMs: number;
  confidence: number; rationale: string; lighting: string;
  occlusionRisk: "low" | "medium" | "high"; safety: "pass" | "review" | "reject";
  keyframes?: PlacementKeyframe[];
}
export interface EvaluationResult { id: string; name: string; score: number; passed: boolean; detail: string }
export interface AgentEvent { id: string; stage: JobStage; title: string; detail: string; at: string; source: "Fireworks" | "Daytona" | "Braintrust" | "Creator" | "SceneSponsor" }
export interface JobView {
  id: string; stage: JobStage; progress: number; candidates: PlacementCandidate[];
  selectedCandidateId: string | null; artifacts: Partial<Record<"original" | "vision" | "final" | "thumbnail", string>>;
  evaluations: EvaluationResult[]; events: AgentEvent[];
  error: { code: string; message: string; retryable: boolean } | null;
  campaign: string; approvalBlocked: boolean; providerMode: "demo" | "connected";
  sourceDurationMs?: number;
}
