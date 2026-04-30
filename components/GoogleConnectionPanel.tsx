import { AlertTriangle, CalendarCheck, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { ConnectGoogleAccountButton, DisconnectGoogleAccountButton } from "@/components/GoogleAccountActions";
import { GOOGLE_SCOPE_DESCRIPTIONS, type GoogleConnectionState, hasGoogleOAuthCredentials } from "@/lib/googleAuth";
import { cn } from "@/lib/utils";

type ConnectionMessage = "success" | "disconnected" | "missing-config" | "error" | undefined;

function messageCopy(message: ConnectionMessage) {
  if (message === "success") {
    return {
      tone: "success",
      text: "Google account connected. Gmail metadata, selected email read-only, Gmail draft creation, and Calendar read-only scopes are ready.",
    };
  }

  if (message === "disconnected") {
    return {
      tone: "neutral",
      text: "Local InboxCast session disconnected. You can also revoke app access from your Google Account permissions page.",
    };
  }

  if (message === "missing-config") {
    return {
      tone: "warning",
      text: "Google OAuth environment variables are missing. Add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, then restart the dev server.",
    };
  }

  if (message === "error") {
    return {
      tone: "warning",
      text: "Google connection did not complete. In Google Cloud, confirm the OAuth redirect URI, test-user access, Gmail API, Calendar API, and requested scopes, then reconnect.",
    };
  }

  return null;
}

export function GoogleConnectionPanel({
  connection,
  message,
}: {
  connection: GoogleConnectionState;
  message?: ConnectionMessage;
}) {
  const configured = hasGoogleOAuthCredentials();
  const statusMessage = messageCopy(message);

  return (
    <section className="surface-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
            <ShieldCheck className="h-4 w-4" />
            Google account connection
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-mist-50">
            {connection.connected ? "Google is connected" : "Connect Google to unlock real briefings"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
            InboxCast keeps Google API calls server-side and keeps OAuth tokens out of browser-readable session data.
            Full email bodies are not fetched.
          </p>
        </div>
        <div
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium",
            connection.connected
              ? "border-teal-300/30 bg-teal-300/10 text-teal-300"
              : "border-ember-300/30 bg-ember-300/10 text-ember-300",
          )}
        >
          {connection.connected ? "Connected" : "Not connected"}
        </div>
      </div>

      {statusMessage && (
        <div
          className={cn(
            "mt-5 flex gap-3 rounded-3xl border p-4 text-sm leading-6",
            statusMessage.tone === "success"
              ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
              : "border-ember-300/25 bg-ember-300/10 text-ember-300",
          )}
        >
          {statusMessage.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-300/[0.12] text-teal-300">
              <MailCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-mist-50">Gmail</h3>
              <p className="truncate text-sm text-mist-500">{connection.email ?? "No account connected"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/[0.48] p-3 text-sm leading-6 text-mist-300">
            {connection.gmailConnected && connection.gmailReadonlyConnected && connection.gmailDraftConnected
              ? "Connected with metadata, selected full-read, and user-approved draft creation. No send or modify scope."
              : connection.gmailConnected && connection.gmailReadonlyConnected
                ? "Metadata and selected full-read access are connected. Reconnect to approve Gmail draft creation."
              : connection.gmailConnected
                ? "Metadata access is connected. Reconnect to approve selected email read-only and draft creation."
                : "Waiting for Gmail metadata, selected read-only, and draft permissions."}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-300/[0.12] text-violet-300">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-mist-50">Google Calendar</h3>
              <p className="truncate text-sm text-mist-500">{connection.email ?? "No account connected"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/[0.48] p-3 text-sm leading-6 text-mist-300">
            {connection.calendarConnected
              ? "Connected with events read-only access. No calendar write permission."
              : "Waiting for Calendar events read-only permission."}
          </div>
        </article>
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
        <p className="text-sm font-medium text-mist-100">Requested scopes</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {GOOGLE_SCOPE_DESCRIPTIONS.map((scope) => (
            <div className="rounded-2xl bg-ink-950/[0.42] p-3" key={scope.scope}>
              <p className="text-sm font-semibold text-mist-50">{scope.label}</p>
              <p className="mt-1 text-sm leading-6 text-mist-500">{scope.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {connection.connected ? (
          <>
            {!connection.hasAllRequiredScopes && (
              <ConnectGoogleAccountButton label="Reconnect with required scopes" reconnect />
            )}
            <DisconnectGoogleAccountButton />
          </>
        ) : (
          <ConnectGoogleAccountButton />
        )}
      </div>

      {!configured && (
        <p className="mt-3 text-sm leading-6 text-ember-300">
          Add Google OAuth credentials to enable the connection button.
        </p>
      )}
    </section>
  );
}
