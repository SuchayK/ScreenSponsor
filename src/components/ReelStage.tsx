"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Placement, PlacementsFile } from "@/lib/placements/types";
import { getInterpolatedBox } from "@/lib/placements/interpolate";

type Reel = {
  key: string;
  label: string;
  src: string;
  overlay?: boolean;
};

const REELS: Reel[] = [
  { key: "original", label: "ORIGINAL", src: "/reel.mp4" },
  { key: "ai-placement", label: "AI PLACEMENT", src: "/reel.mp4", overlay: true },
  { key: "monetized", label: "MONETIZED", src: "/reel.mp4" },
];

const DRIFT_TOLERANCE_SECONDS = 0.25;

function useVideoTime(videoRef: RefObject<HTMLVideoElement | null>): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const video = videoRef.current;
      if (video) setTime(video.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  return time;
}

function PlacementOverlay({
  placements,
  currentTime,
}: {
  placements: Placement[];
  currentTime: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {placements.map((placement) => {
        const box = getInterpolatedBox(placement, currentTime);
        if (!box) return null;
        return (
          <div
            key={placement.id}
            className="absolute rounded-sm border-2 border-emerald-400/80"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
            }}
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-400/90 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
              {placement.category.replace("_", " ")} · {Math.round(placement.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReelPanel({
  reel,
  index,
  placements,
  onVideoRef,
  onClick,
}: {
  reel: Reel;
  index: number;
  placements: Placement[];
  onVideoRef: (index: number, el: HTMLVideoElement | null) => void;
  onClick: () => void;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const currentTime = useVideoTime(localRef);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-widest text-white">
        {reel.label}
      </span>
      <div
        className="reel-frame relative cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-neutral-950"
        onClick={onClick}
      >
        <video
          ref={(el) => {
            localRef.current = el;
            onVideoRef(index, el);
          }}
          src={reel.src}
          className="h-full w-full object-cover"
          muted
          autoPlay
          loop
          playsInline
          controls={false}
        />
        {reel.overlay && <PlacementOverlay placements={placements} currentTime={currentTime} />}
      </div>
    </div>
  );
}

export default function ReelStage() {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [placements, setPlacements] = useState<Placement[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/placements.json")
      .then((res) => (res.ok ? (res.json() as Promise<PlacementsFile>) : null))
      .then((data) => {
        if (!cancelled && data) setPlacements(data.placements);
      })
      .catch(() => {
        // No analysis output yet -- render the plain video with no overlays.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const videos = videoRefs.current.filter(
      (video): video is HTMLVideoElement => video !== null,
    );

    if (isPlaying) {
      videos.forEach((video) => {
        video.play().catch(() => {});
      });
    } else {
      videos.forEach((video) => video.pause());
    }
  }, [isPlaying]);

  useEffect(() => {
    const primary = videoRefs.current[0];
    if (!primary) return;

    const keepInSync = () => {
      videoRefs.current.forEach((video, index) => {
        if (index === 0 || !video) return;
        if (Math.abs(video.currentTime - primary.currentTime) > DRIFT_TOLERANCE_SECONDS) {
          video.currentTime = primary.currentTime;
        }
      });
    };

    primary.addEventListener("timeupdate", keepInSync);
    return () => primary.removeEventListener("timeupdate", keepInSync);
  }, []);

  const togglePlayback = () => setIsPlaying((playing) => !playing);

  return (
    <div className="flex h-screen w-screen items-center justify-center gap-20 overflow-hidden bg-black px-6">
      {REELS.map((reel, index) => (
        <ReelPanel
          key={reel.key}
          reel={reel}
          index={index}
          placements={placements}
          onVideoRef={(i, el) => {
            videoRefs.current[i] = el;
          }}
          onClick={togglePlayback}
        />
      ))}
    </div>
  );
}
