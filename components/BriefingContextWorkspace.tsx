"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Copy,
  FileText,
  Inbox,
  Loader2,
  MailOpen,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
  Tag,
  Volume2,
} from "lucide-react";
import { TimeRangeSelector, type TimeRangeSelectorValue } from "@/components/TimeRangeSelector";
import type {
  BriefingContextErrorResponse,
  BriefingContextResponse,
  BriefingStyle,
  GmailMetadataMessage,
  GoogleCalendarEvent,
  WrittenBriefing,
  WrittenBriefingErrorResponse,
  WrittenBriefingResponse,
} from "@/lib/google/types";
import { cn } from "@/lib/utils";

type FetchStatus = "idle" | "loading" | "success" | "error";

type ContextError = {
  message: string;
  reconnectRequired?: boolean;
};

const briefingStyles: BriefingStyle[] = ["concise", "detailed", "executive", "casual podcast"];
const latestBriefingStorageKey = "inboxcast.latestBriefing";
const audioStateStorageKey = "inboxcast.audioState";

type StoredBriefing = {
  briefing: WrittenBriefing;
  savedAt: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function metricCards(result: BriefingContextResponse | null) {
  return [
    {
      detail: result ? "Metadata-only messages in the selected range" : "Choose a range to fetch real metadata",
      icon: Inbox,
      label: "Emails found",
      tone: "text-teal-300",
      value: result ? String(result.summary.emailCount) : "—",
    },
    {
      detail: result ? "Unread messages returned by Gmail metadata" : "Optional unread-only filter is available",
      icon: MailOpen,
      label: "Unread",
      tone: "text-violet-300",
      value: result ? String(result.summary.unreadEmailCount) : "—",
    },
    {
      detail: result ? "Primary calendar events in the selected range" : "Calendar can be toggled on or off",
      icon: CalendarDays,
      label: "Calendar events",
      tone: "text-ember-300",
      value: result ? String(result.summary.calendarEventCount) : "—",
    },
    {
      detail: result ? "Overlapping calendar events detected locally" : "Conflicts appear after fetching events",
      icon: CalendarClock,
      label: "Calendar conflicts",
      tone: "text-mist-100",
      value: result ? String(result.summary.calendarConflictCount) : "—",
    },
  ];
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <div className="surface-card rounded-[1.75rem] p-5" key={item}>
          <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-white/[0.08]" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-white/[0.08]" />
        </div>
      ))}
    </div>
  );
}

function friendlyError(message: string) {
  if (message.includes("OPENAI_API_KEY")) {
    return "OpenAI is not configured. Add OPENAI_API_KEY to .env.local, restart the dev server, and try again.";
  }

  if (message.toLowerCase().includes("reconnect")) {
    return "Google needs to be reconnected. Open Settings, reconnect your Google account, then fetch context again.";
  }

  return message;
}

