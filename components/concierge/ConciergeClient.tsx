"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Loader2, MailOpen, MailPlus, Save, SendHorizonal, Sparkles, Trash2, UserRound } from "lucide-react";
import type {
  BriefingContextErrorResponse,
  BriefingContextRequest,
  BriefingContextResponse,
  GmailFullMessageContent,
  GmailMetadataMessage,
  WrittenBriefing,
} from "@/lib/google/types";
import { incrementUsageCount } from "@/lib/localUsage";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type LatestBriefing = {
  context?: BriefingContextResponse | null;
  briefing: WrittenBriefing;
  savedAt: string;
};

type SavedOutput = {
  id: string;
  type: string;
  title: string;
  linkedEmail: string;
  createdDate: string;
  content: string;
};

const latestBriefingStorageKey = "inboxcast.latestBriefing";
const outputsStorageKey = "inboxcast.outputs";
const pendingConciergeCommandKey = "inboxcast.pendingConciergeCommand";
const suggestions = [
  "What needs my attention from the last 24 hours?",
  "Draft replies for important emails from today",
  "Turn action items into a plan since yesterday",
];

const defaultFilters = {
  includeCalendar: true,
  includeNewsletters: true,
  includePromotions: false,
  includeUnreadOnly: false,
};

const weekdays = [
  { day: 0, label: "Sunday", pattern: /\bsince sunday\b/ },
  { day: 1, label: "Monday", pattern: /\bsince monday\b/ },
  { day: 2, label: "Tuesday", pattern: /\bsince tuesday\b/ },
  { day: 3, label: "Wednesday", pattern: /\bsince wednesday\b/ },
  { day: 4, label: "Thursday", pattern: /\bsince thursday\b/ },
  { day: 5, label: "Friday", pattern: /\bsince friday\b/ },
  { day: 6, label: "Saturday", pattern: /\bsince saturday\b/ },
];

type ParsedContextQuestion = {
  kind: "simple_list" | "reasoning";
  range: BriefingContextRequest;
  rangeLabel: string;
  target: "email" | "calendar" | "both";
};

type FullReadStatus = {
  state: "loading" | "success" | "error";
  message: string;
};

type ReadMessagesResponse = {
  messages?: GmailFullMessageContent[];
  error?: {
    message?: string;
  };
};

type ReplyDraftState = {
  email: GmailFullMessageContent;
  instruction: string;
  replyBody: string;
  status: FullReadStatus | null;
  showDraftConfirm: boolean;
  draftTo: string;
  draftSubject: string;
  draftStatus: FullReadStatus | null;
  copied: boolean;
  saved: boolean;
};

const MAX_SELECTED_EMAILS = 3;

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

  return message;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function contextRange(start: Date, end: Date): BriefingContextRequest {
  return {
    end: end.toISOString(),
    filters: defaultFilters,
    start: start.toISOString(),
  };
}

