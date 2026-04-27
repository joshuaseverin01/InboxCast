import { AppShell } from "@/components/AppShell";
import { ConciergeClient } from "@/components/concierge/ConciergeClient";

export default function ConciergePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-teal-300">AI Concierge</p>
          <h1 className="mt-2 text-4xl font-semibold text-mist-50">Ask about your briefing</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-mist-300">
            Use the latest generated briefing, Gmail metadata, and Calendar context to plan replies and next steps.
          </p>
        </div>

        <ConciergeClient />
      </div>
    </AppShell>
  );
}
