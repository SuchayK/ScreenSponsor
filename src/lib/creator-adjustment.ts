import type { CompositeAdjustment } from "@/types";

export const DEFAULT_COMPOSITE_ADJUSTMENT = {
  brightness: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  opacity: 1,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

function amount(text: string, normal: number, strong: number) {
  return /\b(?:much|way|significantly|a lot)\b/.test(text) ? strong :
    /\b(?:slightly|a little|a bit|subtly)\b/.test(text) ? normal / 2 : normal;
}

/**
 * Parse a deliberately small creator-control vocabulary. This never executes or
 * forwards uploaded text; it only emits bounded numeric compositing parameters.
 */
export function parseCreatorAdjustment(
  instruction: string,
  current: Partial<CompositeAdjustment> = {},
): CompositeAdjustment {
  if (typeof instruction !== "string" || !instruction.trim() || instruction.length > 300) {
    throw new Error("Adjustment must be a short creator instruction.");
  }

  const text = instruction.toLowerCase().replace(/[^a-z0-9.%\s-]/g, " ").replace(/\s+/g, " ").trim();
  let brightness = current.brightness ?? DEFAULT_COMPOSITE_ADJUSTMENT.brightness;
  let scale = current.scale ?? DEFAULT_COMPOSITE_ADJUSTMENT.scale;
  let offsetX = current.offsetX ?? DEFAULT_COMPOSITE_ADJUSTMENT.offsetX;
  let offsetY = current.offsetY ?? DEFAULT_COMPOSITE_ADJUSTMENT.offsetY;
  let opacity = current.opacity ?? DEFAULT_COMPOSITE_ADJUSTMENT.opacity;
  const changed: string[] = [];

  const brightnessTarget = text.match(/\bbrightness\s+(?:to|at)\s+(\d{1,3})(?:\s*%)?/);
  if (brightnessTarget) {
    brightness = Number(brightnessTarget[1]) / 100;
    changed.push("brightness");
  } else if (/\b(?:darker|dim(?:mer)?)\b/.test(text)) {
    brightness -= amount(text, 0.12, 0.25);
    changed.push("brightness");
  } else if (/\b(?:lighter|brighter)\b/.test(text)) {
    brightness += amount(text, 0.12, 0.25);
    changed.push("brightness");
  }

  const scaleTarget = text.match(/\b(?:scale|size)\s+(?:to|at)\s+(\d{1,3})(?:\s*%)?/);
  if (scaleTarget) {
    scale = Number(scaleTarget[1]) / 100;
    changed.push("scale");
  } else if (/\b(?:bigger|larger|enlarge)\b/.test(text)) {
    scale += amount(text, 0.12, 0.25);
    changed.push("scale");
  } else if (/\b(?:smaller|shrink|reduce the size)\b/.test(text)) {
    scale -= amount(text, 0.12, 0.25);
    changed.push("scale");
  }

  const movement = amount(text, 0.035, 0.08);
  if (/\b(?:move|shift|nudge)\b[^.]{0,40}\bleft\b/.test(text)) { offsetX -= movement; changed.push("position"); }
  if (/\b(?:move|shift|nudge)\b[^.]{0,40}\bright\b/.test(text)) { offsetX += movement; changed.push("position"); }
  if (/\b(?:move|shift|nudge)\b[^.]{0,40}\b(?:up|higher)\b/.test(text)) { offsetY -= movement; changed.push("position"); }
  if (/\b(?:move|shift|nudge)\b[^.]{0,40}\b(?:down|lower)\b/.test(text)) { offsetY += movement; changed.push("position"); }

  const opacityTarget = text.match(/\bopacity\s+(?:to|at)\s+(\d{1,3})(?:\s*%)?/);
  if (opacityTarget) {
    opacity = Number(opacityTarget[1]) / 100;
    changed.push("opacity");
  } else if (/\b(?:more transparent|less opaque)\b/.test(text)) {
    opacity -= amount(text, 0.12, 0.25);
    changed.push("opacity");
  } else if (/\b(?:less transparent|more opaque)\b/.test(text)) {
    opacity += amount(text, 0.12, 0.25);
    changed.push("opacity");
  }

  if (!changed.length) {
    throw new Error("Try asking to make the placement darker, lighter, bigger, smaller, more transparent, or move it.");
  }

  return {
    brightness: round(clamp(brightness, 0.5, 1.5)),
    scale: round(clamp(scale, 0.5, 1.5)),
    offsetX: round(clamp(offsetX, -0.25, 0.25)),
    offsetY: round(clamp(offsetY, -0.25, 0.25)),
    opacity: round(clamp(opacity, 0.2, 1)),
    instruction: instruction.trim(),
    updatedAt: new Date().toISOString(),
  };
}
