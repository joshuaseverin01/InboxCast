import type { BriefingContextFilters, BriefingContextRequest, BriefingStyle } from "@/lib/google/types";

export type MorningBriefingRange =
  | "since_yesterday_8pm"
  | "last_24_hours"
  | "today"
  | "this_morning"
  | "last_7_days"
  | "since_last_briefing";

export type MorningBriefingPreset = {
  range: MorningBriefingRange;
  includeCalendar: boolean;
  includeUnreadOnly: boolean;
  includeNewsletters: boolean;
  includePromotions: boolean;
  briefingStyle: BriefingStyle;
  generateAudioAfterBriefing: boolean;
};

export const morningBriefingPresetStorageKey = "inboxcast.morningBriefingPreset";
export const morningBriefingLastRunStorageKey = "inboxcast.morningBriefingLastRun";

export const morningBriefingRangeOptions: Array<{ value: MorningBriefingRange; label: string }> = [
  { label: "Since yesterday at 8 PM", value: "since_yesterday_8pm" },
  { label: "Last 24 hours", value: "last_24_hours" },
  { label: "Today", value: "today" },
  { label: "This morning", value: "this_morning" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Since last briefing", value: "since_last_briefing" },
];

export const defaultMorningBriefingPreset: MorningBriefingPreset = {
  briefingStyle: "concise",
  generateAudioAfterBriefing: false,
  includeCalendar: true,
  includeNewsletters: true,
  includePromotions: false,
  includeUnreadOnly: false,
  range: "since_yesterday_8pm",
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function filtersFromPreset(preset: MorningBriefingPreset): BriefingContextFilters {
  return {
    includeCalendar: preset.includeCalendar,
    includeNewsletters: preset.includeNewsletters,
    includePromotions: preset.includePromotions,
    includeUnreadOnly: preset.includeUnreadOnly,
  };
}

function range(start: Date, end: Date, filters: BriefingContextFilters): BriefingContextRequest {
  return {
    end: end.toISOString(),
    filters,
    start: start.toISOString(),
  };
}

function parseStoredDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function readMorningBriefingPreset(): MorningBriefingPreset {
  if (typeof window === "undefined") return defaultMorningBriefingPreset;

  try {
    const stored = window.localStorage.getItem(morningBriefingPresetStorageKey);
    if (!stored) return defaultMorningBriefingPreset;

    return {
      ...defaultMorningBriefingPreset,
      ...(JSON.parse(stored) as Partial<MorningBriefingPreset>),
    };
  } catch {
    return defaultMorningBriefingPreset;
  }
}

export function writeMorningBriefingPreset(preset: MorningBriefingPreset) {
  window.localStorage.setItem(morningBriefingPresetStorageKey, JSON.stringify(preset));
}

export function buildMorningBriefingRequest(
  preset: MorningBriefingPreset,
  lastRunIso?: string | null,
  now = new Date(),
) {
  const end = new Date(now);
  const filters = filtersFromPreset(preset);
  let start: Date;
  let rangeLabel = morningBriefingRangeOptions.find((option) => option.value === preset.range)?.label ?? "Morning briefing";
  let usedFallback = false;

  if (preset.range === "since_yesterday_8pm") {
    start = startOfDay(end);
    start.setDate(start.getDate() - 1);
    start.setHours(20, 0, 0, 0);
  } else if (preset.range === "last_24_hours") {
    start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  } else if (preset.range === "today" || preset.range === "this_morning") {
    start = startOfDay(end);
  } else if (preset.range === "last_7_days") {
    start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    const lastRun = parseStoredDate(lastRunIso);
    if (lastRun && lastRun < end) {
      start = lastRun;
    } else {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      rangeLabel = "Since last briefing (fallback: last 24 hours)";
      usedFallback = true;
    }
  }

  return {
    rangeLabel,
    request: range(start, end, filters),
    usedFallback,
  };
}
