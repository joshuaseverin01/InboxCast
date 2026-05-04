"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { isOnboardingComplete, markOnboardingComplete } from "@/lib/onboarding";

let skippedOnboardingThisSession = false;

const steps = [
  "Connect Google for Gmail and Calendar context.",
  "Set your Morning Briefing preset.",
  "Generate your first written briefing.",
  "Ask Concierge follow-up questions.",
  "Save outputs or create reviewed Gmail drafts.",
];

export function FirstRunOnboarding() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOnboardingComplete() && !skippedOnboardingThisSession) {
      setOpen(true);
    }

    function handleReset() {
      skippedOnboardingThisSession = false;
      setOpen(true);
    }

    window.addEventListener("inboxcast:onboarding-reset", handleReset);
    return () => window.removeEventListener("inboxcast:onboarding-reset", handleReset);
  }, []);

  function completeAndClose() {
    markOnboardingComplete();
    setOpen(false);
  }

  function skipForNow() {
    skippedOnboardingThisSession = true;
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 px-3 pb-24 pt-6 backdrop-blur-xl sm:items-center sm:p-6 lg:pb-6">
      <section
        aria-labelledby="inboxcast-onboarding-title"
        aria-modal="true"
        className="surface-card max-h-[calc(100vh-7rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-5 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-300/[0.12] text-teal-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-teal-300">Welcome to InboxCast</p>
            <h2 id="inboxcast-onboarding-title" className="mt-2 text-2xl font-semibold text-mist-50 sm:text-3xl">
              Turn email and calendar noise into a calm morning briefing.
            </h2>
            <p className="mt-3 text-sm leading-6 text-mist-400">
              InboxCast helps you listen to what matters, follow up with Concierge, and keep useful drafts or notes.
            </p>
            <p className="mt-3 rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] p-3 text-sm leading-6 text-violet-50">
              InboxCast is currently a private beta. Use with trusted accounts only. Review AI outputs before acting.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {steps.map((step, index) => (
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3" key={step}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-mist-100">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-mist-300">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-teal-300/20 bg-teal-300/[0.08] p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            <p className="text-sm leading-6 text-teal-50">
              InboxCast reads Gmail and Calendar only after you connect Google, creates Gmail drafts only after your
              confirmation, never sends email automatically, and reads full email or thread content only after explicit
              approval. AI outputs may be imperfect and should be reviewed.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <button className="primary-button justify-center" onClick={completeAndClose} type="button">
            <CheckCircle2 className="h-4 w-4" />
            Get started
          </button>
          <button className="secondary-button justify-center px-4 py-3" onClick={skipForNow} type="button">
            Skip for now
          </button>
          <button className="secondary-button justify-center px-4 py-3 text-mist-400" onClick={completeAndClose} type="button">
            Do not show again
          </button>
        </div>
      </section>
    </div>
  );
}
