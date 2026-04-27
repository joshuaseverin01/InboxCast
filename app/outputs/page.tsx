import { AppShell } from "@/components/AppShell";
import { OutputsClient } from "@/components/outputs/OutputsClient";

export default function OutputsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-300">Outputs</p>
            <h1 className="mt-2 text-4xl font-semibold text-mist-50">Saved AI workbench</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-mist-300">
              Concierge responses saved locally in this browser for editing, copying, or deleting.
            </p>
          </div>
        </div>

        <OutputsClient />
      </div>
    </AppShell>
  );
}
