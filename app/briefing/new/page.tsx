import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BriefingContextWorkspace } from "@/components/BriefingContextWorkspace";

export default function NewBriefingPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link className="secondary-button px-4 py-2" href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <BriefingContextWorkspace />
      </div>
    </AppShell>
  );
}
