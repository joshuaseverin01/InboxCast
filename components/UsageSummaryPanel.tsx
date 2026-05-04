"use client";

import { useEffect, useState } from "react";
import { BarChart3, RefreshCcw } from "lucide-react";
import {
  betaDailyUsageLimits,
  readDailyUsage,
  readUsageCounts,
  resetDailyUsage,
  type UsageCounts,
} from "@/lib/localUsage";

const usageItems: Array<{ key: keyof UsageCounts; label: string }> = [
  { key: "briefing", label: "AI briefing calls" },
  { key: "tts", label: "TTS generations" },
  { key: "concierge", label: "Concierge calls" },
];

export function UsageSummaryPanel() {
  const [counts, setCounts] = useState<UsageCounts>(() => ({
    briefing: 0,
    concierge: 0,
    tts: 0,
  }));
  const [dailyCounts, setDailyCounts] = useState<UsageCounts>(() => ({
    briefing: 0,
    concierge: 0,
    tts: 0,
  }));
  const [reset, setReset] = useState(false);

  useEffect(() => {
    function syncCounts() {
      setCounts(readUsageCounts());
      setDailyCounts(readDailyUsage().counts);
    }

    syncCounts();
    window.addEventListener("storage", syncCounts);
    window.addEventListener("inboxcast:usage-updated", syncCounts);

    return () => {
      window.removeEventListener("storage", syncCounts);
      window.removeEventListener("inboxcast:usage-updated", syncCounts);
    };
  }, []);

  function resetToday() {
    resetDailyUsage();
    setReset(true);
    window.setTimeout(() => setReset(false), 1400);
  }

  return (
    <section className="surface-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
        <BarChart3 className="h-4 w-4" />
        Usage visibility
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {usageItems.map((item) => (
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4" key={item.key}>
            <div className="text-3xl font-semibold text-mist-50">{counts[item.key]}</div>
            <p className="mt-2 text-sm leading-5 text-mist-500">{item.label}</p>
            <p className="mt-2 text-xs leading-5 text-mist-600">
              Today: {dailyCounts[item.key]} / {betaDailyUsageLimits[item.key]}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-mist-500">
          Approximate browser-local counts only. Private beta soft limits help prevent accidental API credit spikes.
        </p>
        <button className="secondary-button px-4 py-2 text-xs" onClick={resetToday} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {reset ? "Reset" : "Reset today's usage"}
        </button>
      </div>
    </section>
  );
}
