export type UsageKind = "briefing" | "tts" | "concierge";

export type UsageCounts = Record<UsageKind, number>;

export const usageStorageKey = "inboxcast.usageCounts";

const defaultCounts: UsageCounts = {
  briefing: 0,
  concierge: 0,
  tts: 0,
};

export function readUsageCounts(): UsageCounts {
  if (typeof window === "undefined") return defaultCounts;

  try {
    return {
      ...defaultCounts,
      ...(JSON.parse(window.localStorage.getItem(usageStorageKey) ?? "{}") as Partial<UsageCounts>),
    };
  } catch {
    return defaultCounts;
  }
}

export function incrementUsageCount(kind: UsageKind) {
  const counts = readUsageCounts();
  const nextCounts = {
    ...counts,
    [kind]: counts[kind] + 1,
  };

  window.localStorage.setItem(usageStorageKey, JSON.stringify(nextCounts));
  window.dispatchEvent(new Event("inboxcast:usage-updated"));
}
