"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Sparkles, Volume2 } from "lucide-react";
import type { Briefing } from "@/lib/mockData";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayerCard({
  briefing,
  variant = "full",
}: {
  briefing: Briefing;
  variant?: "full" | "hero";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(92);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const speeds = useMemo(() => ["1x", "1.25x", "1.5x", "2x"], []);
  const section = briefing.transcript[sectionIndex]?.title ?? "Briefing";

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setProgress((current) => (current >= briefing.durationSeconds ? 0 : current + 3));
    }, 900);

    return () => window.clearInterval(timer);
  }, [briefing.durationSeconds, isPlaying]);

  const percent = Math.min(100, Math.round((progress / briefing.durationSeconds) * 100));

  return (
    <section
      className={cn(
        "surface-card overflow-hidden rounded-[2rem]",
        variant === "hero" ? "p-5 sm:p-6" : "p-5 sm:p-7",
      )}
    >
      <div className="h-1.5 w-full rounded-full bg-accent-line" />
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-teal-300">
            <Sparkles className="h-3.5 w-3.5" />
            Generated briefing
          </div>
          <h2 className={cn("mt-4 font-semibold text-mist-50", variant === "hero" ? "text-2xl" : "text-3xl")}>
            {briefing.title}
          </h2>
          <p className="mt-2 text-sm text-mist-500">
            {briefing.date} · {briefing.duration} · {briefing.tone}
          </p>
        </div>
        <div className="hidden h-14 w-14 items-center justify-center rounded-3xl bg-teal-300/[0.12] text-teal-300 sm:flex">
          <Volume2 className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-7 rounded-[1.5rem] border border-white/10 bg-ink-950/[0.48] p-4">
        <div className="flex items-center justify-between gap-3 text-xs text-mist-500">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(briefing.durationSeconds)}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/[0.08]">
          <div
            aria-label="Mock audio progress"
            className="h-full rounded-full bg-gradient-to-r from-teal-300 via-violet-300 to-ember-300 transition-all"
            role="progressbar"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            aria-label="Rewind 15 seconds"
            className="icon-button"
            onClick={() => setProgress((current) => Math.max(0, current - 15))}
            type="button"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            aria-label={isPlaying ? "Pause briefing" : "Play briefing"}
            className="focus-ring flex h-16 w-16 items-center justify-center rounded-full bg-mist-50 text-ink-950 shadow-glow transition hover:scale-[1.03]"
            onClick={() => setIsPlaying((current) => !current)}
            type="button"
          >
            {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
          </button>
          <button
            aria-label="Skip section"
            className="icon-button"
            onClick={() => setSectionIndex((current) => (current + 1) % Math.max(1, briefing.transcript.length))}
            type="button"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-mist-300">
            Now playing: <span className="text-mist-50">{section}</span>
          </div>
          <button
            className="secondary-button px-4 py-2 text-xs"
            onClick={() => setSpeedIndex((current) => (current + 1) % speeds.length)}
            type="button"
          >
            {speeds[speedIndex]} speed
          </button>
        </div>
      </div>
    </section>
  );
}
