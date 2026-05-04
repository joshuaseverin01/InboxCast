import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import type {
  BriefingContextResponse,
  GmailFullMessageContent,
  GmailThreadContent,
  WrittenBriefing,
} from "@/lib/google/types";
import { openAIProviderErrorMessage } from "@/lib/openai/errors";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_CONCIERGE_MODEL || "gpt-4o-mini";
const MAX_CHAT_MESSAGES = 6;
const MAX_CHAT_MESSAGE_CHARS = 1200;
const MAX_CONTEXT_EMAILS = 10;
const MAX_CONTEXT_EVENTS = 20;
const MAX_EMAIL_SNIPPET_CHARS = 220;
const MAX_CALENDAR_DESCRIPTION_CHARS = 260;
const MAX_TRANSCRIPT_CHARS = 4000;
const MAX_FULL_MESSAGES = 3;
const MAX_FULL_EMAIL_BODY_CHARS = 8_000;
const MAX_FULL_THREADS = 1;
const MAX_THREAD_MESSAGES = 10;
const MAX_THREAD_MESSAGE_BODY_CHARS = 5_000;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConciergeRequest = {
  messages?: ChatMessage[];
  context?: BriefingContextResponse | null;
  briefing?: WrittenBriefing | null;
  fullMessages?: GmailFullMessageContent[];
  fullThreads?: GmailThreadContent[];
  task?: "reply_draft";
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

function outputText(response: OpenAIResponse) {
  return (
    response.output_text ??
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ??
    ""
  );
}

function truncateText(value: string | undefined, maxLength: number) {
  if (!value) return value;
  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}...` : value;
}

function compactMessages(messages: ChatMessage[]) {
  return messages.slice(-MAX_CHAT_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, MAX_CHAT_MESSAGE_CHARS),
  }));
}

function compactContext(context?: BriefingContextResponse | null, briefing?: WrittenBriefing | null) {
  return {
    briefing: briefing
      ? {
          actionItems: briefing.actionItems,
          calendarContext: briefing.calendarContext,
          fullTranscript: briefing.fullTranscript.slice(0, MAX_TRANSCRIPT_CHARS),
          priorityEmails: briefing.priorityEmails,
          suggestedNextSteps: briefing.suggestedNextSteps,
        }
      : null,
    calendar: {
      events:
        context?.calendar.events.slice(0, MAX_CONTEXT_EVENTS).map((event) => ({
          descriptionSnippet: truncateText(event.descriptionSnippet, MAX_CALENDAR_DESCRIPTION_CHARS),
          end: event.end,
          location: event.location,
          start: event.start,
          title: event.title,
        })) ?? [],
    },
    gmail: {
      messages:
        context?.gmail.messages.slice(0, MAX_CONTEXT_EMAILS).map((message) => ({
          date: message.date,
          from: message.from,
          labels: message.labels,
          snippet: truncateText(message.snippet, MAX_EMAIL_SNIPPET_CHARS),
          subject: message.subject,
          timestamp: message.timestamp,
        })) ?? [],
    },
    summary: context?.summary ?? null,
  };
}

function compactFullMessages(messages?: GmailFullMessageContent[]) {
  return (
    messages?.slice(0, MAX_FULL_MESSAGES).map((message) => ({
      body: truncateText(message.body, MAX_FULL_EMAIL_BODY_CHARS),
      date: message.date,
      from: message.from,
      id: message.id,
      subject: message.subject,
      timestamp: message.timestamp,
    })) ?? []
  );
}

function compactFullThreads(threads?: GmailThreadContent[]) {
  return (
    threads?.slice(0, MAX_FULL_THREADS).map((thread) => ({
      messageCount: thread.messageCount,
      messages: thread.messages.slice(0, MAX_THREAD_MESSAGES).map((message) => ({
        body: truncateText(message.body, MAX_THREAD_MESSAGE_BODY_CHARS),
        date: message.date,
        from: message.from,
        id: message.id,
        subject: message.subject,
        timestamp: message.timestamp,
        to: message.to,
      })),
      replyTo: thread.replyTo,
      subject: thread.subject,
      threadId: thread.threadId,
      truncated: thread.truncated,
    })) ?? []
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return errorResponse("Sign in to use Concierge.", 401);
  }

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse("OPENAI_API_KEY is not configured.", 500);
  }

  try {
    const payload = (await request.json()) as ConciergeRequest;
    const messages = compactMessages(payload.messages ?? []);
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

    if (!lastUserMessage?.content.trim()) {
      return errorResponse("Missing user message.", 400);
    }

    const hasFullMessage = payload.fullMessages?.some((message) => message.body.trim());
    const hasFullThread = payload.fullThreads?.some((thread) =>
      thread.messages.some((message) => message.body.trim()),
    );

    if (payload.task === "reply_draft" && !hasFullMessage && !hasFullThread) {
      return errorResponse("Read a full email or thread before drafting a reply.", 400);
    }

    // Concierge receives bounded snippets by default. Full bodies/threads are included only
    // for user-approved selected messages or threads and are never persisted server-side here.
    const systemPrompt =
      payload.task === "reply_draft"
        ? "You are InboxCast reply drafting assistant. Draft a concise, professional, natural email reply using only the explicitly user-approved selected full email message or selected full thread and the user's drafting instruction. If selectedFullThreads are provided, use the thread conversation context and draft to the latest relevant sender. Do not invent facts, commitments, dates, attachments, or relationships. If needed information is missing or ambiguous, ask a brief clarifying question in the reply. Return only the editable reply body. Do not include a subject line or commentary. Do not send emails."
        : "You are InboxCast Concierge. Answer questions using only the provided generated briefing, Gmail metadata, snippets, labels, Calendar event snippets, any explicitly user-approved selected full email messages, and any explicitly user-approved selected full threads. Do not claim to have read full email bodies unless selectedFullEmailMessages or selectedFullThreads are provided. If a snippet is insufficient, say that only preview/snippet data is available. Clearly distinguish selected full-thread context from selected full-message context and snippet-only context. Do not send emails. If drafting replies, provide drafts only.";
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify({
              context: compactContext(payload.context, payload.briefing),
              conversation: messages,
              selectedFullEmailMessages: compactFullMessages(payload.fullMessages),
              selectedFullThreads: compactFullThreads(payload.fullThreads),
            }),
          },
        ],
        max_output_tokens: payload.task === "reply_draft" ? 600 : 900,
        model: MODEL,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const data = (await response.json().catch(() => ({}))) as OpenAIResponse;

    if (!response.ok) {
      return errorResponse(
        openAIProviderErrorMessage(
          response.status,
          "Concierge could not respond. Check server OpenAI configuration and model access.",
          data,
        ),
        response.status,
      );
    }

    return NextResponse.json({ message: outputText(data) });
  } catch {
    return errorResponse("Concierge could not respond.", 500);
  }
}
