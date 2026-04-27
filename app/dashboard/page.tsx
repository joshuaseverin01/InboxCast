import Link from "next/link";
import { ArrowRight, CalendarCheck, MailCheck, Play, WandSparkles } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { BriefingContextWorkspace } from "@/components/BriefingContextWorkspace";
import { ConnectGoogleAccountButton, DisconnectGoogleAccountButton } from "@/components/GoogleAccountActions";
import { PrivatePrototypeNotice } from "@/components/PrivatePrototypeNotice";
import { getGoogleConnectionState } from "@/lib/googleAuth";
import { briefingOptions } from "@/lib/mockData";

export default async function DashboardPage() {
  const session = await auth();
  const googleConnection = getGoogleConnectionState(session);

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="space-y-6">
          <section className="surface-card rounded-[2rem] p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-teal-300">Good morning</p>
                <h1 className="mt-2 text-4xl font-semibold text-mist-50">Ready for your inbox briefing?</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-mist-300">
                  Select a time range to fetch real Gmail metadata and Google Calendar context for briefing prep.
                </p>
              </div>
              <Link className="primary-button shrink-0" href="/briefing">
                <Play className="h-4 w-4 fill-current" />
                Generate Briefing
              </Link>
            </div>
          </section>

          <BriefingContextWorkspace title="Dashboard context" />

          <PrivatePrototypeNotice />

          <section className="surface-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-violet-300">Quick briefing options</p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">Choose a listening window</h2>
              </div>
              <Link className="secondary-button px-4 py-2" href="/briefing/new">
                Custom range
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {briefingOptions.map((option) => (
                <Link
                  className="focus-ring rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-white/[0.18] hover:bg-white/[0.075]"
                  href={option.id === "custom" ? "/briefing/new" : "/briefing"}
                  key={option.id}
                >
                  <h3 className="text-base font-semibold text-mist-50">{option.label}</h3>
                  <p className="mt-2 text-sm leading-5 text-mist-500">{option.description}</p>
                </Link>
              ))}
            </div>
          </section>

        </div>

        <aside className="space-y-6">
          <section className="surface-card rounded-[2rem] p-5">
            <p className="text-sm font-medium text-teal-300">Google account</p>
            <div className="mt-5 rounded-3xl border border-white/10 bg-ink-950/[0.48] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/[0.12] text-teal-300">
                  <MailCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-mist-50">
                    {googleConnection.email ?? "No account connected"}
                  </p>
                  <p className="text-sm text-mist-500">
                    {googleConnection.connected ? "OAuth session connected" : "Not connected yet"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3 py-2 text-sm text-mist-300">
                <CalendarCheck className="h-4 w-4 text-violet-300" />
                {googleConnection.calendarConnected
                  ? "Calendar events read-only connected"
                  : "Calendar permission waiting"}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {googleConnection.connected ? (
                  <DisconnectGoogleAccountButton className="justify-center px-4 py-2 text-xs" />
                ) : (
                  <ConnectGoogleAccountButton className="justify-center px-4 py-2 text-xs" />
                )}
              </div>
            </div>
          </section>

          <section className="surface-card rounded-[2rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-violet-300">Recent briefings</p>
                <h2 className="mt-2 text-xl font-semibold text-mist-50">Current briefing</h2>
              </div>
              <WandSparkles className="h-5 w-5 text-mist-700" />
            </div>
            <div className="mt-5 space-y-3">
              <Link
                className="focus-ring block rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition hover:bg-white/[0.075]"
                href="/briefing"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-mist-50">Open latest local briefing</p>
                    <p className="mt-1 text-sm leading-6 text-mist-500">
                      Generated briefings are restored from this browser after you create one.
                    </p>
                  </div>
                  <Play className="h-4 w-4 fill-current text-teal-300" />
                </div>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
