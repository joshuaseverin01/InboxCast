import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="surface-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-300/10 text-ember-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="mt-5 text-sm font-medium text-ember-300">Connection failed</p>
          <h1 className="mt-2 text-3xl font-semibold text-mist-50">Google did not finish connecting</h1>
          <p className="mt-3 text-sm leading-6 text-mist-300">
            InboxCast could not complete the OAuth flow. This usually means the OAuth redirect URI, test user,
            consent screen, or environment variables need a quick check.
          </p>
          {params.error && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-ink-950/[0.48] p-4 text-sm text-mist-300">
              Auth error: <span className="text-mist-50">{params.error}</span>
            </div>
          )}
          <Link className="secondary-button mt-6" href="/settings?connection=error">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
