"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlarmClock, Volume2 } from "lucide-react";
import { briefingFocusOptions } from "@/lib/briefingFocus";
import type { BriefingFocus, BriefingStyle } from "@/lib/google/types";
import {
  defaultMorningBriefingPreset,
  morningBriefingRangeOptions,
  readMorningBriefingPreset,
  type MorningBriefingPreset,
  type MorningBriefingRange,
  writeMorningBriefingPreset,
} from "@/lib/morningBriefing";
import { cn } from "@/lib/utils";

const briefingStyles: BriefingStyle[] = ["concise", "detailed", "executive", "casual podcast"];

function ToggleButton({
  checked,
  children,
  onClick,
}: {
  checked: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={cn(
        "focus-ring rounded-2xl border p-4 text-left text-sm font-medium transition",
        checked
          ? "border-teal-300/[0.35] bg-teal-300/[0.12] text-teal-300"
          : "border-white/10 bg-white/[0.045] text-mist-300 hover:bg-white/[0.075]",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function MorningBriefingSettings() {
  const [preset, setPreset] = useState<MorningBriefingPreset>(defaultMorningBriefingPreset);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPreset(readMorningBriefingPreset());
  }, []);

  function updatePreset(next: MorningBriefingPreset) {
    setPreset(next);
    writeMorningBriefingPreset(next);
    window.dispatchEvent(new Event("inboxcast:setup-updated"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <section className="surface-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
            <AlarmClock className="h-4 w-4" />
            Morning briefing preset
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-mist-50">One-tap default</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
            These preferences stay in this browser and control the Dashboard Start morning briefing button.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-mist-300">
          {saved ? "Saved" : "Local only"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="block text-sm font-medium text-mist-300">
          Default range
          <select
            className="field mt-2"
            onChange={(event) => updatePreset({ ...preset, range: event.target.value as MorningBriefingRange })}
            value={preset.range}
          >
            {morningBriefingRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-mist-300">
          Default briefing style
          <select
            className="field mt-2"
            onChange={(event) => updatePreset({ ...preset, briefingStyle: event.target.value as BriefingStyle })}
            value={preset.briefingStyle}
          >
            {briefingStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-mist-300">
          Briefing focus
          <select
            className="field mt-2"
            onChange={(event) => updatePreset({ ...preset, briefingFocus: event.target.value as BriefingFocus })}
            value={preset.briefingFocus}
          >
            {briefingFocusOptions.map((focus) => (
              <option key={focus.value} value={focus.value}>
                {focus.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ToggleButton checked={preset.includeCalendar} onClick={() => updatePreset({ ...preset, includeCalendar: !preset.includeCalendar })}>
          Include calendar
        </ToggleButton>
        <ToggleButton checked={preset.includeUnreadOnly} onClick={() => updatePreset({ ...preset, includeUnreadOnly: !preset.includeUnreadOnly })}>
          Include unread only
        </ToggleButton>
        <ToggleButton checked={preset.includeNewsletters} onClick={() => updatePreset({ ...preset, includeNewsletters: !preset.includeNewsletters })}>
          Include newsletters
        </ToggleButton>
        <ToggleButton checked={preset.includePromotions} onClick={() => updatePreset({ ...preset, includePromotions: !preset.includePromotions })}>
          Include promotions
        </ToggleButton>
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
        <button
          aria-pressed={preset.generateAudioAfterBriefing}
          className={cn(
            "secondary-button justify-start px-4 py-3",
            preset.generateAudioAfterBriefing && "border-violet-300/35 text-violet-300",
          )}
          onClick={() =>
            updatePreset({
              ...preset,
              generateAudioAfterBriefing: !preset.generateAudioAfterBriefing,
            })
          }
          type="button"
        >
          <Volume2 className="h-4 w-4" />
          Generate audio after briefing
        </button>
        {preset.generateAudioAfterBriefing && (
          <p className="mt-3 text-sm leading-6 text-ember-300">This uses additional AI audio credits.</p>
        )}
      </div>
    </section>
  );
}
