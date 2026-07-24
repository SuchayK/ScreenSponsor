"use client";

import { useEffect, useRef, useState } from "react";
import {
  CameraMotionSchema,
  CategorySchema,
  PlacementTypeSchema,
  type CameraMotion,
  type Category,
  type Placement,
  type PlacementType,
  type PlacementsFile,
} from "@/lib/placements/types";
import { getInterpolatedBox } from "@/lib/placements/interpolate";

type Box = { x: number; y: number; width: number; height: number };

const DEFAULT_BOX: Box = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 };
const CATEGORIES = CategorySchema.options;
const PLACEMENT_TYPES = PlacementTypeSchema.options;
const CAMERA_MOTIONS = CameraMotionSchema.options;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createPlacement(atTime: number): Placement {
  return {
    id: crypto.randomUUID(),
    category: "beverage",
    placementType: "add",
    targetObject: null,
    startTime: atTime,
    endTime: atTime,
    anchorDescription: "",
    anchor: { x: DEFAULT_BOX.x + DEFAULT_BOX.width / 2, y: DEFAULT_BOX.y + DEFAULT_BOX.height },
    boxes: [{ timestamp: atTime, ...DEFAULT_BOX }],
    confidence: 1,
    occlusionRisk: 0,
    cameraMotion: "low",
    reason: "manually placed",
    overallScore: 100,
  };
}

function draftBoxFor(placement: Placement | null, currentTime: number): Box {
  if (!placement || placement.boxes.length === 0) return DEFAULT_BOX;
  const interpolated = getInterpolatedBox(placement, currentTime);
  if (interpolated) return interpolated;
  const edge = currentTime < placement.startTime ? placement.boxes[0] : placement.boxes[placement.boxes.length - 1];
  return edge;
}

