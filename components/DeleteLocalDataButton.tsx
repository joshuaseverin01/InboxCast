"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { usageStorageKey } from "@/lib/localUsage";

const localStorageKeys = ["inboxcast.latestBriefing", "inboxcast.outputs", "inboxcast.audioState", usageStorageKey];

export function DeleteLocalDataButton() {
  const [cleared, setCleared] = useState(false);

  function deleteLocalData() {
    for (const key of localStorageKeys) {
      window.localStorage.removeItem(key);
    }

    window.dispatchEvent(new Event("inboxcast:usage-updated"));
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
