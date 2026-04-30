import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import type { BriefingContextResponse, WrittenBriefing } from "@/lib/google/types";
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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConciergeRequest = {
  messages?: ChatMessage[];
  context?: BriefingContextResponse | null;
  briefing?: WrittenBriefing | null;
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

    // Concierge receives bounded generated briefing text plus metadata snippets only.
    // It must not infer access to full email bodies or send messages on the user's behalf.
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content:
              "You are InboxCast Concierge. Answer questions using only the provided generated briefing, Gmail metadata, snippets, labels, and Calendar event snippets. Do not claim to have read full email bodies. If a snippet is insufficient, say that only preview/snippet data is available. Do not send emails. If drafting replies, provide drafts only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              context: compactContext(payload.context, payload.briefing),
              conversation: messages,
            }),
          },
        ],
        max_output_tokens: 900,
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
