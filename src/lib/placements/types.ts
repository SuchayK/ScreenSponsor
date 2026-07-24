import { z } from "zod";

const unit = z.number().min(0).max(1);

export const CategorySchema = z.enum([
  "beverage",
  "poster",
  "tote_bag",
  "shopping_bag",
]);

export const PlacementTypeSchema = z.enum(["add", "replace"]);

export const CameraMotionSchema = z.enum(["low", "medium", "high"]);

export const AnchorSchema = z.object({
  x: unit,
  y: unit,
});

export const BoxKeyframeSchema = z.object({
  timestamp: z.number().nonnegative(),
  x: unit,
  y: unit,
  width: unit,
  height: unit,
});

/** Shape the VLM is asked to produce for one candidate (we assign `id` ourselves). */
export const ModelPlacementCandidateSchema = z.object({
  category: CategorySchema,
  placementType: PlacementTypeSchema,
  targetObject: z.string().nullable().optional(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  anchorDescription: z.string(),
  anchor: AnchorSchema,
  boxes: z.array(BoxKeyframeSchema).min(1),
  confidence: unit,
  occlusionRisk: unit,
  cameraMotion: CameraMotionSchema,
  reason: z.string(),
});

export const ModelFirstPassResponseSchema = z.object({
  candidates: z.array(ModelPlacementCandidateSchema),
});

export const PlacementCandidateSchema = ModelPlacementCandidateSchema.extend({
  id: z.string(),
  sourceChunks: z.array(z.number()).optional(),
});

export const CritiqueScoresSchema = z.object({
  physicalRealism: z.number().min(0).max(100),
  temporalStability: z.number().min(0).max(100),
  visibility: z.number().min(0).max(100),
  naturalness: z.number().min(0).max(100),
  editability: z.number().min(0).max(100),
  occlusionSafety: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  verdict: z.enum(["accept", "reject"]),
  reason: z.string(),
});

export const PlacementSchema = PlacementCandidateSchema.extend({
  overallScore: z.number().min(0).max(100),
});

export const PlacementsFileSchema = z.object({
  video: z.string(),
  fpsAnalyzed: z.number(),
  generatedAt: z.string(),
  qualityThreshold: z.number(),
  placements: z.array(PlacementSchema),
});

export type Category = z.infer<typeof CategorySchema>;
export type PlacementType = z.infer<typeof PlacementTypeSchema>;
export type CameraMotion = z.infer<typeof CameraMotionSchema>;
export type BoxKeyframe = z.infer<typeof BoxKeyframeSchema>;
export type ModelPlacementCandidate = z.infer<typeof ModelPlacementCandidateSchema>;
export type PlacementCandidate = z.infer<typeof PlacementCandidateSchema>;
export type CritiqueScores = z.infer<typeof CritiqueScoresSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type PlacementsFile = z.infer<typeof PlacementsFileSchema>;
