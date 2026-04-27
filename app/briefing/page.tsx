import { AppShell } from "@/components/AppShell";
import { BriefingContextWorkspace } from "@/components/BriefingContextWorkspace";

export default function BriefingPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-teal-300">Briefing</p>
          <h1 className="mt-2 text-4xl font-semibold text-mist-50">Generate a real written briefing</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-mist-300">
            Fetch live Gmail metadata and Calendar events, then generate a transcript from that real context.
          </p>
        </div>
        <BriefingContextWorkspace />
      </div>
    </AppShell>
  );
}
