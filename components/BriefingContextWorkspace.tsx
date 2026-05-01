"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
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
import { VoiceCommandButton, type VoiceCommandExecutionResult } from "@/components/VoiceCommandButton";
import { incrementUsageCount } from "@/lib/localUsage";
import {
  buildMorningBriefingRequest,
  morningBriefingLastRunStorageKey,
  readMorningBriefingPreset,
} from "@/lib/morningBriefing";
import { parseVoiceCommand } from "@/lib/voiceCommands";
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
type MorningStatus = "idle" | "fetching" | "generating" | "audio" | "ready" | "error";

type ContextError = {
  message: string;
  reconnectRequired?: boolean;
};

const briefingStyles: BriefingStyle[] = ["concise", "detailed", "executive", "casual podcast"];
const latestBriefingStorageKey = "inboxcast.latestBriefing";
const audioStateStorageKey = "inboxcast.audioState";
const pendingConciergeCommandKey = "inboxcast.pendingConciergeCommand";

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
    return "OpenAI is not configured. Add OPENAI_API_KEY in .env.local or Vercel environment variables, then restart or redeploy.";
  }

  if (message.toLowerCase().includes("quota") || message.toLowerCase().includes("billing")) {
    return "OpenAI quota or billing needs attention. Check the OpenAI project billing and usage limits, then try again.";
  }

  if (message.toLowerCase().includes("rate limit")) {
    return "OpenAI rate limit reached. Wait a moment, then try again.";
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

function AudioBriefingControls({
  commandNonce = 0,
  transcript,
}: {
  commandNonce?: number;
  transcript: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingAutoplay, setPendingAutoplay] = useState(false);
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

  useEffect(() => {
    if (!pendingAutoplay || !audioUrl || !audioRef.current) return;

    void audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setAudioError("Audio is ready. Tap Play if your browser blocks autoplay.");
      })
      .finally(() => setPendingAutoplay(false));
  }, [audioUrl, pendingAutoplay]);

  useEffect(() => {
    if (commandNonce === 0) return;

    if (audioUrl && audioRef.current) {
      void audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setAudioError("Audio is ready. Tap Play if your browser blocks autoplay."));
      return;
    }

    void generateAudio(true);
  }, [commandNonce]);

  async function generateAudio(autoplay = false) {
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

      setPendingAutoplay(autoplay);
      setAudioUrl(URL.createObjectURL(await response.blob()));
      incrementUsageCount("tts");
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
        <button className="secondary-button px-4 py-2" disabled={audioLoading} onClick={() => generateAudio()} type="button">
          {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {audioLoading ? "Generating audio" : audioUrl ? "Regenerate audio" : "Generate audio"}
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

function WrittenBriefingPanel({
  audioCommandNonce = 0,
  briefing,
}: {
  audioCommandNonce?: number;
  briefing: WrittenBriefing;
}) {
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

      <AudioBriefingControls commandNonce={audioCommandNonce} transcript={briefing.fullTranscript} />
    </section>
  );
}

export function BriefingContextWorkspace({
  showMorningBriefingAction = false,
  title = "Briefing preparation",
}: {
  showMorningBriefingAction?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [result, setResult] = useState<BriefingContextResponse | null>(null);
  const [error, setError] = useState<ContextError | null>(null);
  const [briefingStatus, setBriefingStatus] = useState<FetchStatus>("idle");
  const [briefing, setBriefing] = useState<WrittenBriefing | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingStyle, setBriefingStyle] = useState<BriefingStyle>("concise");
  const [commandRange, setCommandRange] = useState<TimeRangeSelectorValue | null>(null);
  const [audioCommandNonce, setAudioCommandNonce] = useState(0);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [morningStatus, setMorningStatus] = useState<MorningStatus>("idle");
  const [morningMessage, setMorningMessage] = useState<string | null>(null);
  const metrics = useMemo(() => metricCards(result), [result]);
  const morningInProgress =
    morningStatus === "fetching" || morningStatus === "generating" || morningStatus === "audio";

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

  async function fetchContext(
    value: TimeRangeSelectorValue,
    options?: { preserveMorningStatus?: boolean },
  ): Promise<BriefingContextResponse | null> {
    if (!options?.preserveMorningStatus) {
      setMorningStatus("idle");
      setMorningMessage(null);
    }
    setCommandRange(value);
    setStatus("loading");
    setResult(null);
    setError(null);
    setBriefing(null);
    setBriefingError(null);
    setBriefingStatus("idle");
    setRestoredAt(null);
    window.localStorage.removeItem(latestBriefingStorageKey);

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
      return payload;
    } catch (caught) {
      const nextError =
        caught && typeof caught === "object" && "message" in caught
          ? (caught as ContextError)
          : { message: "InboxCast could not fetch Google context." };
      setError({ ...nextError, message: friendlyError(nextError.message) });
      setStatus("error");
      return null;
    }
  }

  async function generateBriefing(context = result, style = briefingStyle): Promise<WrittenBriefing | null> {
    if (!context) return null;

    setBriefingStatus("loading");
    setBriefing(null);
    setBriefingError(null);

    try {
      const response = await fetch("/api/briefing/generate", {
        body: JSON.stringify({
          context,
          style,
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
      incrementUsageCount("briefing");
      const savedAt = new Date().toISOString();
      // Persist only generated briefing output for convenience. Raw Google metadata
      // stays in React state for the current page session and OAuth tokens are never stored here.
      window.localStorage.setItem(
        latestBriefingStorageKey,
        JSON.stringify({
          briefing: payload.briefing,
          savedAt,
        }),
      );
      window.localStorage.setItem(morningBriefingLastRunStorageKey, savedAt);
      setRestoredAt(savedAt);
      setBriefingStatus("success");
      return payload.briefing;
    } catch (caught) {
      setBriefing(null);
      const message = caught instanceof Error ? caught.message : "InboxCast could not generate the briefing.";
      setBriefingError(friendlyError(message));
      setBriefingStatus("error");
      return null;
    }
  }

  async function startMorningBriefing(command?: string): Promise<VoiceCommandExecutionResult> {
    const preset = readMorningBriefingPreset();
    const { rangeLabel, request, usedFallback } = buildMorningBriefingRequest(
      preset,
      window.localStorage.getItem(morningBriefingLastRunStorageKey),
    );

    setBriefingStyle(preset.briefingStyle);
    setMorningStatus("fetching");
    setMorningMessage(`Fetching email context for ${rangeLabel.toLowerCase()}...`);
    setCommandRange(request);

    const nextContext = await fetchContext(request, { preserveMorningStatus: true });

    if (!nextContext) {
      setMorningStatus("error");
      setMorningMessage("Could not fetch email context. Check the message below, then try again.");
      return {
        action: "Could not fetch email context. Check the message below, then try again.",
        heard: command ?? "Start morning briefing",
        intent: "Generate briefing",
        range: rangeLabel,
        status: "error",
      };
    }

    const emptyPresetRange = nextContext.summary.emailCount === 0 && nextContext.summary.calendarEventCount === 0;
    setMorningStatus("generating");
    setMorningMessage(
      emptyPresetRange
        ? "Nothing major found for this preset range. Generating a calm empty briefing..."
        : "Generating briefing...",
    );

    const nextBriefing = await generateBriefing(nextContext, preset.briefingStyle);

    if (!nextBriefing) {
      setMorningStatus("error");
      setMorningMessage("Fetched context, but briefing generation failed.");
      return {
        action: "Fetched context, but briefing generation failed.",
        heard: command ?? "Start morning briefing",
        intent: "Generate briefing",
        range: rangeLabel,
        status: "error",
      };
    }

    if (preset.generateAudioAfterBriefing) {
      setMorningStatus("audio");
      setMorningMessage("Preparing audio. This uses additional AI audio credits.");
      setAudioCommandNonce((current) => current + 1);
    }

    window.setTimeout(() => {
      setMorningStatus("ready");
      setMorningMessage(
        emptyPresetRange
          ? "Nothing major found for this preset range."
          : preset.generateAudioAfterBriefing
            ? "Ready to play."
            : "Ready to play. Generate audio below when you want to use audio credits.",
      );
    }, preset.generateAudioAfterBriefing ? 500 : 0);

    return {
      action: [
        emptyPresetRange ? "Nothing major found for this preset range." : "Fetched context and generated your morning briefing.",
        preset.generateAudioAfterBriefing ? "Audio is preparing." : "Audio was not generated automatically.",
        usedFallback ? "Since last briefing fell back to last 24 hours." : "",
      ]
        .filter(Boolean)
        .join(" "),
      heard: command ?? "Start morning briefing",
      intent: "Generate briefing",
      range: rangeLabel,
      status: "success",
    };
  }

  async function handleVoiceCommand(command: string): Promise<VoiceCommandExecutionResult> {
    const parsed = parseVoiceCommand(command);

    if (parsed.kind === "morning_briefing") {
      return startMorningBriefing(command);
    }

    if (parsed.kind === "generate_briefing") {
      setCommandRange(parsed.range);
      const nextContext = await fetchContext(parsed.range);

      if (!nextContext) {
        return {
          action: "Could not fetch email context. Check the message above, then try again.",
          heard: command,
          intent: parsed.intent,
          range: parsed.rangeLabel,
          status: "error",
        };
      }

      const nextBriefing = await generateBriefing(nextContext);

      return {
        action: nextBriefing ? "Fetched context and generated a written briefing." : "Fetched context, but briefing generation failed.",
        heard: command,
        intent: parsed.intent,
        range: parsed.rangeLabel,
        status: nextBriefing ? "success" : "error",
      };
    }

    if (parsed.kind === "audio") {
      if (!briefing) {
        return {
          action: "Generate a briefing first, then I can read it out loud.",
          heard: command,
          intent: parsed.intent,
          status: "error",
        };
      }

      setAudioCommandNonce((current) => current + 1);
      return {
        action: "Generating or playing the briefing audio.",
        heard: command,
        intent: parsed.intent,
        status: "success",
      };
    }

    if (parsed.kind === "concierge") {
      if (!briefing) {
        return {
          action: "Generate a briefing first so Concierge has your latest transcript.",
          heard: command,
          intent: parsed.intent,
          status: "error",
        };
      }

      window.sessionStorage.setItem(pendingConciergeCommandKey, parsed.prompt);
      router.push("/concierge");
      return {
        action: "Opening Concierge with your question.",
        heard: command,
        intent: parsed.intent,
        status: "success",
      };
    }

    if (parsed.kind === "navigate") {
      router.push(parsed.href);
      return {
        action: `Opening ${parsed.pageLabel}.`,
        heard: command,
        intent: parsed.intent,
        status: "success",
      };
    }

    return {
      action: parsed.message,
      heard: command,
      intent: parsed.intent,
      status: "error",
    };
  }

  function clearCurrentBriefing() {
    setResult(null);
    setError(null);
    setBriefing(null);
    setBriefingError(null);
    setBriefingStatus("idle");
    setStatus("idle");
    setRestoredAt(null);
    setMorningStatus("idle");
    setMorningMessage(null);
    window.localStorage.removeItem(latestBriefingStorageKey);
  }

  return (
    <section className="space-y-6">
      {showMorningBriefingAction && (
        <div className="surface-card rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
                <AlarmClock className="h-4 w-4" />
                One-tap preset
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-mist-50">Start morning briefing</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-mist-500">
                Uses your saved Settings preset to fetch Google context and generate a written briefing.
              </p>
            </div>
            <button
              className="primary-button shrink-0 px-5 py-3"
              disabled={morningInProgress || status === "loading" || briefingStatus === "loading"}
              onClick={() => {
                void startMorningBriefing();
              }}
              type="button"
            >
              {morningInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {morningInProgress ? "Starting briefing" : "Start morning briefing"}
            </button>
          </div>

          {morningMessage && (
            <div
              className={cn(
                "mt-4 rounded-3xl border p-4 text-sm leading-6",
                morningStatus === "error"
                  ? "border-ember-300/25 bg-ember-300/10 text-ember-300"
                  : morningStatus === "ready"
                    ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                    : "border-white/10 bg-white/[0.045] text-mist-300",
              )}
            >
              {morningMessage}
            </div>
          )}
        </div>
      )}

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

      <VoiceCommandButton
        disabled={morningInProgress || status === "loading" || briefingStatus === "loading"}
        onCommand={handleVoiceCommand}
      />

      <TimeRangeSelector
        loading={status === "loading"}
        onCreate={fetchContext}
        submitLabel="Fetch Google context"
        value={commandRange}
      />

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
                  onClick={() => generateBriefing()}
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

          {briefing && (
            <WrittenBriefingPanel
              audioCommandNonce={audioCommandNonce}
              briefing={briefing}
              key={briefing.fullTranscript}
            />
          )}

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
