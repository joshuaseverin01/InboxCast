import Link from "next/link";
import { LogIn, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { hasBetaAllowlist, isEmailAllowedForBeta } from "@/lib/betaAccess";
import { getGoogleOAuthAuthorizationParams, hasGoogleOAuthCredentials } from "@/lib/googleAuth";

type PrivateBetaSearchParams = {
  access?: string;
  reconnect?: string;
};

export default async function PrivateBetaPage({
  searchParams,
}: {
  searchParams: Promise<PrivateBetaSearchParams>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const signedInEmail = session?.user?.email ?? null;
  const allowed = isEmailAllowedForBeta(signedInEmail);
  const allowlistEnabled = hasBetaAllowlist();
  const denied = params.access === "denied" || (signedInEmail && !allowed);
  const reconnecting = params.reconnect === "google";

  return (
    <main className="min-h-screen bg-app-shell px-4 py-8 text-mist-50 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center">
        <div className="surface-card w-full rounded-[2rem] p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/[0.12] text-teal-300">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <p className="mt-6 text-sm font-medium text-teal-300">Private beta</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-mist-50">InboxCast full app access is limited.</h1>

          {reconnecting ? (
            <p className="mt-4 text-base leading-7 text-mist-300">
              Your local session was cleared. Sign back in to request fresh Google consent and approve any missing
              permissions.
            </p>
          ) : denied ? (
            <p className="mt-4 text-base leading-7 text-mist-300">
              InboxCast is currently in private beta. This account is not approved for full app access.
            </p>
          ) : (
            <p className="mt-4 text-base leading-7 text-mist-300">
              The public demo is available to everyone. The real app connects to Gmail and Calendar and requires private
              beta sign-in before access.
            </p>
          )}

          {signedInEmail && (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-mist-300">
              Signed in as <span className="font-semibold text-mist-50">{signedInEmail}</span>
              {allowlistEnabled ? " with beta allowlist enabled." : " with open authenticated beta access."}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!signedInEmail && (
              <form
                action={async () => {
                  "use server";

                  if (!hasGoogleOAuthCredentials()) {
                    redirect("/auth/error?error=Configuration");
                  }

                  await signIn(
                    "google",
                    { redirectTo: reconnecting ? "/settings?connection=success" : "/dashboard" },
                    getGoogleOAuthAuthorizationParams(),
                  );
                }}
              >
                <button className="primary-button w-full sm:w-auto" type="submit">
                  <LogIn className="h-4 w-4" />
                  Private Beta Sign In
                </button>
              </form>
            )}

            {signedInEmail && allowed && (
              <Link className="primary-button" href="/dashboard">
                Open dashboard
              </Link>
            )}

            <Link className="secondary-button" href="/demo">
              Back to demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
