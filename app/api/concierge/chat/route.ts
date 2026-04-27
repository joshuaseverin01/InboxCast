import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import type { BriefingContextResponse, WrittenBriefing } from "@/lib/google/types";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

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

function compactContext(context?: BriefingContextResponse | null, briefing?: WrittenBriefing | null) {
  return {
    briefing: briefing
      ? {
          actionItems: briefing.actionItems,
          calendarContext: briefing.calendarContext,
          fullTranscript: briefing.fullTranscript.slice(0, 5000),
          priorityEmails: briefing.priorityEmails,
          suggestedNextSteps: briefing.suggestedNextSteps,
        }
      : null,
    calendar: {
      events:
        context?.calendar.events.slice(0, 30).map((event) => ({
          descriptionSnippet: event.descriptionSnippet,
          end: event.end,
          location: event.location,
          start: event.start,
          title: event.title,
        })) ?? [],
    },
    gmail: {
      messages:
        context?.gmail.messages.slice(0, 20).map((message) => ({
          date: message.date,
          from: message.from,
          labels: message.labels,
          snippet: message.snippet,
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
    const messages = payload.messages?.slice(-8) ?? [];
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
              "You are InboxCast Concierge. Answer questions using only the provided generated briefing, Gmail metadata, snippets, labels, and Calendar event snippets. Do not claim to have read full email bodies. Do not send emails. If drafting replies, provide drafts only.",
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
        "Concierge could not respond. Check server OpenAI configuration and model access.",
        response.status,
      );
    }

    return NextResponse.json({ message: outputText(data) });
  } catch {
    return errorResponse("Concierge could not respond.", 500);
  }
}
