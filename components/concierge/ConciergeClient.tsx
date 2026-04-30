"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Loader2, Save, SendHorizonal, Sparkles, UserRound } from "lucide-react";
import type { BriefingContextResponse, WrittenBriefing } from "@/lib/google/types";
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
  type: "Concierge response";
  title: string;
  linkedEmail: string;
  createdDate: string;
  content: string;
};

const latestBriefingStorageKey = "inboxcast.latestBriefing";
const outputsStorageKey = "inboxcast.outputs";
const pendingConciergeCommandKey = "inboxcast.pendingConciergeCommand";
const suggestions = [
  "What needs my attention?",
  "Draft replies for important emails",
  "Turn action items into a plan",
];

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

function loadOutputs() {
  try {
    return JSON.parse(window.localStorage.getItem(outputsStorageKey) ?? "[]") as SavedOutput[];
  } catch {
    return [];
  }
}

function saveOutput(content: string) {
  const outputs = loadOutputs();
  const nextOutput: SavedOutput = {
    content,
    createdDate: new Date().toLocaleString(),
    id: crypto.randomUUID(),
    linkedEmail: "Latest briefing",
    title: content.split("\n")[0]?.slice(0, 72) || "Concierge response",
    type: "Concierge response",
  };
  window.localStorage.setItem(outputsStorageKey, JSON.stringify([nextOutput, ...outputs]));
}

export function ConciergeClient() {
  const [latest, setLatest] = useState<LatestBriefing | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function sendMessage(content: string) {
    if (!content.trim()) return;
    if (!latest) {
      setError("Generate a briefing first so Concierge has your latest transcript.");
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
    setError(null);

    try {
      const response = await fetch("/api/concierge/chat", {
        body: JSON.stringify({
          briefing: latest?.briefing ?? null,
          // Persisted briefings intentionally omit raw Gmail/Calendar metadata.
          // When absent, Concierge answers from the generated briefing transcript.
          context: latest?.context ?? null,
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
    }
  }, []);

  useEffect(() => {
    if (!latest) return;

    const pendingCommand = window.sessionStorage.getItem(pendingConciergeCommandKey);
    if (!pendingCommand) return;

    window.sessionStorage.removeItem(pendingConciergeCommandKey);
    void sendMessage(pendingCommand);
  }, [latest]);

  return (
    <section className="surface-card rounded-[2rem] p-4 sm:p-6">
      {!latest && (
        <div className="mb-5 rounded-3xl border border-ember-300/25 bg-ember-300/10 p-4 text-sm leading-6 text-ember-300">
          Generate a briefing first so Concierge has your latest transcript.
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
            disabled={loading || !latest}
            key={suggestion}
            onClick={() => sendMessage(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
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
            Concierge is thinking
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-3xl border border-ember-300/25 bg-ember-300/10 p-4 text-sm leading-6 text-ember-300">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-ink-950/[0.48] p-3">
        <div className="flex items-end gap-3">
          <textarea
            aria-label="Concierge message"
            className="min-h-16 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-mist-100 outline-none placeholder:text-mist-700"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about the briefing, emails, or calendar context..."
            value={input}
          />
          <button
            className="primary-button h-12 w-12 shrink-0 px-0"
            disabled={loading || !latest}
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
