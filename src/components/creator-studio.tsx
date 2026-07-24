"use client";

import { useState } from "react";
import { ChatCircleDots, CheckCircle, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { useCopilotReadable, useFrontendTool } from "@copilotkit/react-core";
import type { JobStage, PlacementMode } from "@/types";

export type CreatorAdjustment = {
  instruction: string;
  target: string;
  property: "brightness" | "contrast" | "color" | "position" | "scale" | "opacity" | "other";
  direction: "increase" | "decrease" | "change";
  amount: number;
  source: "creator-chat" | "copilot-action";
};

type CreatorStudioProps = {
  jobId: string;
  stage: JobStage;
  campaign: string;
  placementMode?: PlacementMode;
  disabled: boolean;
  busy: boolean;
  onAdjustment: (adjustment: CreatorAdjustment) => Promise<void>;
};

type StudioMessage = { role: "creator" | "copilot"; text: string };

const suggestions = [
  "Make the logo a little darker",
  "Move the placement slightly left",
  "Reduce the product size by 10%",
];

function parseAdjustment(instruction: string, source: CreatorAdjustment["source"]): CreatorAdjustment {
  const normalized = instruction.toLowerCase();
  const property: CreatorAdjustment["property"] = normalized.includes("dark") || normalized.includes("bright")
    ? "brightness"
    : normalized.includes("contrast")
      ? "contrast"
      : normalized.includes("color") || normalized.includes("warmer") || normalized.includes("cooler")
        ? "color"
        : normalized.includes("move") || normalized.includes("left") || normalized.includes("right")
          ? "position"
          : normalized.includes("size") || normalized.includes("larger") || normalized.includes("smaller")
            ? "scale"
            : normalized.includes("transparent") || normalized.includes("opacity")
              ? "opacity"
              : "other";
  const direction: CreatorAdjustment["direction"] = normalized.includes("dark") || normalized.includes("reduce") || normalized.includes("smaller") || normalized.includes("less")
    ? "decrease"
    : normalized.includes("bright") || normalized.includes("increase") || normalized.includes("larger") || normalized.includes("more")
      ? "increase"
      : "change";
  const amountMatch = normalized.match(/(\d{1,3})\s*%/);
  const targetMatch = instruction.match(/(?:the|this)\s+([a-z0-9 -]+?)(?:\s+(?:a little|slightly|darker|brighter|larger|smaller|left|right)|$)/i);
  return {
    instruction: instruction.trim(),
    target: targetMatch?.[1]?.trim() || "selected sponsor placement",
    property,
    direction,
    amount: amountMatch ? Math.min(Number(amountMatch[1]), 100) / 100 : 0.1,
    source,
  };
}

export function CreatorStudio({ jobId, stage, campaign, placementMode, disabled, busy, onAdjustment }: CreatorStudioProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<StudioMessage[]>([
    { role: "copilot", text: "Tell me what to change in the sponsor composite. I will turn it into a controlled rerender." },
  ]);
  const [localBusy, setLocalBusy] = useState(false);

  useCopilotReadable({
    description: "The current SceneSponsor Creator Studio render state",
    value: { jobId, stage, campaign, placementMode: placementMode ?? "unselected", canAdjust: !disabled },
  });

  useFrontendTool({
    name: "adjustSponsorComposite",
    description: "Update the rendered sponsor placement after the creator requests a visual change.",
    parameters: [
      { name: "instruction", type: "string", description: "The creator's exact requested visual change", required: true },
      { name: "target", type: "string", description: "The logo, product, creative, or placement to update", required: true },
      { name: "property", type: "string", description: "The compositing property to update", required: true },
      { name: "direction", type: "string", description: "Whether to increase, decrease, or change the property", required: true },
      { name: "amount", type: "number", description: "Normalized adjustment strength from 0 to 1", required: true },
    ],
    handler: async ({ instruction, target, property, direction, amount }) => {
      const adjustment: CreatorAdjustment = {
        instruction,
        target,
        property: ["brightness", "contrast", "color", "position", "scale", "opacity"].includes(property) ? property as CreatorAdjustment["property"] : "other",
        direction: ["increase", "decrease"].includes(direction) ? direction as CreatorAdjustment["direction"] : "change",
        amount: Math.max(0, Math.min(Number(amount), 1)),
        source: "copilot-action",
      };
      await onAdjustment(adjustment);
      setMessages(current => [...current, { role: "copilot", text: `Rerender queued: ${instruction}` }]);
      return { queued: true, jobId, adjustment };
    },
  }, [jobId, onAdjustment]);

  const submit = async (instruction = draft) => {
    const clean = instruction.trim();
    if (!clean || disabled || busy || localBusy) return;
    const adjustment = parseAdjustment(clean, "creator-chat");
    setMessages(current => [...current, { role: "creator", text: clean }]);
    setDraft("");
    setLocalBusy(true);
    try {
      await onAdjustment(adjustment);
      setMessages(current => [...current, { role: "copilot", text: `I translated that into a ${adjustment.property} adjustment and queued a Daytona rerender.` }]);
    } catch {
      setMessages(current => [...current, { role: "copilot", text: "I could not queue that adjustment. The current render is unchanged." }]);
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <section className="creatorStudio" aria-labelledby="creator-studio-title">
      <div className="studioBrief">
        <div className="studioHeading">
          <span className="studioIcon"><ChatCircleDots weight="fill" /></span>
          <div>
            <p className="eyebrow">COPILOTKIT CREATOR STUDIO</p>
            <h2 id="creator-studio-title">Direct the final composite</h2>
          </div>
        </div>
        <p>Describe a visual adjustment in plain language. CopilotKit converts it into structured compositing parameters and resumes the render.</p>
        <dl className="studioContext">
          <div><dt>Render</dt><dd>{jobId ? jobId.slice(0, 8).toUpperCase() : "Not ready"}</dd></div>
          <div><dt>Surface</dt><dd>{placementMode ?? "Pending"}</dd></div>
          <div><dt>Pipeline</dt><dd>{disabled ? "Locked" : "Rerender ready"}</dd></div>
        </dl>
      </div>
      <div className="studioChat">
        <div className="studioMessages" aria-live="polite">
          {messages.slice(-3).map((message, index) => (
            <div className={`studioMessage ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
              <span>{message.role === "copilot" ? <Sparkle weight="fill" /> : "YOU"}</span>
              <p>{message.text}</p>
            </div>
          ))}
          {(busy || localBusy) && <div className="studioMessage copilot pending"><span><Sparkle weight="fill" /></span><p>Translating request and preparing the rerender...</p></div>}
        </div>
        <div className="studioSuggestions" aria-label="Suggested adjustments">
          {suggestions.map(suggestion => <button key={suggestion} type="button" disabled={disabled || busy || localBusy} onClick={() => void submit(suggestion)}>{suggestion}</button>)}
        </div>
        <form className="studioComposer" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <label htmlFor="creator-adjustment">Adjustment request</label>
          <div>
            <input id="creator-adjustment" value={draft} onChange={event => setDraft(event.target.value)} disabled={disabled || busy || localBusy} placeholder={disabled ? "Available after quality checks pass" : "Make the CodeRabbit logo on this bag a little darker"} />
            <button type="submit" disabled={!draft.trim() || disabled || busy || localBusy} aria-label="Queue adjustment">{localBusy ? <CheckCircle /> : <PaperPlaneTilt weight="fill" />}</button>
          </div>
        </form>
      </div>
    </section>
  );
}