export default function EditorPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startBox: Box } | null>(null);

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [override, setOverride] = useState<Box | null>(null);
  const [syncKey, setSyncKey] = useState("");
  const [settingAnchor, setSettingAnchor] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [meta, setMeta] = useState({ video: "/reel.mp4", fpsAnalyzed: 4, qualityThreshold: 0 });

  const selectedPlacement = placements.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    fetch("/placements.json")
      .then((res) => (res.ok ? (res.json() as Promise<PlacementsFile>) : null))
      .then((data) => {
        if (!data) return;
        setPlacements(data.placements);
        setMeta({ video: data.video, fpsAnalyzed: data.fpsAnalyzed, qualityThreshold: data.qualityThreshold });
      })
      .catch(() => {});
  }, []);

  // Editing a box at a given timestamp is only meaningful while paused on that timestamp;
  // once selection or time moves on, drop the in-progress edit and re-derive from real keyframes.
  const currentKey = `${selectedId ?? "none"}:${currentTime.toFixed(2)}`;
  if (currentKey !== syncKey) {
    setSyncKey(currentKey);
    setOverride(null);
  }
  const baseBox = draftBoxFor(selectedPlacement, currentTime);
  const draftBox = override ?? baseBox;

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!drag || !rect) return;
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      if (drag.mode === "move") {
        const x = clamp(drag.startBox.x + dx, 0, 1 - drag.startBox.width);
        const y = clamp(drag.startBox.y + dy, 0, 1 - drag.startBox.height);
        setOverride({ ...drag.startBox, x, y });
      } else {
        const width = clamp(drag.startBox.width + dx, 0.03, 1 - drag.startBox.x);
        const height = clamp(drag.startBox.height + dy, 0.03, 1 - drag.startBox.y);
        setOverride({ ...drag.startBox, width, height });
      }
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function updateSelected(patch: Partial<Placement>) {
    setPlacements((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  }

  function addPlacement() {
    const placement = createPlacement(currentTime);
    setPlacements((prev) => [...prev, placement]);
    setSelectedId(placement.id);
  }

  function deleteSelected() {
    setPlacements((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
  }

  function captureKeyframe() {
    if (!selectedPlacement) return;
    const timestamp = Math.round(currentTime * 100) / 100;
    const epsilon = 0.05;
    const boxes = [...selectedPlacement.boxes];
    const existingIndex = boxes.findIndex((b) => Math.abs(b.timestamp - timestamp) < epsilon);
    const newBox = { timestamp, ...draftBox };
    if (existingIndex >= 0) boxes[existingIndex] = newBox;
    else boxes.push(newBox);
    boxes.sort((a, b) => a.timestamp - b.timestamp);
    updateSelected({ boxes, startTime: boxes[0].timestamp, endTime: boxes[boxes.length - 1].timestamp });
  }

  function deleteKeyframe(timestamp: number) {
    if (!selectedPlacement || selectedPlacement.boxes.length <= 1) return;
    const boxes = selectedPlacement.boxes.filter((b) => b.timestamp !== timestamp);
    updateSelected({ boxes, startTime: boxes[0].timestamp, endTime: boxes[boxes.length - 1].timestamp });
  }

  /**
   * Most placements are just "this box, active from A to B" with no motion. For that common
   * case (<=2 keyframes), changing the time range rebuilds a static pair of keyframes from the
   * current box shape rather than making the user re-capture keyframes by hand. Once someone has
   * added real in-between motion (>2 keyframes), only the outer bounds move, preserving it.
   */
  function setTimeRange(startTime: number, endTime: number) {
    if (!selectedPlacement) return;
    const clampedStart = Math.max(0, Math.min(startTime, endTime));
    const clampedEnd = Math.max(clampedStart, endTime);

    let boxes = [...selectedPlacement.boxes];
    if (boxes.length <= 2) {
      const shape = { x: draftBox.x, y: draftBox.y, width: draftBox.width, height: draftBox.height };
      boxes =
        clampedStart === clampedEnd
          ? [{ timestamp: clampedStart, ...shape }]
          : [{ timestamp: clampedStart, ...shape }, { timestamp: clampedEnd, ...shape }];
    } else {
      boxes[0] = { ...boxes[0], timestamp: clampedStart };
      boxes[boxes.length - 1] = { ...boxes[boxes.length - 1], timestamp: clampedEnd };
      boxes.sort((a, b) => a.timestamp - b.timestamp);
    }
    updateSelected({ boxes, startTime: boxes[0].timestamp, endTime: boxes[boxes.length - 1].timestamp });
  }

  function onContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!settingAnchor || !selectedPlacement || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    updateSelected({ anchor: { x, y } });
    setSettingAnchor(false);
  }

  async function save() {
    setSaveStatus("saving");
    const payload: PlacementsFile = {
      video: meta.video,
      fpsAnalyzed: meta.fpsAnalyzed,
      generatedAt: new Date().toISOString(),
      qualityThreshold: meta.qualityThreshold,
      placements,
    };
    try {
      const res = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white">
      <div className="flex flex-1 items-center justify-center p-6">
        <div
          ref={containerRef}
          onClick={onContainerClick}
          className={`reel-frame relative overflow-hidden rounded-lg border border-white/10 bg-neutral-950 ${
            settingAnchor ? "cursor-crosshair" : ""
          }`}
        >
          <video
            ref={videoRef}
            src={meta.video}
            className="h-full w-full object-cover"
            muted
            controls
            playsInline
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />

          {placements
            .filter((p) => p.id !== selectedId)
            .map((p) => {
              const box = getInterpolatedBox(p, currentTime);
              if (!box) return null;
              return (
                <div
                  key={p.id}
                  className="pointer-events-none absolute rounded-sm border border-dashed border-white/50"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-white/70 px-1 py-0.5 text-[10px] font-semibold uppercase text-black">
                    {p.category.replace("_", " ")}
                  </span>
                </div>
              );
            })}

          {selectedPlacement && (
            <>
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, startBox: draftBox };
                }}
                className="absolute cursor-move border-2 border-emerald-400/90 bg-emerald-400/10"
                style={{
                  left: `${draftBox.x * 100}%`,
                  top: `${draftBox.y * 100}%`,
                  width: `${draftBox.width * 100}%`,
                  height: `${draftBox.height * 100}%`,
                }}
              >
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-400/90 px-1 py-0.5 text-[10px] font-semibold uppercase text-black">
                  {selectedPlacement.category.replace("_", " ")}
                </span>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = { mode: "resize", startX: e.clientX, startY: e.clientY, startBox: draftBox };
                  }}
                  className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-emerald-400"
                />
              </div>
              <div
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-2 ring-black/60"
                style={{
                  left: `${selectedPlacement.anchor.x * 100}%`,
                  top: `${selectedPlacement.anchor.y * 100}%`,
                }}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex w-80 flex-none flex-col gap-4 overflow-y-auto border-l border-white/10 bg-neutral-950 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold uppercase tracking-wide text-white/60">Placements</span>
          <button
            onClick={addPlacement}
            className="rounded bg-emerald-400 px-2 py-1 text-xs font-semibold text-black hover:bg-emerald-300"
          >
            + New
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {placements.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex items-center justify-between rounded px-2 py-1.5 text-left ${
                p.id === selectedId ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="uppercase">{p.category.replace("_", " ")}</span>
              <span className="text-white/40">
                {p.startTime.toFixed(1)}-{p.endTime.toFixed(1)}s
              </span>
            </button>
          ))}
          {placements.length === 0 && <p className="text-white/40">No placements yet.</p>}
        </div>

        {selectedPlacement && (
          <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
            <label className="flex flex-col gap-1">
              Category
              <select
                value={selectedPlacement.category}
                onChange={(e) => updateSelected({ category: e.target.value as Category })}
                className="rounded bg-white/10 px-2 py-1"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              Placement type
              <select
                value={selectedPlacement.placementType}
                onChange={(e) => updateSelected({ placementType: e.target.value as PlacementType })}
                className="rounded bg-white/10 px-2 py-1"
              >
                {PLACEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                Active from (s)
                <input
                  type="number"
                  step={0.25}
                  min={0}
                  value={selectedPlacement.startTime}
                  onChange={(e) => setTimeRange(Number(e.target.value), selectedPlacement.endTime)}
                  className="rounded bg-white/10 px-2 py-1"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                to (s)
                <input
                  type="number"
                  step={0.25}
                  min={0}
                  value={selectedPlacement.endTime}
                  onChange={(e) => setTimeRange(selectedPlacement.startTime, Number(e.target.value))}
                  className="rounded bg-white/10 px-2 py-1"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              Target object (if replacing)
              <input
                value={selectedPlacement.targetObject ?? ""}
                onChange={(e) => updateSelected({ targetObject: e.target.value || null })}
                className="rounded bg-white/10 px-2 py-1"
                placeholder="e.g. white ceramic mug"
              />
            </label>

            <label className="flex flex-col gap-1">
              Anchor description
              <input
                value={selectedPlacement.anchorDescription}
                onChange={(e) => updateSelected({ anchorDescription: e.target.value })}
                className="rounded bg-white/10 px-2 py-1"
              />
            </label>

            <label className="flex flex-col gap-1">
              Camera motion
              <select
                value={selectedPlacement.cameraMotion}
                onChange={(e) => updateSelected({ cameraMotion: e.target.value as CameraMotion })}
                className="rounded bg-white/10 px-2 py-1"
              >
                {CAMERA_MOTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => setSettingAnchor(true)}
              className={`rounded px-2 py-1.5 ${settingAnchor ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"}`}
            >
              {settingAnchor ? "Click video to set anchor..." : "Set anchor point"}
            </button>

            <div className="flex flex-col gap-1 border-t border-white/10 pt-3">
              <span className="text-white/60">Box (at t={currentTime.toFixed(2)}s)</span>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((field) => (
                  <label key={field} className="flex flex-col gap-1 text-xs text-white/50">
                    {field}
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      value={Number(draftBox[field].toFixed(3))}
                      onChange={(e) =>
                        setOverride({ ...draftBox, [field]: clamp(Number(e.target.value), 0, 1) })
                      }
                      className="rounded bg-white/10 px-2 py-1 text-white"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={captureKeyframe}
                className="mt-2 rounded bg-emerald-400 px-2 py-1.5 font-semibold text-black hover:bg-emerald-300"
              >
                Add/update keyframe here
              </button>
              <p className="mt-1 text-[11px] text-white/40">
                Only needed if the box should move over time -- for a static box, just set the
                time range above.
              </p>
            </div>

            <div className="flex flex-col gap-1 border-t border-white/10 pt-3">
              <span className="text-white/60">Keyframes ({selectedPlacement.boxes.length})</span>
              {selectedPlacement.boxes.map((b) => (
                <div key={b.timestamp} className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
                  <span>{b.timestamp.toFixed(2)}s</span>
                  <button
                    onClick={() => deleteKeyframe(b.timestamp)}
                    disabled={selectedPlacement.boxes.length <= 1}
                    className="text-white/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={deleteSelected}
              className="rounded bg-red-500/20 px-2 py-1.5 text-red-300 hover:bg-red-500/30"
            >
              Delete placement
            </button>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-3">
          <button
            onClick={save}
            className="rounded bg-white px-2 py-1.5 font-semibold text-black hover:bg-white/90"
          >
            Save to placements.json
          </button>
          {saveStatus === "saving" && <span className="text-white/40">Saving...</span>}
          {saveStatus === "saved" && <span className="text-emerald-400">Saved.</span>}
          {saveStatus === "error" && <span className="text-red-400">Save failed.</span>}
        </div>
      </div>
    </div>
  );
}
