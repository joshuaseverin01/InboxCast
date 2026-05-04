"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { resetOnboarding } from "@/lib/onboarding";

export function ResetOnboardingButton() {
  const [reset, setReset] = useState(false);

  function handleReset() {
    resetOnboarding();
    window.dispatchEvent(new Event("inboxcast:onboarding-reset"));
    setReset(true);
    window.setTimeout(() => setReset(false), 1600);
  }

  return (
    <button className="secondary-button justify-start rounded-2xl px-4 py-4 text-left" onClick={handleReset} type="button">
      <RefreshCcw className="h-4 w-4" />
      {reset ? "Onboarding reset" : "Reset onboarding"}
    </button>
  );
}
