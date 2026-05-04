export type UsageKind = "briefing" | "tts" | "concierge";

export type UsageCounts = Record<UsageKind, number>;
export type DailyUsageState = {
  counts: UsageCounts;
  date: string;
};

export const usageStorageKey = "inboxcast.usageCounts";
export const dailyUsageStorageKey = "inboxcast.dailyUsage";

export const betaDailyUsageLimits: UsageCounts = {
  briefing: 10,
  concierge: 50,
  tts: 10,
};

const defaultCounts: UsageCounts = {
  briefing: 0,
  concierge: 0,
  tts: 0,
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDailyUsage(): DailyUsageState {
  return {
    counts: defaultCounts,
    date: todayKey(),
  };
}

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
  const daily = readDailyUsage();
  const nextCounts = {
    ...counts,
    [kind]: counts[kind] + 1,
  };
  const nextDaily = {
    ...daily,
    counts: {
      ...daily.counts,
      [kind]: daily.counts[kind] + 1,
    },
  };

  window.localStorage.setItem(usageStorageKey, JSON.stringify(nextCounts));
  window.localStorage.setItem(dailyUsageStorageKey, JSON.stringify(nextDaily));
  window.dispatchEvent(new Event("inboxcast:usage-updated"));
}

export function readDailyUsage(): DailyUsageState {
  if (typeof window === "undefined") return defaultDailyUsage();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(dailyUsageStorageKey) ?? "{}") as Partial<DailyUsageState>;
    const date = todayKey();

    if (parsed.date !== date) {
      return {
        counts: defaultCounts,
        date,
      };
    }

    return {
      counts: {
        ...defaultCounts,
        ...(parsed.counts ?? {}),
      },
      date,
    };
  } catch {
    return defaultDailyUsage();
  }
}

export function getUsageLimitStatus(kind: UsageKind) {
  const daily = readDailyUsage();
  const limit = betaDailyUsageLimits[kind];
  const used = daily.counts[kind];

  return {
    limit,
    message:
      used >= limit
        ? "You've hit today's private beta usage limit for this feature."
        : null,
    ok: used < limit,
    remaining: Math.max(0, limit - used),
    used,
  };
}

export function resetDailyUsage() {
  window.localStorage.removeItem(dailyUsageStorageKey);
  window.dispatchEvent(new Event("inboxcast:usage-updated"));
}
