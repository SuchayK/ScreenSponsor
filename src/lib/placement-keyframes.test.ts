import { describe, expect, it } from "vitest";
import { interpolateQuad, quadBounds } from "./placement-keyframes";
import type { NormalizedQuad, PlacementCandidate } from "@/types";

const first: NormalizedQuad = [{x:.1,y:.2},{x:.3,y:.2},{x:.3,y:.4},{x:.1,y:.4}];
const second: NormalizedQuad = [{x:.2,y:.3},{x:.4,y:.3},{x:.4,y:.5},{x:.2,y:.5}];
const candidate = { id:"tracked", mode:"wall", quad:first, startMs:0, endMs:1000, confidence:.9, rationale:"", lighting:"", occlusionRisk:"low", safety:"pass", keyframes:[{timestampMs:0,quad:first},{timestampMs:1000,quad:second}] } as PlacementCandidate;

describe("placement keyframes", () => {
  it("interpolates tracked geometry between frames", () => {
    const point=interpolateQuad(candidate,500)?.[0];
    expect(point?.x).toBeCloseTo(.15);
    expect(point?.y).toBeCloseTo(.25);
  });

  it("hides geometry outside its visible interval", () => {
    expect(interpolateQuad(candidate, 1001)).toBeNull();
  });

  it("derives normalized bounds for the vision overlay", () => {
    expect(quadBounds(second)).toEqual({left:.2,top:.3,width:.2,height:.2});
  });
});
