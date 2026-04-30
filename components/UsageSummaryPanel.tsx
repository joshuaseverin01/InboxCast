"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { readUsageCounts, type UsageCounts } from "@/lib/localUsage";

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

  useEffect(() => {
    function syncCounts() {
      setCounts(readUsageCounts());
    }

    syncCounts();
    window.addEventListener("storage", syncCounts);
    window.addEventListener("inboxcast:usage-updated", syncCounts);

    return () => {
      window.removeEventListener("storage", syncCounts);
      window.removeEventListener("inboxcast:usage-updated", syncCounts);
    };
  }, []);

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
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-mist-500">
        Approximate browser-local counts only. They help spot repeated calls, but they are not billing records and can
        be cleared with local data.
      </p>
    </section>
  );
}