function normalizeQuestion(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseClock(hourValue?: string, minuteValue?: string, meridiem?: string) {
  if (!hourValue) return null;

  let hour = Number(hourValue);
  const minute = Number(minuteValue ?? "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return { hour, minute };
}

function applyClock(date: Date, clock: { hour: number; minute: number }) {
  const next = new Date(date);
  next.setHours(clock.hour, clock.minute, 0, 0);
  return next;
}

function formatClockLabel(clock: { hour: number; minute: number }) {
  const date = new Date();
  date.setHours(clock.hour, clock.minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseTimeRange(question: string, now = new Date()) {
  const normalized = normalizeQuestion(question);
  const end = new Date(now);
  const timePattern = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?";
  const sinceYesterdayAt = normalized.match(new RegExp(`\\bsince yesterday(?: at)?\\s+${timePattern}\\b`));
  const sinceTimeYesterday = normalized.match(new RegExp(`\\bsince\\s+${timePattern}\\s+yesterday\\b`));
  const explicitYesterday = sinceYesterdayAt ?? sinceTimeYesterday;

  if (explicitYesterday) {
    const clock = parseClock(explicitYesterday[1], explicitYesterday[2], explicitYesterday[3]);

    if (clock) {
      const start = startOfDay(end);
      start.setDate(start.getDate() - 1);
      return {
        label: `Since ${formatClockLabel(clock)} yesterday`,
        value: contextRange(applyClock(start, clock), end),
      };
    }
  }

  if (normalized.includes("last 24 hours")) {
    return {
      label: "Last 24 hours",
      value: contextRange(new Date(end.getTime() - 24 * 60 * 60 * 1000), end),
    };
  }

  if (normalized.includes("last 7 days")) {
    return {
      label: "Last 7 days",
      value: contextRange(new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000), end),
    };
  }

  if (normalized.includes("since yesterday")) {
    const start = startOfDay(end);
    start.setDate(start.getDate() - 1);
    return {
      label: "Since yesterday",
      value: contextRange(start, end),
    };
  }

  if (normalized.includes("this morning")) {
    return {
      label: "This morning",
      value: contextRange(startOfDay(end), end),
    };
  }

  if (normalized.includes("today")) {
    return {
      label: "Today",
      value: contextRange(startOfDay(end), end),
    };
  }

  const weekday = weekdays.find((item) => item.pattern.test(normalized));
  if (weekday) {
    const start = startOfDay(end);
    const delta = (start.getDay() - weekday.day + 7) % 7;
    start.setDate(start.getDate() - delta);
    return {
      label: `Since ${weekday.label}`,
      value: contextRange(start, end),
    };
  }

  return null;
}

function parseContextQuestion(question: string): ParsedContextQuestion | null {
  const range = parseTimeRange(question);
  if (!range) return null;

  const normalized = normalizeQuestion(question);
  const asksEmail = /\b(email|emails|inbox|message|messages)\b/.test(normalized);
  const asksCalendar = /\b(calendar|cal|meeting|meetings|event|events|schedule|conflict|conflicts)\b/.test(normalized);
  const asksReasoning =
    /\b(needs? (my )?attention|needs? a response|need a response|important|priority|priorities|action items?|tasks?|follow up|follow-up|respond|reply|draft|plan|conflicts?)\b/.test(
      normalized,
    );

  if (!asksEmail && !asksCalendar && !asksReasoning) return null;

  const asksSimpleEmailList =
    asksEmail &&
    /\b(what|which|list|show)\b/.test(normalized) &&
    /\b(received|receive|got|get|came in|arrived)\b/.test(normalized) &&
    !asksReasoning;
  const asksSimpleCalendarList =
    asksCalendar && /\b(what|which|list|show)\b/.test(normalized) && !asksReasoning;

  return {
    kind: asksSimpleEmailList || asksSimpleCalendarList ? "simple_list" : "reasoning",
    range: range.value,
    rangeLabel: range.label,
    target: asksEmail && asksCalendar ? "both" : asksCalendar && !asksEmail ? "calendar" : "email",
  };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatEmailList(context: BriefingContextResponse, rangeLabel: string) {
  const emails = context.gmail.messages;
  if (emails.length === 0) {
    return `I checked ${rangeLabel.toLowerCase()} and found no emails in that range.`;
  }

  const lines = emails.map((email, index) =>
    [
      `${index + 1}. ${email.from}`,
      `Subject: ${email.subject}`,
      `Time: ${formatTimestamp(email.timestamp)}`,
      `Snippet: ${email.snippet || "No snippet was returned for this message."}`,
    ].join("\n"),
  );

  return [
    `I checked ${rangeLabel.toLowerCase()} and found ${emails.length} email${emails.length === 1 ? "" : "s"}:`,
    ...lines,
    "I only have Gmail metadata and preview snippets here, not full email bodies.",
  ].join("\n\n");
}

function formatCalendarList(context: BriefingContextResponse, rangeLabel: string) {
  const events = context.calendar.events;
  if (events.length === 0) {
    return `I checked ${rangeLabel.toLowerCase()} and found no calendar events in that range.`;
  }

  const lines = events.map((event, index) =>
    [
      `${index + 1}. ${event.title}`,
      `Time: ${formatTimestamp(event.start)} - ${formatTimestamp(event.end)}`,
      event.location ? `Location: ${event.location}` : null,
      event.descriptionSnippet ? `Snippet: ${event.descriptionSnippet}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [`I checked ${rangeLabel.toLowerCase()} and found ${events.length} calendar event${events.length === 1 ? "" : "s"}:`, ...lines].join(
    "\n\n",
  );
}

function formatSimpleContextAnswer(context: BriefingContextResponse, intent: ParsedContextQuestion) {
  if (intent.target === "calendar") return formatCalendarList(context, intent.rangeLabel);
  if (intent.target === "both") {
    return `${formatEmailList(context, intent.rangeLabel)}\n\n${formatCalendarList(context, intent.rangeLabel)}`;
  }
  return formatEmailList(context, intent.rangeLabel);
}

function compactEmailPreview(email: GmailMetadataMessage) {
  return email.snippet || "No snippet was returned for this message.";
}

function extractEmailAddress(from: string) {
  const bracketed = from.match(/<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/);
  if (bracketed?.[1]) return bracketed[1];

  return from.match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/)?.[0] ?? "";
}

function replySubject(subject: string) {
  const trimmed = subject.trim() || "(No subject)";
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function loadOutputs() {
  try {
    return JSON.parse(window.localStorage.getItem(outputsStorageKey) ?? "[]") as SavedOutput[];
  } catch {
    return [];
  }
}

function saveOutput(
  content: string,
  options?: {
    linkedEmail?: string;
    title?: string;
    type?: string;
  },
) {
  const outputs = loadOutputs();
  const nextOutput: SavedOutput = {
    content,
    createdDate: new Date().toLocaleString(),
    id: crypto.randomUUID(),
    linkedEmail: options?.linkedEmail ?? "Latest briefing",
    title: options?.title ?? content.split("\n")[0]?.slice(0, 72) ?? "Concierge response",
    type: options?.type ?? "Concierge response",
  };
  window.localStorage.setItem(outputsStorageKey, JSON.stringify([nextOutput, ...outputs]));
}

export function ConciergeClient() {
  const [latest, setLatest] = useState<LatestBriefing | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [lastContext, setLastContext] = useState<BriefingContextResponse | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [fullMessages, setFullMessages] = useState<GmailFullMessageContent[]>([]);
  const [fullReadStatus, setFullReadStatus] = useState<FullReadStatus | null>(null);
  const [replyDraft, setReplyDraft] = useState<ReplyDraftState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Concierge is thinking");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function fetchContextForQuestion(range: BriefingContextRequest) {
    const response = await fetch("/api/google/briefing-context", {
      body: JSON.stringify(range),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as BriefingContextResponse | BriefingContextErrorResponse;

    if (!response.ok || "error" in payload) {
      const message = "error" in payload ? payload.error.message : "InboxCast could not fetch Google context.";
      throw new Error(message);
    }

    return payload;
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((current) => {
      if (current.includes(messageId)) return current.filter((id) => id !== messageId);
      if (current.length >= MAX_SELECTED_EMAILS) return current;
      return [...current, messageId];
    });
  }

  function clearConversation() {
    setMessages([]);
    setInput("");
    setError(null);
    setSavedId(null);
    setLastContext(null);
    setSelectedMessageIds([]);
    setFullMessages([]);
    setFullReadStatus(null);
    setReplyDraft(null);
  }

  async function readSelectedEmails(messageIds: string[]) {
    if (messageIds.length === 0) {
      setFullReadStatus({ message: "Select at least one email to read.", state: "error" });
      return;
    }

    if (messageIds.length > MAX_SELECTED_EMAILS) {
      setFullReadStatus({ message: `Select up to ${MAX_SELECTED_EMAILS} emails at a time.`, state: "error" });
      return;
    }

    setFullReadStatus({ message: "Reading selected email content...", state: "loading" });
    setError(null);

    try {
      const response = await fetch("/api/google/messages/read", {
        body: JSON.stringify({ messageIds }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ReadMessagesResponse | null;

      if (!response.ok || !payload?.messages) {
        throw new Error(payload?.error?.message ?? "InboxCast could not read the selected email content.");
      }

      const readMessages = payload.messages;
      setFullMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        for (const message of readMessages) {
          byId.set(message.id, message);
        }
        return Array.from(byId.values()).slice(0, MAX_SELECTED_EMAILS);
      });
      setSelectedMessageIds([]);
      setFullReadStatus({
        message: "Selected email content is available for follow-up questions in this conversation.",
        state: "success",
      });
      setMessages((current) => [
        ...current,
        {
          content: `Full-read context approved for ${readMessages
            .map((message) => `"${message.subject}" from ${message.from}`)
            .join(", ")}. Ask a follow-up when you're ready.`,
          id: crypto.randomUUID(),
          role: "assistant",
        },
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "InboxCast could not read the selected email content.";
      setFullReadStatus({ message: friendlyError(message), state: "error" });
    }
  }

  function startReplyDraft(email: GmailFullMessageContent) {
    setReplyDraft({
      copied: false,
      draftStatus: null,
      draftSubject: replySubject(email.subject),
      draftTo: extractEmailAddress(email.from),
      email,
      instruction: "",
      replyBody: "",
      saved: false,
      showDraftConfirm: false,
      status: null,
    });
  }

  async function generateReplyDraft() {
    if (!replyDraft) {
      setError("Read a full email before drafting a reply.");
      return;
    }

    setReplyDraft((current) =>
      current
        ? {
            ...current,
            copied: false,
            draftStatus: null,
            replyBody: "",
            saved: false,
            showDraftConfirm: false,
            status: { message: "Drafting reply...", state: "loading" },
          }
        : current,
    );
    setError(null);

    try {
      const instruction = replyDraft.instruction.trim() || "Keep it concise, professional, and natural.";
      const response = await fetch("/api/concierge/chat", {
        body: JSON.stringify({
          fullMessages: [replyDraft.email],
          messages: [
            {
              content: [
                "Draft a reply to the selected full-read email.",
                `User instruction: ${instruction}`,
                "Use only the selected email content and this instruction. Do not invent facts.",
                "Return only the reply body.",
              ].join("\n"),
              role: "user",
            },
          ],
          task: "reply_draft",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;

      if (!response.ok || !payload?.message) {
        throw new Error(payload?.error?.message ?? "Concierge could not generate a reply draft.");
      }

      const replyBody = payload.message.trim();
      incrementUsageCount("concierge");
      setReplyDraft((current) =>
        current
          ? {
              ...current,
              replyBody,
              status: { message: "Reply draft ready. Review and edit before creating a Gmail draft.", state: "success" },
            }
          : current,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Concierge could not generate a reply draft.";
      setReplyDraft((current) =>
        current ? { ...current, status: { message: friendlyError(message), state: "error" } } : current,
      );
    }
  }

  async function copyReplyDraft() {
    if (!replyDraft?.replyBody.trim()) return;
    await navigator.clipboard?.writeText(replyDraft.replyBody);
    setReplyDraft((current) => (current ? { ...current, copied: true } : current));
    window.setTimeout(() => {
      setReplyDraft((current) => (current ? { ...current, copied: false } : current));
    }, 1200);
  }

  function saveReplyDraftToOutputs() {
    if (!replyDraft?.replyBody.trim()) return;

    saveOutput(replyDraft.replyBody, {
      linkedEmail: `${replyDraft.email.from} - ${replyDraft.email.subject}`,
      title: `Reply draft: ${replyDraft.email.subject}`.slice(0, 90),
      type: "Draft reply",
    });
    setReplyDraft((current) => (current ? { ...current, saved: true } : current));
  }

  async function createGmailDraftFromReply() {
    if (!replyDraft) return;

    if (!replyDraft.draftTo.trim()) {
      setReplyDraft((current) =>
        current ? { ...current, draftStatus: { message: "Add a recipient before creating a Gmail draft.", state: "error" } } : current,
      );
      return;
    }

    if (!replyDraft.draftSubject.trim()) {
      setReplyDraft((current) =>
        current ? { ...current, draftStatus: { message: "Add a subject before creating a Gmail draft.", state: "error" } } : current,
      );
      return;
    }

    if (!replyDraft.replyBody.trim()) {
      setReplyDraft((current) =>
        current ? { ...current, draftStatus: { message: "Generate or write a reply before creating a Gmail draft.", state: "error" } } : current,
      );
      return;
    }

    setReplyDraft((current) =>
      current ? { ...current, draftStatus: { message: "Creating Gmail draft...", state: "loading" } } : current,
    );

    try {
      const response = await fetch("/api/google/drafts/create", {
        body: JSON.stringify({
          body: replyDraft.replyBody,
          subject: replyDraft.draftSubject,
          to: replyDraft.draftTo,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gmail API could not create the draft.");
      }

      setReplyDraft((current) =>
        current
          ? {
              ...current,
              draftStatus: { message: "Draft created in Gmail. Review it in Gmail before sending.", state: "success" },
            }
          : current,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Gmail draft creation failed.";
      setReplyDraft((current) =>
        current ? { ...current, draftStatus: { message: friendlyError(message), state: "error" } } : current,
      );
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim()) return;

    const contextIntent = parseContextQuestion(content);

    if (!latest && !lastContext && fullMessages.length === 0 && !contextIntent) {
      setError("Ask with a time range, like 'since yesterday' or 'last 24 hours', or generate a briefing first.");
      return;
    }

    const userMessage: ChatMessage = {
      content: content.trim(),
      id: crypto.randomUUID(),
      role: "user",
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setLoadingLabel(contextIntent ? "Checking your email context..." : "Concierge is thinking");
    setError(null);

    try {
      const freshContext = contextIntent ? await fetchContextForQuestion(contextIntent.range) : null;
      const approvedFullMessages = freshContext ? [] : fullMessages;

      if (freshContext) {
        setLastContext(freshContext);
        setSelectedMessageIds([]);
        setFullMessages([]);
        setFullReadStatus(null);
        setReplyDraft(null);
      }

      if (contextIntent?.kind === "simple_list" && freshContext) {
        setMessages((current) => [
          ...current,
          {
            content: formatSimpleContextAnswer(freshContext, contextIntent),
            id: crypto.randomUUID(),
            role: "assistant",
          },
        ]);
        return;
      }

      setLoadingLabel("Concierge is thinking");
      const response = await fetch("/api/concierge/chat", {
        body: JSON.stringify({
          briefing: latest?.briefing ?? null,
          // Freshly fetched context stays in component state for this request only.
          context: freshContext ?? latest?.context ?? lastContext ?? null,
          fullMessages: approvedFullMessages,
          messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; error?: { message?: string } };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error?.message ?? "Concierge could not respond.");
      }

      const assistantContent = payload.message;
      incrementUsageCount("concierge");
      setMessages((current) => [
        ...current,
        {
          content: assistantContent,
          id: crypto.randomUUID(),
          role: "assistant",
        },
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Concierge could not respond.";
      setError(friendlyError(message));
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage(content: string) {
    await navigator.clipboard?.writeText(content);
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(latestBriefingStorageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored) as LatestBriefing;
      const sanitizedLatest = {
        briefing: parsed.briefing,
        savedAt: parsed.savedAt,
      };
      setLatest(sanitizedLatest);
      window.localStorage.setItem(latestBriefingStorageKey, JSON.stringify(sanitizedLatest));
    } catch {
      setLatest(null);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const pendingCommand = window.sessionStorage.getItem(pendingConciergeCommandKey);
    if (!pendingCommand) return;

    window.sessionStorage.removeItem(pendingConciergeCommandKey);
    void sendMessage(pendingCommand);
  }, [hydrated, latest]);

  return (
    <section className="surface-card rounded-[2rem] p-4 sm:p-6">
      {!latest && (
        <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-mist-300">
          Ask an email or calendar question with a time range, like "What emails did I receive since 8pm yesterday?"
          You can also generate a briefing first for broader transcript-based chat.
          <div className="mt-3">
            <Link className="secondary-button px-4 py-2 text-xs" href="/briefing">
              Go to Briefing
            </Link>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            className="secondary-button px-4 py-2 text-xs"
            disabled={loading}
            key={suggestion}
            onClick={() => sendMessage(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
        {(messages.length > 0 || lastContext || fullMessages.length > 0) && (
          <button className="secondary-button px-4 py-2 text-xs text-mist-300" onClick={clearConversation} type="button">
            <Trash2 className="h-3.5 w-3.5" />
            Clear conversation
          </button>
        )}
      </div>

      <div className="space-y-5">
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";
          return (
            <article className={cn("flex gap-3", !isAssistant && "justify-end")} key={message.id}>
              {isAssistant && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-300/[0.14] text-teal-300">
                  <Sparkles className="h-5 w-5" />
                </div>
              )}
              <div className={cn("max-w-3xl rounded-[1.75rem] p-4", isAssistant ? "surface-card" : "bg-mist-50 text-ink-950")}>
                <p className={cn("whitespace-pre-line text-sm leading-6", isAssistant ? "text-mist-100" : "text-ink-950")}>
                  {message.content}
                </p>
                {isAssistant && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="secondary-button px-3 py-2 text-xs" onClick={() => copyMessage(message.content)} type="button">
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                    <button
                      className="secondary-button px-3 py-2 text-xs"
                      onClick={() => {
                        saveOutput(message.content);
                        setSavedId(message.id);
                      }}
                      type="button"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savedId === message.id ? "Saved" : "Save to Outputs"}
                    </button>
                  </div>
                )}
              </div>
              {!isAssistant && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mist-50 text-ink-950">
                  <UserRound className="h-5 w-5" />
                </div>
              )}
            </article>
          );
        })}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-mist-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingLabel}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-3xl border border-ember-300/25 bg-ember-300/10 p-4 text-sm leading-6 text-ember-300">
          {error}
        </div>
      )}

      {lastContext && lastContext.gmail.messages.length > 0 && (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-mist-50">Fetched email context</p>
              <p className="mt-1 text-sm leading-6 text-mist-500">
                InboxCast will read only the selected emails. It will not read your full inbox.
              </p>
            </div>
            <button
              className="secondary-button px-4 py-2 text-xs"
              disabled={selectedMessageIds.length === 0 || fullReadStatus?.state === "loading"}
              onClick={() => readSelectedEmails(selectedMessageIds)}
              type="button"
            >
              {fullReadStatus?.state === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MailOpen className="h-3.5 w-3.5" />
              )}
              Read selected emails
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {lastContext.gmail.messages.map((email) => {
              const selected = selectedMessageIds.includes(email.id);
              const fullRead = fullMessages.some((message) => message.id === email.id);

              return (
                <article className="rounded-2xl border border-white/10 bg-ink-950/[0.42] p-3" key={email.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-left text-sm transition",
                        selected
                          ? "border-teal-300/35 bg-teal-300/10 text-teal-100"
                          : "border-white/10 bg-white/[0.035] text-mist-300 hover:border-white/20",
                      )}
                      disabled={!selected && selectedMessageIds.length >= MAX_SELECTED_EMAILS}
                      onClick={() => toggleMessageSelection(email.id)}
                      type="button"
                    >
                      {selected ? "Selected" : fullRead ? "Full read loaded" : "Select"}
                    </button>
                    <button
                      className="secondary-button px-3 py-2 text-xs"
                      disabled={fullReadStatus?.state === "loading" || fullRead}
                      onClick={() => readSelectedEmails([email.id])}
                      type="button"
                    >
                      <MailOpen className="h-3.5 w-3.5" />
                      {fullRead ? "Full email read" : "Read full email"}
                    </button>
                    {fullRead && (
                      <button
                        className="secondary-button px-3 py-2 text-xs"
                        onClick={() => {
                          const fullEmail = fullMessages.find((message) => message.id === email.id);
                          if (fullEmail) startReplyDraft(fullEmail);
                        }}
                        type="button"
                      >
                        <MailPlus className="h-3.5 w-3.5" />
                        Draft reply
                      </button>
                    )}
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="truncate text-sm font-semibold text-mist-50">{email.from}</p>
                    <p className="mt-1 text-sm text-mist-300">{email.subject}</p>
                    <p className="mt-1 text-xs text-mist-500">{formatTimestamp(email.timestamp)}</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-mist-500">{compactEmailPreview(email)}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-3 text-xs leading-5 text-mist-600">
            Select up to {MAX_SELECTED_EMAILS} emails. Full bodies stay in this browser session only and are sent to
            Concierge only for follow-up answers.
          </p>

          {fullReadStatus && (
            <div
              className={[
                "mt-3 rounded-2xl border p-3 text-sm leading-6",
                fullReadStatus.state === "success"
                  ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                  : fullReadStatus.state === "error"
                    ? "border-ember-300/25 bg-ember-300/10 text-ember-300"
                    : "border-white/10 bg-white/[0.04] text-mist-300",
              ].join(" ")}
            >
              {fullReadStatus.message}
            </div>
          )}
        </div>
      )}

      {replyDraft && (
        <div className="mt-5 rounded-3xl border border-teal-300/20 bg-teal-300/[0.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-mist-50">Draft reply</p>
              <p className="mt-1 text-sm leading-6 text-mist-500">
                Using the full-read email from {replyDraft.email.from}: {replyDraft.email.subject}
              </p>
            </div>
            <button className="secondary-button px-3 py-2 text-xs" onClick={() => setReplyDraft(null)} type="button">
              Close
            </button>
          </div>

          <label className="mt-4 block text-sm font-medium text-mist-300">
            Optional drafting instructions
            <input
              className="field mt-2"
              onChange={(event) =>
                setReplyDraft((current) => (current ? { ...current, instruction: event.target.value } : current))
              }
              placeholder="Try: make it friendly and short"
              type="text"
              value={replyDraft.instruction}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="primary-button px-4 py-2"
              disabled={replyDraft.status?.state === "loading"}
              onClick={generateReplyDraft}
              type="button"
            >
              {replyDraft.status?.state === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {replyDraft.replyBody ? "Regenerate reply" : "Generate reply"}
            </button>
          </div>

          {replyDraft.status && (
            <div
              className={[
                "mt-3 rounded-2xl border p-3 text-sm leading-6",
                replyDraft.status.state === "success"
                  ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                  : replyDraft.status.state === "error"
                    ? "border-ember-300/25 bg-ember-300/10 text-ember-300"
                    : "border-white/10 bg-white/[0.04] text-mist-300",
              ].join(" ")}
            >
              {replyDraft.status.message}
            </div>
          )}

          {replyDraft.replyBody && (
            <>
              <label className="mt-4 block text-sm font-medium text-mist-300">
                Review and edit reply
                <textarea
                  className="field mt-2 min-h-44 resize-y leading-6"
                  onChange={(event) =>
                    setReplyDraft((current) =>
                      current
                        ? {
                            ...current,
                            draftStatus: null,
                            replyBody: event.target.value,
                            saved: false,
                          }
                        : current,
                    )
                  }
                  value={replyDraft.replyBody}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="secondary-button px-4 py-2 text-xs" onClick={saveReplyDraftToOutputs} type="button">
                  <Save className="h-3.5 w-3.5" />
                  {replyDraft.saved ? "Saved" : "Save to Outputs"}
                </button>
                <button className="secondary-button px-4 py-2 text-xs" onClick={copyReplyDraft} type="button">
                  <Copy className="h-3.5 w-3.5" />
                  {replyDraft.copied ? "Copied" : "Copy"}
                </button>
                <button
                  className="secondary-button px-4 py-2 text-xs"
                  onClick={() =>
                    setReplyDraft((current) =>
                      current ? { ...current, draftStatus: null, showDraftConfirm: !current.showDraftConfirm } : current,
                    )
                  }
                  type="button"
                >
                  <MailPlus className="h-3.5 w-3.5" />
                  Create Gmail draft
                </button>
              </div>

              {replyDraft.showDraftConfirm && (
                <div className="mt-4 rounded-3xl border border-white/10 bg-ink-950/[0.42] p-4">
                  <p className="text-sm font-semibold text-mist-50">Confirm Gmail draft</p>
                  <p className="mt-1 text-sm leading-6 text-mist-500">
                    InboxCast creates a draft only. It will not send email.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <label className="text-sm font-medium text-mist-300">
                      To
                      <input
                        className="field mt-2"
                        onChange={(event) =>
                          setReplyDraft((current) => (current ? { ...current, draftTo: event.target.value } : current))
                        }
                        placeholder="name@example.com"
                        type="email"
                        value={replyDraft.draftTo}
                      />
                    </label>
                    <label className="text-sm font-medium text-mist-300">
                      Subject
                      <input
                        className="field mt-2"
                        onChange={(event) =>
                          setReplyDraft((current) => (current ? { ...current, draftSubject: event.target.value } : current))
                        }
                        type="text"
                        value={replyDraft.draftSubject}
                      />
                    </label>
                  </div>

                  <button
                    className="primary-button mt-4 px-4 py-2"
                    disabled={replyDraft.draftStatus?.state === "loading"}
                    onClick={createGmailDraftFromReply}
                    type="button"
                  >
                    {replyDraft.draftStatus?.state === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MailPlus className="h-4 w-4" />
                    )}
                    Create draft in Gmail
                  </button>

                  {replyDraft.draftStatus && (
                    <div
                      className={[
                        "mt-3 rounded-2xl border p-3 text-sm leading-6",
                        replyDraft.draftStatus.state === "success"
                          ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                          : replyDraft.draftStatus.state === "error"
                            ? "border-ember-300/25 bg-ember-300/10 text-ember-300"
                            : "border-white/10 bg-white/[0.04] text-mist-300",
                      ].join(" ")}
                    >
                      {replyDraft.draftStatus.message}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-ink-950/[0.48] p-3">
        <div className="flex items-end gap-3">
          <textarea
            aria-label="Concierge message"
            className="min-h-16 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-mist-100 outline-none placeholder:text-mist-700"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Try: What emails did I receive since 8pm yesterday?"
            value={input}
          />
          <button
            className="primary-button h-12 w-12 shrink-0 px-0"
            disabled={loading}
            onClick={() => sendMessage(input)}
            type="button"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
