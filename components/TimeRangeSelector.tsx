"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Clock, Loader2 } from "lucide-react";
import type { BriefingContextFilters, BriefingContextRequest } from "@/lib/google/types";

const initialToggles = [
  { id: "includeUnreadOnly", label: "Include unread only", enabled: false },
  { id: "calendar", label: "Include calendar", enabled: true },
  { id: "newsletters", label: "Include newsletters", enabled: true },
  { id: "promotions", label: "Include promotions", enabled: false },
];

type ToggleId = "includeUnreadOnly" | "calendar" | "newsletters" | "promotions";

export type TimeRangeSelectorValue = BriefingContextRequest;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInput(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function rangeFromValue(value: TimeRangeSelectorValue) {
  const start = new Date(value.start);
  const end = new Date(value.end);

  return {
    endDate: formatDateInput(end),
    endTime: formatTimeInput(end),
    startDate: formatDateInput(start),
    startTime: formatTimeInput(start),
  };
}

function getInitialRange() {
  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);

  return {
    endDate: formatDateInput(end),
    endTime: formatTimeInput(end),
    startDate: formatDateInput(start),
    startTime: formatTimeInput(start),
  };
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function toFilters(toggles: typeof initialToggles): BriefingContextFilters {
  return {
    includeCalendar: toggles.find((item) => item.id === "calendar")?.enabled ?? true,
    includeNewsletters: toggles.find((item) => item.id === "newsletters")?.enabled ?? true,
    includePromotions: toggles.find((item) => item.id === "promotions")?.enabled ?? false,
    includeUnreadOnly: toggles.find((item) => item.id === "includeUnreadOnly")?.enabled ?? false,
  };
}

function togglesFromFilters(filters?: BriefingContextFilters) {
  if (!filters) return initialToggles;

  return initialToggles.map((item) => {
    if (item.id === "calendar") return { ...item, enabled: filters.includeCalendar !== false };
    if (item.id === "newsletters") return { ...item, enabled: filters.includeNewsletters !== false };
    if (item.id === "promotions") return { ...item, enabled: filters.includePromotions === true };
    if (item.id === "includeUnreadOnly") return { ...item, enabled: filters.includeUnreadOnly === true };
    return item;
  });
}

export function TimeRangeSelector({
  badge = "Server-side fetch",
  loading = false,
  onCreate,
  submitLabel = "Fetch Gmail & Calendar context",
  value,
}: {
  badge?: string;
  loading?: boolean;
  onCreate?: (value: TimeRangeSelectorValue) => void;
  submitLabel?: string;
  value?: TimeRangeSelectorValue | null;
}) {
  const router = useRouter();
  const initialRange = getInitialRange();
  const [toggles, setToggles] = useState(initialToggles);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [startTime, setStartTime] = useState(initialRange.startTime);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [endTime, setEndTime] = useState(initialRange.endTime);

  useEffect(() => {
    if (!value) return;

    const nextRange = rangeFromValue(value);
    setStartDate(nextRange.startDate);
    setStartTime(nextRange.startTime);
    setEndDate(nextRange.endDate);
    setEndTime(nextRange.endTime);
    setToggles(togglesFromFilters(value.filters));
  }, [value]);

  function toggleOption(id: ToggleId) {
    setToggles((current) =>
      current.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    );
  }

  function createBriefing() {
    const value: TimeRangeSelectorValue = {
      end: toIso(endDate, endTime),
      filters: toFilters(toggles),
      start: toIso(startDate, startTime),
    };

    if (onCreate) {
      onCreate(value);
      return;
    }

    window.setTimeout(() => {
      router.push("/briefing");
    }, 650);
  }

  return (
    <section className="surface-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-300">Custom range</p>
          <h2 className="mt-2 text-2xl font-semibold text-mist-50">Shape your briefing window</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
            Pick the exact email and calendar window InboxCast should turn into a listenable briefing.
          </p>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-mist-300 sm:block">
          {badge}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-mist-300">
            <Calendar className="h-4 w-4 text-teal-300" />
            Start date
          </span>
          <input className="field" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-mist-300">
            <Clock className="h-4 w-4 text-violet-300" />
            Start time
          </span>
          <input className="field" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-mist-300">
            <Calendar className="h-4 w-4 text-teal-300" />
            End date
          </span>
          <input className="field" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-mist-300">
            <Clock className="h-4 w-4 text-violet-300" />
            End time
          </span>
          <input className="field" onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} />
        </label>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {toggles.map((item) => (
          <button
            aria-pressed={item.enabled}
            className="focus-ring flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:bg-white/[0.07]"
            key={item.id}
            onClick={() => toggleOption(item.id as ToggleId)}
            type="button"
          >
            <span className="text-sm font-medium text-mist-100">{item.label}</span>
            <span
              className={[
                "flex h-7 w-12 items-center rounded-full border p-1 transition",
                item.enabled
                  ? "border-teal-300/40 bg-teal-300/20"
                  : "border-white/10 bg-ink-950/60",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-5 w-5 items-center justify-center rounded-full transition",
                  item.enabled ? "translate-x-5 bg-teal-300 text-ink-950" : "translate-x-0 bg-mist-700",
                ].join(" ")}
              >
                {item.enabled && <Check className="h-3 w-3" />}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button className="primary-button mt-7 w-full sm:w-auto" disabled={loading} onClick={createBriefing} type="button">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
        {loading ? "Fetching context" : submitLabel}
      </button>
    </section>
  );
}