function EmptyState({
  action,
  description,
  title,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="quiet-card rounded-[1.75rem] p-6 text-center">
      <p className="font-semibold text-mist-50">{title}</p>
      <p className="mt-2 text-sm leading-6 text-mist-500">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

function GmailMetadataCard({ message }: { message: GmailMetadataMessage }) {
  return (
    <article className="surface-card rounded-[1.75rem] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-teal-300">{message.from}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-mist-50">{message.subject}</h3>
          <p className="mt-2 text-sm text-mist-500">{formatDateTime(message.timestamp)}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-mist-300">
          Thread {message.threadId.slice(0, 8)}
        </div>
      </div>
      {message.snippet && <p className="mt-3 line-clamp-2 text-sm leading-6 text-mist-300">{message.snippet}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {message.labels.slice(0, 5).map((label) => (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs text-mist-500"
            key={label}
          >
            <Tag className="h-3 w-3" />
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

function CalendarEventCard({ event }: { event: GoogleCalendarEvent }) {
  return (
    <article className="surface-card rounded-[1.75rem] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-300/[0.12] text-violet-300">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-lg font-semibold text-mist-50">{event.title}</h3>
          <p className="mt-2 text-sm leading-6 text-mist-300">
            {formatDateTime(event.start)} – {formatDateTime(event.end)}
          </p>
          {event.location && <p className="mt-1 text-sm text-mist-500">{event.location}</p>}
          {event.descriptionSnippet && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-mist-500">{event.descriptionSnippet}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function AudioBriefingControls({ transcript }: { transcript: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(audioStateStorageKey);
      if (stored) setSpeed(JSON.parse(stored).speed ?? 1);
    } catch {
      setSpeed(1);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
    window.localStorage.setItem(audioStateStorageKey, JSON.stringify({ speed }));
  }, [speed]);

  async function generateAudio() {
    setAudioLoading(true);
    setAudioError(null);
    setIsPlaying(false);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const response = await fetch("/api/briefing/tts", {
        body: JSON.stringify({ fullTranscript: transcript }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "InboxCast could not generate audio.");
      }

      setAudioUrl(URL.createObjectURL(await response.blob()));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "InboxCast could not generate audio.";
      setAudioError(friendlyError(message));
    } finally {
      setAudioLoading(false);
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }

  function changeSpeed(value: number) {
    setSpeed(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }

  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
            <Volume2 className="h-4 w-4" />
            Audio briefing
          </div>
          <p className="mt-1 text-sm leading-6 text-mist-500">AI-generated voice. Audio is not stored.</p>
        </div>
        <button className="secondary-button px-4 py-2" disabled={audioLoading} onClick={generateAudio} type="button">
          {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {audioLoading ? "Generating audio" : "Generate audio"}
        </button>
      </div>

      {audioError && (
        <div className="mt-4 rounded-2xl border border-ember-300/25 bg-ember-300/10 p-3 text-sm leading-6 text-ember-300">
          {audioError}
        </div>
      )}

      {audioUrl && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/[0.48] p-3">
          <audio
            className="w-full"
            controls
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            ref={audioRef}
            src={audioUrl}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="secondary-button px-4 py-2 text-xs" onClick={togglePlayback} type="button">
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </button>
            {[1, 1.25, 1.5].map((value) => (
              <button
                className={cn(
                  "secondary-button px-3 py-2 text-xs",
                  speed === value && "border-teal-300/35 text-teal-300",
                )}
                key={value}
                onClick={() => changeSpeed(value)}
                type="button"
              >
                {value}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WrittenBriefingPanel({ briefing }: { briefing: WrittenBriefing }) {
  const [copied, setCopied] = useState(false);
  const sections = [
    ["Priority emails", briefing.priorityEmails],
    ["Action items", briefing.actionItems],
    ["Calendar context", briefing.calendarContext],
    ["Low-priority FYI", briefing.lowPriorityFYI],
    ["Suggested next steps", briefing.suggestedNextSteps],
  ] as const;

  async function copyTranscript() {
    await navigator.clipboard?.writeText(briefing.fullTranscript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="surface-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
            <FileText className="h-4 w-4" />
            Written briefing
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-mist-50">Generated transcript</h2>
        </div>
        <button className="secondary-button px-4 py-2 text-xs" onClick={copyTranscript} type="button">
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy transcript"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-mist-300">{briefing.intro}</p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {sections.map(([title, items]) => (
          <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-4" key={title}>
            <h3 className="text-sm font-semibold text-mist-50">{title}</h3>
            {items.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-mist-500">Nothing notable in this section.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <li className="text-sm leading-6 text-mist-300" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-ink-950/[0.48] p-4">
        <h3 className="text-sm font-semibold text-mist-50">Full transcript</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-mist-300">{briefing.fullTranscript}</p>
      </div>

      <AudioBriefingControls transcript={briefing.fullTranscript} />
    </section>
  );
}

export function BriefingContextWorkspace({
  title = "Briefing preparation",
}: {
  title?: string;
}) {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [result, setResult] = useState<BriefingContextResponse | null>(null);
  const [error, setError] = useState<ContextError | null>(null);
  const [briefingStatus, setBriefingStatus] = useState<FetchStatus>("idle");
  const [briefing, setBriefing] = useState<WrittenBriefing | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingStyle, setBriefingStyle] = useState<BriefingStyle>("concise");
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const metrics = useMemo(() => metricCards(result), [result]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(latestBriefingStorageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored) as StoredBriefing & { context?: BriefingContextResponse };
      setBriefing(parsed.briefing);
      setRestoredAt(parsed.savedAt);
      setBriefingStatus("success");
      // Keep localStorage limited to generated briefing output. Older cached raw
      // Gmail/Calendar metadata is ignored and removed during this migration.
      window.localStorage.setItem(
        latestBriefingStorageKey,
        JSON.stringify({
          briefing: parsed.briefing,
          savedAt: parsed.savedAt,
        }),
      );
    } catch {
      window.localStorage.removeItem(latestBriefingStorageKey);
    }
  }, []);

  async function fetchContext(value: TimeRangeSelectorValue) {
    setStatus("loading");
    setError(null);
    setBriefing(null);
    setBriefingError(null);
    setBriefingStatus("idle");
    setRestoredAt(null);

    try {
      const response = await fetch("/api/google/briefing-context", {
        body: JSON.stringify(value),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as BriefingContextResponse | BriefingContextErrorResponse;

      if (!response.ok || "error" in payload) {
        const nextError = "error" in payload ? payload.error : undefined;
        throw {
          message: nextError?.message ?? "InboxCast could not fetch Google context.",
          reconnectRequired: nextError?.reconnectRequired,
        } satisfies ContextError;
      }

      setResult(payload);
      setStatus("success");
    } catch (caught) {
      const nextError =
        caught && typeof caught === "object" && "message" in caught
          ? (caught as ContextError)
          : { message: "InboxCast could not fetch Google context." };
      setError({ ...nextError, message: friendlyError(nextError.message) });
      setStatus("error");
    }
  }

  async function generateBriefing() {
    if (!result) return;

    setBriefingStatus("loading");
    setBriefing(null);
    setBriefingError(null);

    try {
      const response = await fetch("/api/briefing/generate", {
        body: JSON.stringify({
          context: result,
          style: briefingStyle,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as WrittenBriefingResponse | WrittenBriefingErrorResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error.message : "InboxCast could not generate the briefing.");
      }

      setBriefing(payload.briefing);
      // Persist only generated briefing output for convenience. Raw Google metadata
      // stays in React state for the current page session and OAuth tokens are never stored here.
      window.localStorage.setItem(
        latestBriefingStorageKey,
        JSON.stringify({
          briefing: payload.briefing,
          savedAt: new Date().toISOString(),
        }),
      );
      setRestoredAt(new Date().toISOString());
      setBriefingStatus("success");
    } catch (caught) {
      setBriefing(null);
      const message = caught instanceof Error ? caught.message : "InboxCast could not generate the briefing.";
      setBriefingError(friendlyError(message));
      setBriefingStatus("error");
    }
  }

  function clearCurrentBriefing() {
    setResult(null);
    setError(null);
    setBriefing(null);
    setBriefingError(null);
    setBriefingStatus("idle");
    setStatus("idle");
    setRestoredAt(null);
    window.localStorage.removeItem(latestBriefingStorageKey);
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="surface-card rounded-[1.75rem] p-4 sm:p-5" key={metric.label}>
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]", metric.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-3xl font-semibold text-mist-50">{metric.value}</div>
              <h3 className="mt-1 text-sm font-medium text-mist-100">{metric.label}</h3>
              <p className="mt-2 text-sm leading-5 text-mist-500">{metric.detail}</p>
            </article>
          );
        })}
      </div>

      {(result || briefing) && (
        <div className="surface-card rounded-[1.75rem] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-mist-300">
              {restoredAt
                ? `Current briefing restored from ${formatDateTime(restoredAt)}.`
                : "Current briefing is active in this browser."}
            </p>
            <button className="secondary-button px-4 py-2 text-xs" onClick={clearCurrentBriefing} type="button">
              Clear current briefing
            </button>
          </div>
        </div>
      )}

      <TimeRangeSelector loading={status === "loading"} onCreate={fetchContext} submitLabel="Fetch Google context" />

      {error && (
        <div className="surface-card rounded-[1.75rem] border-ember-300/25 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-ember-300" />
            <div>
              <h2 className="font-semibold text-mist-50">Could not fetch context</h2>
              <p className="mt-2 text-sm leading-6 text-mist-300">{error.message}</p>
              {error.reconnectRequired && (
                <Link className="secondary-button mt-4 px-4 py-2" href="/settings">
                  <RefreshCcw className="h-4 w-4" />
                  Reconnect Google account
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "loading" && <LoadingSkeleton />}

      {result && status === "success" && (
        <>
          <section className="surface-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
                  <Sparkles className="h-4 w-4" />
                  AI written briefing
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">Generate a written transcript</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
                  Uses the fetched metadata and calendar snippets only. No full email bodies, audio, or sending.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  className="field sm:w-48"
                  onChange={(event) => setBriefingStyle(event.target.value as BriefingStyle)}
                  value={briefingStyle}
                >
                  {briefingStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
                <button
                  className="primary-button"
                  disabled={briefingStatus === "loading"}
                  onClick={generateBriefing}
                  type="button"
                >
                  {briefingStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {briefingStatus === "loading" ? "Generating" : "Generate briefing"}
                </button>
              </div>
            </div>

            {briefingError && (
              <div className="mt-5 rounded-3xl border border-ember-300/25 bg-ember-300/10 p-4 text-sm leading-6 text-ember-300">
                {briefingError}
              </div>
            )}

            {briefingStatus === "loading" && (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                <div className="h-3 w-44 animate-pulse rounded-full bg-white/10" />
                <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-white/[0.08]" />
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
              </div>
            )}
          </section>

          {briefing && <WrittenBriefingPanel briefing={briefing} />}

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4">
              <div>
                <p className="text-sm font-medium text-teal-300">{title}</p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">Fetched Gmail metadata</h2>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  Showing message metadata only: sender, subject, timestamp, labels, thread ID, and snippet when Gmail
                  returns one.
                </p>
              </div>
              {result.gmail.messages.length === 0 ? (
                <EmptyState
                  description="No metadata matched this range. Try a wider time window, disable unread-only, or include newsletter and promotion filters."
                  title="No Gmail metadata found"
                />
              ) : (
                <div className="space-y-3">
                  {result.gmail.messages.map((message) => (
                    <GmailMetadataCard key={message.id} message={message} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-sm font-medium text-violet-300">Calendar context</p>
                <h2 className="mt-2 text-2xl font-semibold text-mist-50">Events in this range</h2>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  Events are fetched read-only from your primary Google Calendar. Descriptions are returned as short
                  snippets only.
                </p>
              </div>
              {result.calendar.skipped ? (
                <EmptyState description="Turn on Include calendar in the selector and fetch again to add calendar context." title="Calendar skipped" />
              ) : result.calendar.events.length === 0 ? (
                <EmptyState description="No events were returned for this range. Try a wider window if you expected meetings." title="No calendar events found" />
              ) : (
                <div className="space-y-3">
                  {result.calendar.events.map((event) => (
                    <CalendarEventCard event={event} key={event.id} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
