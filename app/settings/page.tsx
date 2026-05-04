import { ShieldAlert, SlidersHorizontal, Volume2 } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { DeleteLocalDataButton } from "@/components/DeleteLocalDataButton";
import { GoogleConnectionPanel } from "@/components/GoogleConnectionPanel";
import { MorningBriefingSettings } from "@/components/MorningBriefingSettings";
import { PrivatePrototypeNotice } from "@/components/PrivatePrototypeNotice";
import { ResetOnboardingButton } from "@/components/ResetOnboardingButton";
import { UsageSummaryPanel } from "@/components/UsageSummaryPanel";
import { getGoogleConnectionState } from "@/lib/googleAuth";
import { briefingStyles, voiceOptions } from "@/lib/mockData";

type SettingsSearchParams = {
  connection?: string;
  error?: string;
};

function getConnectionMessage(params: SettingsSearchParams) {
  if (params.error) return "error";
  if (params.connection === "success") return "success";
  if (params.connection === "disconnected") return "disconnected";
  if (params.connection === "missing-config") return "missing-config";
  if (params.connection === "error") return "error";
  return undefined;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SettingsSearchParams>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const googleConnection = getGoogleConnectionState(session);
  const connectionMessage = getConnectionMessage(params);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-teal-300">Settings</p>
          <h1 className="mt-2 text-4xl font-semibold text-mist-50">Tune your briefing experience</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-mist-300">
            Connect Google, choose a briefing style, and manage privacy controls for the private prototype.
          </p>
        </div>

        <PrivatePrototypeNotice />

        <GoogleConnectionPanel connection={googleConnection} message={connectionMessage} />

        <UsageSummaryPanel />

        <MorningBriefingSettings />

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="surface-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
              <SlidersHorizontal className="h-4 w-4" />
              Briefing style
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {briefingStyles.map((style) => (
                <button
                  aria-pressed={style === "Executive"}
                  className={[
                    "focus-ring rounded-2xl border p-4 text-left text-sm font-medium transition",
                    style === "Executive"
                      ? "border-teal-300/[0.35] bg-teal-300/[0.12] text-teal-300"
                      : "border-white/10 bg-white/[0.045] text-mist-300 hover:bg-white/[0.075]",
                  ].join(" ")}
                  key={style}
                  type="button"
                >
                  {style}
                </button>
              ))}
            </div>
          </article>

          <article className="surface-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
              <Volume2 className="h-4 w-4" />
              Voice selection
            </div>
            <div className="mt-5 space-y-3">
              {voiceOptions.map((voice) => (
                <button
                  aria-pressed={voice === "Calm"}
                  className={[
                    "focus-ring flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-medium transition",
                    voice === "Calm"
                      ? "border-violet-300/[0.35] bg-violet-300/[0.12] text-violet-300"
                      : "border-white/10 bg-white/[0.045] text-mist-300 hover:bg-white/[0.075]",
                  ].join(" ")}
                  key={voice}
                  type="button"
                >
                  <span>{voice}</span>
                  <span className="text-xs text-mist-500">{voice === "Calm" ? "Selected" : "Preview"}</span>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="surface-card rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-ember-300">
            <ShieldAlert className="h-4 w-4" />
            Privacy
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-mist-500">
            InboxCast uses a secure Auth.js session cookie. It does not send email, does not ask for Gmail send or
            modify permissions, and only reads full email bodies after you explicitly select messages.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              className="secondary-button justify-start rounded-2xl px-4 py-4 text-left"
              href="https://myaccount.google.com/permissions"
              rel="noreferrer"
              target="_blank"
            >
              Manage Google permissions
            </a>
            <ResetOnboardingButton />
            <DeleteLocalDataButton />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
