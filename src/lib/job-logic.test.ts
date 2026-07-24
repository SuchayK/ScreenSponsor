import { describe, expect, it } from "vitest";
import { canTransition, qualityGate, rankCandidate } from "./job-logic";
import type { PlacementCandidate } from "@/types";

const candidate: PlacementCandidate = { id:"a", mode:"wall", quad:[{x:.1,y:.1},{x:.4,y:.1},{x:.4,y:.4},{x:.1,y:.4}], startMs:0,endMs:6000,confidence:.9,rationale:"stable",lighting:"soft",occlusionRisk:"low",safety:"pass" };
describe("job logic", () => {
  it("ranks safe stable candidates", () => expect(rankCandidate(candidate)).toBeGreaterThan(.9));
  it("blocks invalid state jumps", () => expect(canTransition("uploaded", "completed")).toBe(false));
  it("requires the complete quality gate", () => expect(qualityGate([
    {id:"1",name:"Geometry",score:1,passed:true,detail:"ok"},{id:"2",name:"Duration",score:1,passed:true,detail:"ok"},
    {id:"3",name:"Audio",score:1,passed:true,detail:"ok"},{id:"4",name:"Tracking",score:.9,passed:true,detail:"ok"},
    {id:"5",name:"Brand safety",score:1,passed:true,detail:"ok"},{id:"6",name:"Context relevance",score:.8,passed:true,detail:"ok"}
  ])).toBe(true));
});
