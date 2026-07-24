import type { EvaluationResult, JobStage, PlacementCandidate } from "@/types";

const transitions: Record<JobStage, JobStage[]> = {
  uploaded: ["analyzing", "failed"], analyzing: ["proposing", "failed"], proposing: ["critiquing", "failed"],
  critiquing: ["needs_adjustment", "matching", "failed"], needs_adjustment: ["tracking", "rejected"],
  matching: ["tracking", "failed"], tracking: ["rendering", "failed"], rendering: ["evaluating", "failed"],
  evaluating: ["awaiting_approval", "failed"], awaiting_approval: ["completed", "tracking", "rejected"],
  completed: [], rejected: [], failed: ["analyzing"]
};

export function canTransition(from: JobStage, to: JobStage) { return transitions[from].includes(to); }
export function rankCandidate(c: PlacementCandidate) {
  const context = c.safety === "pass" ? 1 : c.safety === "review" ? 0.45 : 0;
  const geometry = c.quad.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) ? c.confidence : 0;
  const stability = c.occlusionRisk === "low" ? 1 : c.occlusionRisk === "medium" ? 0.55 : 0.1;
  return context * .35 + geometry * .25 + stability * .2 + context * .2;
}
export function qualityGate(evals: EvaluationResult[]) {
  return evals.length >= 6 && evals.every(e => e.passed) && (evals.find(e => e.name === "Brand safety")?.score ?? 0) === 1 && (evals.find(e => e.name === "Context relevance")?.score ?? 0) >= .75;
}
