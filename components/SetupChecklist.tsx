"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, MailPlus, Settings, ShieldCheck } from "lucide-react";
import { morningBriefingLastRunStorageKey, morningBriefingPresetStorageKey } from "@/lib/morningBriefing";
import { cn } from "@/lib/utils";

const latestBriefingStorageKey = "inboxcast.latestBriefing";
const outputsStorageKey = "inboxcast.outputs";

type ChecklistLocalState = {
  firstBriefingGenerated: boolean;
  firstOutputSaved: boolean;
  presetConfigured: boolean;
};

function hasSavedOutput() {
  try {
    const outputs = JSON.parse(window.localStorage.getItem(outputsStorageKey) ?? "[]") as unknown[];
    return Array.isArray(outputs) && outputs.length > 0;
  } catch {
    return false;
  }
}

function readChecklistState(): ChecklistLocalState {
  return {
    firstBriefingGenerated: Boolean(
      window.localStorage.getItem(latestBriefingStorageKey) ||
        window.localStorage.getItem(morningBriefingLastRunStorageKey),
    ),
    firstOutputSaved: hasSavedOutput(),
    presetConfigured: Boolean(window.localStorage.getItem(morningBriefingPresetStorageKey)),
  };
}

function ChecklistRow({
  complete,
  description,
  label,
  optional = false,
}: {
  complete: boolean;
  description: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      {complete ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-mist-600" />
      )}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-semibold", complete ? "text-mist-100" : "text-mist-300")}>{label}</p>
          {optional && (
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-mist-500">
              Optional
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-mist-500">{description}</p>
      </div>
    </div>
  );
}

export function SetupChecklist({
  gmailDraftConnected,
  googleConnected,
}: {
  gmailDraftConnected: boolean;
  googleConnected: boolean;
}) {
  const [localState, setLocalState] = useState<ChecklistLocalState>({
    firstBriefingGenerated: false,
    firstOutputSaved: false,
    presetConfigured: false,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function refresh() {
      setLocalState(readChecklistState());
      setReady(true);
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("inboxcast:setup-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("inboxcast:setup-updated", refresh);
    };
  }, []);

  const coreComplete = googleConnected && localState.presetConfigured && localState.firstBriefingGenerated;

  if (!ready) return null;
  if (coreComplete) return null;

  return (
    <section className="surface-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
            <Settings className="h-4 w-4" />
            Setup checklist
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-mist-50">Get your first briefing ready</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
            A few local setup steps make the daily flow one tap from the Dashboard.
          </p>
        </div>
        <Link className="secondary-button justify-center px-4 py-2 text-xs" href="/settings">
          Open settings
        </Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <ChecklistRow
          complete={googleConnected}
          description="Connect Google with read-only Gmail and Calendar permissions."
          label="Google connected"
        />
        <ChecklistRow
          complete={localState.presetConfigured}
          description="Choose the default range, filters, style, and optional audio behavior."
          label="Morning preset configured"
        />
        <ChecklistRow
          complete={localState.firstBriefingGenerated}
          description="Use Start morning briefing below to create the first local transcript."
          label="First briefing generated"
        />
        <ChecklistRow
          complete={localState.firstOutputSaved}
          description="Save a Concierge answer or reply draft when you want to keep it."
          label="First output saved"
          optional
        />
        <ChecklistRow
          complete={gmailDraftConnected}
          description="Reconnect Google with Gmail compose permission to create drafts only."
          label="Gmail draft permission"
          optional
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl border border-teal-300/20 bg-teal-300/[0.08] p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            <p className="text-sm leading-6 text-teal-50">
              InboxCast reads Gmail and Calendar after you connect Google. It never sends emails automatically.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex gap-3">
            <MailPlus className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
            <p className="text-sm leading-6 text-mist-300">
              Draft creation requires your confirmation, and full email or thread content is read only after approval.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
