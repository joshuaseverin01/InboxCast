"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { feedbackStorageKey } from "@/lib/feedback";
import { dailyUsageStorageKey, usageStorageKey } from "@/lib/localUsage";
import { morningBriefingLastRunStorageKey, morningBriefingPresetStorageKey } from "@/lib/morningBriefing";
import { onboardingCompleteStorageKey } from "@/lib/onboarding";

const localStorageKeys = [
  "inboxcast.latestBriefing",
  "inboxcast.outputs",
  "inboxcast.audioState",
  morningBriefingPresetStorageKey,
  morningBriefingLastRunStorageKey,
  onboardingCompleteStorageKey,
  usageStorageKey,
  dailyUsageStorageKey,
  feedbackStorageKey,
];

export function DeleteLocalDataButton() {
  const [cleared, setCleared] = useState(false);

  function deleteLocalData() {
    for (const key of localStorageKeys) {
      window.localStorage.removeItem(key);
    }

    window.dispatchEvent(new Event("inboxcast:usage-updated"));
    window.dispatchEvent(new Event("inboxcast:setup-updated"));
    window.dispatchEvent(new Event("inboxcast:onboarding-reset"));
    setCleared(true);
    window.setTimeout(() => setCleared(false), 1600);
  }

  return (
    <button
      className="secondary-button justify-start rounded-2xl px-4 py-4 text-left text-ember-300"
      onClick={deleteLocalData}
      type="button"
    >
      <Trash2 className="h-4 w-4" />
      {cleared ? "Local data cleared" : "Delete local data"}
    </button>
  );
}
